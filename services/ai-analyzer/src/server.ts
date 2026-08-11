import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { Queue, Worker, type Job } from "bullmq";
import Redis from "ioredis";
import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { buildPlanObjective, compactPlanFocus, normalizePlanObjective } from "../../../lib/plan-objective";
import {
  analysisJobV1,
  type AnalysisCallbackV1,
  type AnalysisJobV1,
} from "../../../packages/contracts/analysis-job.v1";

const config = z.object({
  REDIS_URL: z.string().url().default("redis://localhost:63799/1"),
  WEB_TO_PYTHON_HMAC_KEYS: z.string().min(20),
  PYTHON_TO_WEB_HMAC_KEYS: z.string().min(20),
  AI_ANALYZER_MODE: z.enum(["fixture", "gemini"]).default("gemini"),
  AI_MODEL: z.string().min(1).default("gemini-3.6-flash"),
  AI_FALLBACK_MODEL: z.string().min(1).default("gemini-3.5-flash-lite"),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  AI_BATCH_CONCURRENCY: z.coerce.number().int().min(1).max(6).default(3),
  AI_MAX_FILE_BYTES: z.coerce.number().int().min(1_000_000).max(25_000_000).default(15_728_640),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8020),
}).parse(process.env);

type AnswerResult = AnalysisCallbackV1["results"][number];
type Gap = AnalysisCallbackV1["gaps"][number];
type StudentGroup = AnalysisCallbackV1["groups"][number];
type Plan = AnalysisCallbackV1["plans"][number];
type AnalysisOutput = Pick<AnalysisCallbackV1, "results" | "gaps" | "groups" | "plans">;

const modelAnswerSchema = z.object({
  questionId: z.string().describe("معرف السؤال كما ورد حرفيًا في الإدخال"),
  extractedAnswer: z.string().describe("الإجابة المرئية فقط، أو غير مقروء إذا تعذرت القراءة"),
  mastery: z.enum(["MASTERED", "PARTIAL", "NOT_MASTERED", "UNREADABLE"]),
  score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  needsReview: z.boolean(),
});

const sheetOutputSchema = z.object({
  answers: z.array(modelAnswerSchema).min(5).max(10),
});

const enrichmentSchema = z.object({
  gapNarratives: z.array(z.object({
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    evidence: z.string(),
  })).max(5),
  groupNarratives: z.array(z.object({
    key: z.enum(["foundation", "practice", "mastery"]),
    title: z.string(),
    description: z.string(),
  })).max(3),
  plans: z.array(z.object({
    groupKey: z.enum(["foundation", "practice", "mastery"]),
    objective: z.string(),
    duration: z.string(),
    teacherSteps: z.array(z.string()).min(2).max(6),
    explanation: z.string(),
    example: z.string(),
    activity: z.string(),
    practice: z.array(z.string()).min(2).max(6),
    exitTicket: z.array(z.object({ question: z.string(), answer: z.string() })).min(1).max(3),
    adaptations: z.object({
      visual: z.string(),
      language: z.string(),
      enrichment: z.string(),
    }),
  })).min(3).max(3),
});

const GROUP_SPECS = [
  { key: "foundation", label: "تأسيس", title: "بناء المفهوم الأساسي", description: "دعم مكثف ونمذجة مباشرة للمفهوم.", color: "coral" },
  { key: "practice", label: "تدريب", title: "تدريب موجّه", description: "تطبيق متدرج مع تغذية راجعة قصيرة.", color: "amber" },
  { key: "mastery", label: "إتقان", title: "تطبيق ونقل أثر التعلم", description: "تحديات أعمق وتفسير للاستراتيجية.", color: "teal" },
] as const;

function signedPayload(timestamp: string, nonce: string, rawBody: string) {
  return `${timestamp}.${nonce}.${rawBody}`;
}

function signBody(rawBody: string, key: string, timestamp: string, nonce: string) {
  return createHmac("sha256", key).update(signedPayload(timestamp, nonce, rawBody)).digest("hex");
}

