import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";
import { buildPlanObjective, compactPlanFocus } from "@/lib/plan-objective";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { formSubmissionPayloadV1 } from "@/packages/contracts/form-submission.v1";

const scoredAnswerSchema = z.object({
  questionId: z.string(),
  extractedAnswer: z.string(),
  mastery: z.enum(["MASTERED", "PARTIAL", "NOT_MASTERED", "UNREADABLE"]),
  score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  needsReview: z.boolean(),
});

const studentOutputSchema = z.object({ answers: z.array(scoredAnswerSchema).min(1).max(10) });

const GROUP_SPECS = [
  { key: "foundation", label: "تأسيس", title: "بناء المفهوم الأساسي", color: "coral" },
  { key: "practice", label: "تدريب", title: "تدريب موجّه", color: "amber" },
  { key: "mastery", label: "إتقان", title: "تطبيق ونقل أثر التعلم", color: "teal" },
] as const;

function normalizeAnswer(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ar");
}

function groupKey(average: number) {
  return average < 0.5 ? "foundation" : average < 0.8 ? "practice" : "mastery";
}

export async function analyzeFormRun(runId: string) {
  if (!env.GOOGLE_GENERATIVE_AI_API_KEY) throw new Error("مفتاح Gemini غير مهيأ لتحليل الإجابات.");
  const run = await db.analysisRun.findUniqueOrThrow({
    where: { id: runId },
    include: {
      session: {
        include: {
          objectives: { orderBy: { position: "asc" } },
          questions: { orderBy: { position: "asc" }, include: { objective: true } },
          students: true,
          formSubmissions: { orderBy: { submittedAt: "asc" }, include: { student: true } },
        },
      },
    },
  });
  if (run.session.inputMode !== "FORM") throw new Error("التشغيل ليس لنموذج رقمي.");

  const submissions = run.session.formSubmissions.map((submission) => ({
    submission,
    payload: formSubmissionPayloadV1.parse(submission.payload),
  }));
  if (!submissions.length) throw new Error("لا توجد إجابات مكتملة لتحليلها.");

  const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY });
  const modelNames = [...new Set([env.AI_MODEL, ...env.AI_FALLBACK_MODELS.split(",").map((name) => name.trim()).filter(Boolean)])];
  const results: {
    studentCode: string;
    questionId: string;
    extractedAnswer: string;
    mastery: "MASTERED" | "PARTIAL" | "NOT_MASTERED" | "UNREADABLE";
    score: number | null;
    confidence: number;
    needsReview: boolean;
  }[] = [];

  async function analyzeSubmission(item: (typeof submissions)[number]) {
    const answers = new Map(item.payload.answers.map((answer) => [answer.questionId, answer]));
    const automatic = run.session.questions.filter((question) => question.type !== "SHORT_ANSWER").map((question) => {
      const answer = answers.get(question.id);
      if (question.type === "MULTIPLE_CHOICE" && answer?.text) {
        const mastered = normalizeAnswer(answer.text) === normalizeAnswer(question.answerKey);
        return {
          studentCode: item.submission.student.code,
          questionId: question.id,
          extractedAnswer: answer.text,
          mastery: mastered ? "MASTERED" as const : "NOT_MASTERED" as const,
          score: mastered ? 1 : 0,
          confidence: 1,
          needsReview: false,
        };
      }
      return {
        studentCode: item.submission.student.code,
        questionId: question.id,
        extractedAnswer: "إجابة رسم محفوظة وتحتاج مراجعة المعلم",
        mastery: "UNREADABLE" as const,
        score: null,
        confidence: 0,
        needsReview: true,
      };
    });
    const openQuestions = run.session.questions.filter((question) => question.type === "SHORT_ANSWER");
    if (!openQuestions.length) return automatic;

    const prompt = {
      context: { title: run.session.title, subject: run.session.subject, grade: run.session.grade },
      questions: openQuestions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        answerKey: question.answerKey,
        rubric: question.rubric,
        objective: question.objective.title,
      })),
      studentAnswers: openQuestions.map((question) => ({
        questionId: question.id,
        answer: answers.get(question.id)?.text ?? "",
      })),
    };
    const failures: unknown[] = [];
    for (const modelName of modelNames) {
      try {
        const { output } = await generateText({
          model: google(modelName),
          instructions: "صحح الإجابات العربية بدقة وفق مفتاح الإجابة وسلم المعلم. اقبل الصياغات المكافئة التي تحقق المعنى، ولا تضف معلومة غير موجودة. أعد نتيجة واحدة لكل questionId. اجعل needsReview صحيحًا عند الغموض أو انخفاض الثقة عن 0.7.",
          prompt: JSON.stringify(prompt),
          output: Output.object({ schema: studentOutputSchema }),
          maxOutputTokens: 3_500,
          maxRetries: 0,
          timeout: { totalMs: 45_000 },
          include: { requestBody: false, responseBody: false },
        });
        const byQuestion = new Map(output.answers.map((answer) => [answer.questionId, answer]));
        const analyzed = openQuestions.map((question) => {
          const answer = byQuestion.get(question.id);
          if (!answer) throw new Error(`Gemini omitted question ${question.id}`);
          const confidence = Math.min(1, Math.max(0, answer.confidence));
          return {
            studentCode: item.submission.student.code,
            questionId: question.id,
            extractedAnswer: answer.extractedAnswer,
            mastery: answer.mastery,
            score: answer.mastery === "UNREADABLE" ? null : answer.score,
            confidence,
            needsReview: answer.needsReview || confidence < 0.7 || answer.mastery === "UNREADABLE",
          };
        });
        return [...automatic, ...analyzed];
      } catch (error) {
        failures.push(error);
        console.warn(`Inline form analysis failed with ${modelName}`, error);
      }
    }
    throw new AggregateError(failures, "تعذر تحليل الإجابات عبر نماذج Gemini المتاحة.");
  }

  let cursor = 0;
  async function worker() {
    while (cursor < submissions.length) {
      const item = submissions[cursor++];
      results.push(...await analyzeSubmission(item));
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, submissions.length) }, () => worker()));

  const studentIds = new Map(run.session.students.map((student) => [student.code, student.id]));
  const scores = new Map(submissions.map(({ submission }) => [submission.student.code, [] as number[]]));
  for (const result of results) if (result.score !== null) scores.get(result.studentCode)?.push(result.score);
  const members = new Map(GROUP_SPECS.map((group) => [group.key, [] as { studentCode: string; reason: string }[]]));
  for (const { submission } of submissions) {
    const values = scores.get(submission.student.code) ?? [];
    const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const key = groupKey(average);
    const reason = key === "foundation" ? "يحتاج إلى تأسيس موجّه بناءً على متوسط الإجابات." : key === "practice" ? "أظهر إتقانًا جزئيًا ويحتاج إلى تدريب موجّه." : "أظهر إتقانًا متسقًا ويستفيد من التوسّع.";
    members.get(key)?.push({ studentCode: submission.student.code, reason });
  }
  const gaps = run.session.questions.map((question, index) => {
    const affected = results.filter((result) => result.questionId === question.id && result.mastery !== "MASTERED");
    return {
      slug: `${question.objective.code}-${index + 1}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
      title: `هدف التعلّم: ${question.objective.title}`,
      objectiveTitle: question.objective.title,
      description: `ظهر التعثر عند الإجابة عن: «${question.prompt}»`,
      affectedCodes: affected.map((result) => result.studentCode),
      confidence: affected.length ? affected.reduce((sum, result) => sum + result.confidence, 0) / affected.length : 1,
      evidence: `${affected.length} من ${submissions.length} طالبًا لم يصلوا إلى الإتقان الكامل في هذا السؤال.`,
      color: index === 0 ? "#cf6b43" : index === 1 ? "#d6a13f" : "#3b8278",
    };
  }).filter((gap) => gap.affectedCodes.length)
    .sort((left, right) => right.affectedCodes.length - left.affectedCodes.length)
    .slice(0, 5);
  const finalStatus = results.some((result) => result.needsReview) ? "REVIEW" : "COMPLETED";

  await db.$transaction(async (tx) => {
    await tx.answerResult.deleteMany({ where: { runId } });
    await tx.learningGap.deleteMany({ where: { runId } });
    await tx.studentGroup.deleteMany({ where: { runId } });
    await tx.answerResult.createMany({ data: results.map((result) => ({
      runId,
      studentId: studentIds.get(result.studentCode)!,
      questionId: result.questionId,
      extractedAnswer: result.extractedAnswer,
      mastery: result.mastery,
      score: result.score,
      confidence: result.confidence,
      needsReview: result.needsReview,
    })) });
    for (const [index, gap] of gaps.entries()) {
      await tx.learningGap.create({ data: {
        runId,
        slug: gap.slug,
        title: gap.title,
        description: gap.description,
        affectedCount: gap.affectedCodes.length,
        population: submissions.length,
        confidence: gap.confidence,
        evidence: gap.evidence,
        color: gap.color,
        rank: index + 1,
        students: { create: gap.affectedCodes.map((code) => ({ studentId: studentIds.get(code)! })) },
      } });
    }
    for (const group of GROUP_SPECS) {
      const groupMembers = members.get(group.key) ?? [];
      const memberCodes = new Set(groupMembers.map((member) => member.studentCode));
      const priorityGap = gaps.find((gap) => gap.affectedCodes.some((code) => memberCodes.has(code)));
      const focus = compactPlanFocus(priorityGap?.objectiveTitle ?? run.session.objectives[0]?.title, run.session.subject);
      const created = await tx.studentGroup.create({ data: {
        sessionId: run.sessionId,
        runId,
        key: group.key,
        label: group.label,
        title: group.title,
        description: `مجموعة ${group.label} المبنية على نتائج ${run.session.title}.`,
        color: group.color,
        members: { create: groupMembers.map((member) => ({ studentId: studentIds.get(member.studentCode)!, reason: member.reason })) },
      } });
      await tx.interventionPlan.create({ data: {
        groupId: created.id,
        version: 1,
        objective: buildPlanObjective(group.label, focus, run.session.subject),
        duration: "3 حصص × 25 دقيقة",
        teacherSteps: ["اعرض دليلًا من إجابات الاختبار.", "نمذج المهارة المستهدفة بخطوات قصيرة.", "تحقق بسؤال مستقل قبل الانتقال."],
        explanation: `شرح موجز يربط إجابات الطلاب بـ ${focus}.`,
        example: `مثال محلول في ${run.session.subject} ثم مثال موازٍ يشرحه الطلاب.`,
        activity: `نشاط ثنائي يطبق ${focus} مع تبادل الشرح والتحقق.`,
        practice: ["سؤال تمهيدي", "تطبيق موجّه", "تطبيق مستقل"],
        exitTicket: [{ question: `طبّق فكرة من ${focus} وفسّر إجابتك.`, answer: "إجابة صحيحة مدعومة بخطوات أو دليل." }],
        adaptations: { visual: "تمثيل بصري وخطوات مرقمة", language: "تعليمات مختصرة مع مفردات أساسية", enrichment: "موقف جديد يتطلب التبرير" },
      } });
    }
    await tx.analysisRun.update({ where: { id: runId }, data: { status: finalStatus, progress: 100, analyzerJobId: "inline-gemini", startedAt: run.startedAt ?? new Date(), completedAt: new Date() } });
    await tx.analysisSession.update({ where: { id: run.sessionId }, data: { status: finalStatus } });
    await tx.outboxEvent.updateMany({ where: { aggregateId: runId, processedAt: null }, data: { processedAt: new Date() } });
    await tx.analysisEvent.create({ data: { runId, type: finalStatus, payload: { progress: 100, resultCount: results.length, source: "database-form" } } });
  });
  return { jobId: "inline-gemini", status: finalStatus, progress: 100 };
}