function verifySignature(rawBody: string, timestamp: string, nonce: string, signature: string) {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) return false;
  const expected = Buffer.from(signBody(rawBody, config.WEB_TO_PYTHON_HMAC_KEYS, timestamp, nonce), "hex");
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function nafsInstruction(job: AnalysisJobV1) {
  const alignment = job.context?.nafsAlignment;
  if (!alignment?.enabled) return "";
  return `التقييم مواءم إرشاديًا مع ${alignment.framework} ضمن مجال ${alignment.domain}. استخدم هذه المواءمة لتسمية الفجوات وتنظيمها وصياغة الخطط العلاجية، مع بقاء مفتاح الإجابة وسلم المعلم أساس الحكم على إجابة الطالب. لا تصف المواءمة بأنها اعتماد رسمي ولا تدّع الوصول إلى بيانات طلاب نافس الخام.`;
}

function defaultPlan(group: StudentGroup, job: AnalysisJobV1): Plan {
  const assessmentScope = job.context?.subject?.trim() || job.context?.title?.trim() || "المهارات المستهدفة";
  const objectives = job.context?.objectives.map((objective) => objective.title).filter(Boolean) ?? [];
  const focus = compactPlanFocus(objectives[0], assessmentScope);
  const groupAction = group.key === "foundation"
    ? "بناء المفهوم من مثال محسوس ثم تمثيله وشرحه"
    : group.key === "practice"
      ? "تثبيت خطوات الحل مع تبرير كل خطوة"
      : "تطبيق المفهوم في موقف جديد ومقارنة أكثر من طريقة";
  return {
    groupKey: group.key,
    objective: buildPlanObjective(group.label, focus, assessmentScope),
    duration: "3 حصص × 25 دقيقة",
    teacherSteps: [
      `اعرض إجابة فعلية من اختبار ${assessmentScope} وناقش موضع القوة والتعثر فيها.`,
      `${groupAction}.`,
      "تحقق بسؤال قصير مستقل قبل الانتقال إلى التدريب التالي.",
    ],
    explanation: `شرح موجز يربط الدليل بمفاهيم ${assessmentScope} ويُبقي اعتماد القرار النهائي للمعلم.`,
    example: `مثال محلول من ${assessmentScope} ثم مثال موازٍ يشرحه الطلاب بلغتهم.`,
    activity: `عمل ثنائي يطبق ${focus} ثم يبدّل الطالبان الأدوار في الشرح والتحقق.`,
    practice: [`سؤال تمهيدي في ${assessmentScope}`, "تطبيق موجّه مع تغذية راجعة", "تطبيق مستقل في سياق جديد"],
    exitTicket: [{ question: `طبّق فكرة أساسية من ${assessmentScope} وفسّر إجابتك.`, answer: `إجابة صحيحة تربط ${focus} بالدليل أو خطوات الحل.` }],
    adaptations: { visual: `تمثيل بصري لمفاهيم ${assessmentScope} وخطوات مرقمة`, language: "تعليمات مختصرة ومفردات أساسية مع مثال إضافي", enrichment: `موقف جديد يتطلب التبرير أو التعميم في ${assessmentScope}` },
  };
}

export function deriveFacts(job: AnalysisJobV1, results: AnswerResult[]) {
  const assessmentScope = job.context?.subject?.trim() || job.context?.title?.trim() || "المهارات المستهدفة";
  const alignmentSuffix = job.context?.nafsAlignment?.enabled
    ? ` وتُصنّف هذه الفجوة إرشاديًا ضمن ${job.context.nafsAlignment.domain} في ${job.context.nafsAlignment.framework}.`
    : "";
  const objectiveTitles = new Map(job.context?.objectives.map((objective) => [objective.code, objective.title]) ?? []);
  const scores = new Map(job.submissions.map((submission) => [submission.studentCode, [] as number[]]));
  for (const result of results) {
    if (typeof result.score === "number") scores.get(result.studentCode)?.push(result.score);
  }

  const memberBuckets = new Map(GROUP_SPECS.map((group) => [group.key, [] as StudentGroup["members"]]));
  for (const submission of job.submissions) {
    const values = scores.get(submission.studentCode) ?? [];
    const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const key = average < 0.5 ? "foundation" : average < 0.8 ? "practice" : "mastery";
    const reason = key === "foundation"
      ? "يحتاج إلى تأسيس موجّه بناءً على متوسط الإجابات."
      : key === "practice"
        ? "أظهر إتقانًا جزئيًا ويحتاج إلى تدريب موجّه."
        : "أظهر أدلة متسقة على الإتقان ويستفيد من التوسّع.";
    memberBuckets.get(key)?.push({ studentCode: submission.studentCode, reason });
  }

  const groups: StudentGroup[] = GROUP_SPECS.map((spec) => {
    const title = spec.key === "foundation"
      ? `تأسيس مفاهيم ${assessmentScope}`
      : spec.key === "practice"
        ? `تدريب موجّه في ${assessmentScope}`
        : `توسّع وتطبيق في ${assessmentScope}`;
    const description = spec.key === "foundation"
      ? `إعادة بناء المفاهيم الأساسية في ${assessmentScope} بنمذجة مباشرة وأمثلة قصيرة.`
      : spec.key === "practice"
        ? `تطبيق متدرج على مهارات ${assessmentScope} مع تغذية راجعة قصيرة.`
        : `نقل أثر تعلم ${assessmentScope} إلى مواقف جديدة تتطلب تفسيرًا وتبريرًا.`;
    return { ...spec, title, description, members: memberBuckets.get(spec.key) ?? [] };
  });

  const gaps: Gap[] = job.questions.map((question, index) => {
    const related = results.filter((result) => result.questionId === question.id);
    const affected = related.filter((result) => result.mastery !== "MASTERED");
    const averageConfidence = affected.length
      ? affected.reduce((sum, result) => sum + result.confidence, 0) / affected.length
      : 1;
    return {
      slug: `${question.objectiveCode}-${index + 1}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
      title: `هدف التعلّم: ${objectiveTitles.get(question.objectiveCode) ?? `مهارة السؤال ${index + 1}`}`,
      description: `ظهر التعثر عند الإجابة عن: «${question.prompt}»${alignmentSuffix}`,
      affectedCodes: affected.map((result) => result.studentCode),
      confidence: averageConfidence,
      evidence: `${affected.length} من ${job.submissions.length} طالبًا لم يصلوا إلى الإتقان الكامل في هذا السؤال.`,
      color: index === 0 ? "#cf6b43" : index === 1 ? "#d6a13f" : "#3b8278",
      rank: 0,
    };
  }).filter((gap) => gap.affectedCodes.length > 0)
    .sort((left, right) => right.affectedCodes.length - left.affectedCodes.length)
    .slice(0, 5)
    .map((gap, index) => ({ ...gap, rank: index + 1 }));

  return { gaps, groups };
}

export function buildFixtureAnalysis(job: AnalysisJobV1): AnalysisOutput {
  const results: AnswerResult[] = [];
  for (const [studentIndex, submission] of job.submissions.entries()) {
    for (const [questionIndex, question] of job.questions.entries()) {
      const marker = (studentIndex + questionIndex) % 11;
      const mastery = marker > 4 ? "MASTERED" : marker > 1 ? "PARTIAL" : "NOT_MASTERED";
      const confidence = marker === 0 ? 0.46 : marker === 1 ? 0.68 : 0.92;
      results.push({
        studentCode: submission.studentCode,
        questionId: question.id,
        extractedAnswer: mastery === "MASTERED" ? question.answerKey : "إجابة تحتاج تحقق المعلم",
        mastery,
        score: mastery === "MASTERED" ? 1 : mastery === "PARTIAL" ? 0.5 : 0,
        confidence,
        needsReview: confidence < 0.7,
      });
    }
  }
  const facts = deriveFacts(job, results);
  return { ...facts, results, plans: facts.groups.map((group) => defaultPlan(group, job)) };
}

async function downloadSubmission(url: string) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("Unsupported asset protocol");
  const response = await fetch(parsed, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Asset download failed (${response.status})`);
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > config.AI_MAX_FILE_BYTES) throw new Error("Asset exceeds configured size limit");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > config.AI_MAX_FILE_BYTES) throw new Error("Asset exceeds configured size limit");
  return bytes;
}

async function analyzeSubmission(job: AnalysisJobV1, submission: AnalysisJobV1["submissions"][number], model: LanguageModel) {
  const bytes = await downloadSubmission(submission.downloadUrl);
  const questions = job.questions.map((question) => ({
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    choices: question.choices,
    answerKey: question.answerKey,
    rubric: question.rubric,
  }));
  const assessmentPrompt = `سياق الاختبار:\n${JSON.stringify(job.context ?? {})}\n\nحلل إجابات الطالب وفق الأسئلة التالية:\n${JSON.stringify(questions)}`;
  const content = submission.contentType === "application/json"
    ? [{ type: "text" as const, text: `${assessmentPrompt}\n\nإجابات الطالب الرقمية المحفوظة في قاعدة البيانات:\n${new TextDecoder().decode(bytes)}` }]
    : [
        { type: "text" as const, text: assessmentPrompt },
        { type: "file" as const, data: bytes, mediaType: submission.contentType },
      ];
  const { output } = await generateText({
    model,
    instructions: [
      "أنت مصحح تربوي دقيق متعدد المواد. لا تفترض أن المادة رياضيات؛ استخدم سياق المادة والصف وناتج التعلم المرتبط بكل سؤال. اقرأ الإجابات الرقمية أو النصوص والمعادلات والرسومات والصور المرفوعة كما وردت فقط. اقبل الصيغ المكافئة علميًا ولغويًا إذا حققت معيار التصحيح، وتحقق من الوحدات والاتجاهات والتسميات عندما يطلبها السؤال. لا تخمّن المحتوى غير الواضح، واستخدم UNREADABLE عند تعذر القراءة. قيّم كل سؤال مستقلًا وفق مفتاح الإجابة وسلم التصحيح، وأعد سؤالًا واحدًا لكل معرف مطلوب.",
      nafsInstruction(job),
    ].filter(Boolean).join(" "),
    messages: [{
      role: "user",
      content,
    }],
    output: Output.object({ schema: sheetOutputSchema }),
    maxOutputTokens: 4_000,
    maxRetries: 0,
    timeout: { totalMs: 120_000 },
    include: { requestBody: false, responseBody: false },
  });
  const byQuestion = new Map(output.answers.map((answer) => [answer.questionId, answer]));
  return job.questions.map<AnswerResult>((question) => {
    const answer = byQuestion.get(question.id);
    if (!answer) return {
      studentCode: submission.studentCode,
      questionId: question.id,
      extractedAnswer: "غير مقروء",
      mastery: "UNREADABLE",
      score: null,
      confidence: 0,
      needsReview: true,
    };
    const confidence = Math.min(1, Math.max(0, answer.confidence));
    return {
      studentCode: submission.studentCode,
      questionId: question.id,
      extractedAnswer: answer.extractedAnswer,
      mastery: answer.mastery,
      score: answer.mastery === "UNREADABLE" ? null : answer.score,
      confidence,
      needsReview: answer.needsReview || confidence < 0.7 || answer.mastery === "UNREADABLE",
    };
  });
}

function unreadableSubmissionResults(job: AnalysisJobV1, submission: AnalysisJobV1["submissions"][number]): AnswerResult[] {
  return job.questions.map((question) => ({
    studentCode: submission.studentCode,
    questionId: question.id,
    extractedAnswer: "تعذر تحليل ورقة الطالب آليًا",
    mastery: "UNREADABLE",
    score: null,
    confidence: 0,
    needsReview: true,
  }));
}

function isQuotaError(error: unknown) {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /quota|resource_exhausted|429/i.test(message);
}

async function analyzeSubmissionResilient(
  job: AnalysisJobV1,
  submission: AnalysisJobV1["submissions"][number],
  model: LanguageModel,
  fallbackModel?: LanguageModel,
) {
  const candidates = fallbackModel ? [model, fallbackModel] : [model];
  for (const [modelIndex, candidate] of candidates.entries()) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await analyzeSubmission(job, submission, candidate);
      } catch (error) {
        console.error("Student sheet analysis failed", { studentCode: submission.studentCode, modelIndex, attempt, error });
        if (isQuotaError(error)) break;
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
      }
    }
  }
  return unreadableSubmissionResults(job, submission);
}

async function enrichAnalysis(job: AnalysisJobV1, facts: ReturnType<typeof deriveFacts>, model: LanguageModel) {
  const compact = {
    context: job.context,
    subjectQuestions: job.questions.map((question) => ({ id: question.id, prompt: question.prompt, objectiveCode: question.objectiveCode })),
    gaps: facts.gaps.map((gap) => ({ slug: gap.slug, affectedCount: gap.affectedCodes.length, evidence: gap.evidence })),
    groups: facts.groups.map((group) => ({ key: group.key, count: group.members.length })),
  };
  const { output } = await generateText({
    model,
    instructions: [
      "أنت خبير تعليم عربي متعدد التخصصات. التزم بالمادة والصف ونواتج التعلم الواردة في السياق، ولا تفترض نطاقًا غير مذكور. استخدم الحقائق المقدمة فقط، ولا تغيّر معرفات الفجوات أو المجموعات. اكتب وصفًا عمليًا موجزًا وخطة علاجية خاصة بالمفهوم المقاس وقابلة للتنفيذ لكل مجموعة. لا تذكر أسماء طلاب.",
      nafsInstruction(job),
    ].filter(Boolean).join(" "),
    prompt: JSON.stringify(compact),
    output: Output.object({ schema: enrichmentSchema }),
    maxOutputTokens: 8_000,
    maxRetries: 0,
    timeout: { totalMs: 120_000 },
  });
  const gapNarratives = new Map(output.gapNarratives.map((gap) => [gap.slug, gap]));
  const groupNarratives = new Map(output.groupNarratives.map((group) => [group.key, group]));
  const generatedPlans = new Map(output.plans.map((plan) => [plan.groupKey, plan]));
  const gaps = facts.gaps.map((gap) => {
    const narrative = gapNarratives.get(gap.slug);
    return narrative ? { ...gap, title: narrative.title, description: narrative.description, evidence: narrative.evidence } : gap;
  });
  const groups = facts.groups.map((group) => {
    const narrative = groupNarratives.get(group.key as "foundation" | "practice" | "mastery");
    return narrative ? { ...group, title: narrative.title, description: narrative.description } : group;
  });
  const plans = groups.map((group): Plan => {
    const generated = generatedPlans.get(group.key as "foundation" | "practice" | "mastery");
    if (!generated) return defaultPlan(group, job);
    return {
      ...generated,
      objective: normalizePlanObjective(generated.objective, group.label),
      adaptations: {
        visual: generated.adaptations.visual,
        language: generated.adaptations.language,
        enrichment: generated.adaptations.enrichment,
      },
    };
  });
  return { gaps, groups, plans };
}

async function sendCallback(callbackUrl: string, payload: AnalysisCallbackV1) {
  const rawBody = JSON.stringify(payload);
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = randomBytes(16).toString("hex");
    try {
      const response = await fetch(callbackUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-basira-key-id": "v1",
          "x-basira-timestamp": timestamp,
          "x-basira-nonce": nonce,
          "x-basira-signature": signBody(rawBody, config.PYTHON_TO_WEB_HMAC_KEYS, timestamp, nonce),
        },
        body: rawBody,
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`Callback rejected (${response.status})`);
      return;
    } catch (error) {
      if (attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
    }
  }
}

async function runGeminiAnalysis(job: AnalysisJobV1, reportProgress: (progress: number) => Promise<void>): Promise<AnalysisOutput> {
  if (!config.GOOGLE_GENERATIVE_AI_API_KEY) throw new Error("Gemini API key is not configured");
  const google = createGoogleGenerativeAI({ apiKey: config.GOOGLE_GENERATIVE_AI_API_KEY });
  const model = google(config.AI_MODEL);
  const fallbackModel = config.AI_FALLBACK_MODEL === config.AI_MODEL ? undefined : google(config.AI_FALLBACK_MODEL);
  const results: AnswerResult[] = [];
  for (let index = 0; index < job.submissions.length; index += config.AI_BATCH_CONCURRENCY) {
    const batch = job.submissions.slice(index, index + config.AI_BATCH_CONCURRENCY);
    const batchResults = await Promise.all(batch.map((submission) => analyzeSubmissionResilient(job, submission, model, fallbackModel)));
    results.push(...batchResults.flat());
    const completed = Math.min(job.submissions.length, index + batch.length);
    await reportProgress(10 + Math.round((completed / job.submissions.length) * 75));
  }
  const facts = deriveFacts(job, results);
  let enriched;
  try {
    enriched = await enrichAnalysis(job, facts, model);
  } catch (error) {
    if (fallbackModel && isQuotaError(error)) {
      try {
        enriched = await enrichAnalysis(job, facts, fallbackModel);
      } catch (fallbackError) {
        console.error("Fallback analysis enrichment failed; using contextual narratives", fallbackError);
      }
    } else {
      console.error("Analysis enrichment failed; using contextual narratives", error);
    }
    enriched ??= { ...facts, plans: facts.groups.map((group) => defaultPlan(group, job)) };
  }
  return { results, ...enriched };
}

async function processQueuedJob(queueJob: Job<AnalysisJobV1>) {
  const job = analysisJobV1.parse(queueJob.data);
  const progress = async (value: number) => sendCallback(job.callbackUrl, {
    schemaVersion: "analysis-result.v1",
    runId: job.runId,
    status: "PROCESSING",
    progress: value,
    results: [], gaps: [], groups: [], plans: [],
  });
  await progress(5);
  const output = config.AI_ANALYZER_MODE === "gemini"
    ? await runGeminiAnalysis(job, progress)
    : buildFixtureAnalysis(job);
  const status = output.results.some((result) => result.needsReview) ? "REVIEW" : "COMPLETED";
  await sendCallback(job.callbackUrl, {
    schemaVersion: "analysis-result.v1",
    runId: job.runId,
    status,
    progress: 100,
    ...output,
  });
  return { runId: job.runId, resultCount: output.results.length };
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 10_000_000) throw new Error("Request body too large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function json(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(payload));
}

function exposedJobId(jobId: string | undefined) {
  const value = jobId ?? "unknown";
  return config.AI_ANALYZER_MODE === "fixture" ? `fixture-${value}` : value;
}

async function start() {
  const queueConnection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
  const workerConnection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue<AnalysisJobV1>("basira-ai-analysis", { connection: queueConnection });
  const worker = new Worker<AnalysisJobV1>("basira-ai-analysis", processQueuedJob, {
    connection: workerConnection,
    concurrency: 1,
  });

  worker.on("failed", (job, error) => {
    console.error("AI analysis job failed", { jobId: job?.id, message: error.message });
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      void sendCallback(job.data.callbackUrl, {
        schemaVersion: "analysis-result.v1",
        runId: job.data.runId,
        status: "FAILED",
        progress: 100,
        errorCode: "AI_ANALYSIS_FAILED",
        errorMessage: "تعذر إكمال التحليل الآلي بعد عدة محاولات.",
        results: [], gaps: [], groups: [], plans: [],
      }).catch((callbackError) => console.error("Final failure callback failed", callbackError));
    }
  });

  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    if (request.method === "GET" && path === "/health") {
      const configured = config.AI_ANALYZER_MODE === "fixture" || Boolean(config.GOOGLE_GENERATIVE_AI_API_KEY);
      return json(response, 200, {
        status: configured ? "ok" : "degraded",
        mode: config.AI_ANALYZER_MODE,
        provider: "google",
        model: config.AI_MODEL,
        configured,
      });
    }
    if (request.method !== "POST" || path !== "/v1/jobs") return json(response, 404, { error: "not found" });
    if (config.AI_ANALYZER_MODE === "gemini" && !config.GOOGLE_GENERATIVE_AI_API_KEY) {
      return json(response, 503, { error: "Gemini API key is not configured" });
    }
    try {
      const rawBody = await readBody(request);
      const timestamp = String(request.headers["x-basira-timestamp"] ?? "");
      const nonce = String(request.headers["x-basira-nonce"] ?? "");
      const signature = String(request.headers["x-basira-signature"] ?? "");
      if (request.headers["x-basira-key-id"] !== "v1" || !verifySignature(rawBody, timestamp, nonce, signature)) {
        return json(response, 401, { error: "invalid signature" });
      }
      const freshNonce = await queueConnection.set(`basira:ai:nonce:${nonce}`, "1", "EX", 600, "NX");
      if (!freshNonce) return json(response, 409, { error: "replayed request" });
      const parsed = analysisJobV1.safeParse(JSON.parse(rawBody));
      if (!parsed.success) return json(response, 422, { error: "invalid contract", issues: parsed.error.issues });
      const existing = await queue.getJob(parsed.data.runId);
      if (existing) return json(response, 202, { jobId: exposedJobId(existing.id), status: "duplicate" });
      const queued = await queue.add("analyze", parsed.data, {
        jobId: parsed.data.runId,
        attempts: 3,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: { age: 86_400, count: 500 },
        removeOnFail: { age: 604_800, count: 500 },
      });
      return json(response, 202, { jobId: exposedJobId(queued.id), status: "queued" });
    } catch (error) {
      console.error("AI analyzer request failed", error);
      return json(response, 400, { error: "invalid request" });
    }
  });

  server.listen(config.PORT, "0.0.0.0", () => {
    console.log(`Basira AI analyzer listening on ${config.PORT} (${config.AI_ANALYZER_MODE}/${config.AI_MODEL})`);
  });

  const shutdown = async () => {
    server.close();
    await Promise.all([worker.close(), queue.close(), queueConnection.quit(), workerConnection.quit()]);
    process.exit(0);
  };
  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());
}

if (process.env.NODE_ENV !== "test") {
  void start().catch((error) => {
    console.error("AI analyzer failed to start", error);
    process.exit(1);
  });
}
