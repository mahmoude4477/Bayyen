import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";
import { resolveNafsAlignment } from "@/lib/nafs";
import { apiError, requireApiUser, requestIp } from "@/lib/server/api";
import { env } from "@/lib/server/env";
import { rateLimit } from "@/lib/server/rate-limit";

const requestSchema = z.object({
  title: z.string().trim().min(3).max(120),
  subject: z.string().trim().min(2).max(80),
  grade: z.string().trim().min(2).max(80),
  objectives: z.array(z.object({
    code: z.string().trim().min(1).max(20),
    title: z.string().trim().min(3).max(240),
  })).min(1).max(20),
  blueprint: z.object({
    MULTIPLE_CHOICE: z.number().int().min(0).max(10),
    SHORT_ANSWER: z.number().int().min(0).max(10),
    INK: z.number().int().min(0).max(10),
  }),
}).superRefine((input, context) => {
  const total = Object.values(input.blueprint).reduce((sum, count) => sum + count, 0);
  if (total < 5 || total > 10) {
    context.addIssue({ code: "custom", path: ["blueprint"], message: "يجب أن يكون مجموع الأسئلة من ٥ إلى ١٠." });
  }
});

const generatedQuestionSchema = z.object({
  slot: z.number().int().min(1).max(10),
  objectiveCode: z.string(),
  prompt: z.string().min(3).max(1000),
  choices: z.array(z.string().min(1).max(240)).max(4),
  answerKey: z.string().min(1).max(1000),
  rubric: z.string().min(1).max(2000),
});

const generatedAssessmentSchema = z.object({
  questions: z.array(generatedQuestionSchema).min(5).max(10),
});

type QuestionType = "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "INK";

function buildSlots(blueprint: z.infer<typeof requestSchema>["blueprint"]) {
  const remaining = { ...blueprint };
  const order: QuestionType[] = ["MULTIPLE_CHOICE", "SHORT_ANSWER", "INK"];
  const slots: QuestionType[] = [];
  while (Object.values(remaining).some((count) => count > 0)) {
    for (const type of order) {
      if (remaining[type] > 0) {
        slots.push(type);
        remaining[type] -= 1;
      }
    }
  }
  return slots;
}

function uniqueChoices(choices: string[]) {
  const seen = new Set<string>();
  return choices.reduce<string[]>((items, choice) => {
    const trimmed = choice.trim();
    const key = trimmed.normalize("NFKC").toLocaleLowerCase("ar");
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      items.push(trimmed);
    }
    return items;
  }, []);
}

function isQuotaError(error: unknown, seen = new Set<unknown>()): boolean {
  if (!error || typeof error !== "object" || seen.has(error)) return false;
  seen.add(error);
  const candidate = error as {
    statusCode?: number;
    message?: string;
    cause?: unknown;
    errors?: unknown[];
    lastError?: unknown;
  };
  if (candidate.statusCode === 429 || /quota|resource_exhausted/i.test(candidate.message ?? "")) return true;
  return isQuotaError(candidate.cause, seen)
    || isQuotaError(candidate.lastError, seen)
    || (candidate.errors ?? []).some((item) => isQuotaError(item, seen));
}

function normalizeQuestions(
  generated: z.infer<typeof generatedAssessmentSchema>,
  slots: QuestionType[],
  objectiveCodes: Set<string>,
  objectives: z.infer<typeof requestSchema>["objectives"],
) {
  const bySlot = new Map(generated.questions.map((question) => [question.slot, question]));
  const prompts = new Set<string>();
  return slots.map((type, index) => {
    const generatedQuestion = bySlot.get(index + 1);
    if (!generatedQuestion) throw new Error(`Gemini omitted question slot ${index + 1}`);
    const promptKey = generatedQuestion.prompt.trim().normalize("NFKC").toLocaleLowerCase("ar");
    if (prompts.has(promptKey)) throw new Error(`Gemini duplicated question slot ${index + 1}`);
    prompts.add(promptKey);

    const objectiveCode = objectiveCodes.has(generatedQuestion.objectiveCode)
      ? generatedQuestion.objectiveCode
      : objectives[index % objectives.length].code;
    let choices = type === "MULTIPLE_CHOICE" ? uniqueChoices(generatedQuestion.choices) : [];
    const answerKey = generatedQuestion.answerKey.trim();
    if (type === "MULTIPLE_CHOICE" && !choices.includes(answerKey)) choices = uniqueChoices([answerKey, ...choices]).slice(0, 4);
    if (type === "MULTIPLE_CHOICE" && choices.length !== 4) throw new Error(`Gemini returned invalid choices for slot ${index + 1}`);
    return {
      type,
      objectiveCode,
      prompt: generatedQuestion.prompt.trim(),
      choices,
      answerKey,
      rubric: generatedQuestion.rubric.trim(),
    };
  });
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const ip = requestIp(request) ?? "unknown";
    const limit = await rateLimit(`assessment:generate:${user.id}:${ip}`, 20, 3600);
    if (!limit.allowed) return Response.json({ error: "تجاوزت حد توليد الاختبارات المؤقت. حاول لاحقًا." }, { status: 429 });
    if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return Response.json({ error: "مفتاح Gemini غير مهيأ لتوليد الأسئلة." }, { status: 503 });
    }

    const input = requestSchema.parse(await request.json());
    const alignment = resolveNafsAlignment(input);
    const slots = buildSlots(input.blueprint);
    const objectiveCodes = new Set(input.objectives.map((objective) => objective.code));
    const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY });

    const modelNames = [...new Set([
      env.AI_MODEL,
      ...env.AI_FALLBACK_MODELS.split(",").map((model) => model.trim()).filter(Boolean),
    ])];
    const failures: unknown[] = [];
    let questions: ReturnType<typeof normalizeQuestions> | undefined;
    let generatedBy = "";

    for (const modelName of modelNames) {
      try {
        const { output } = await generateText({
          model: google(modelName),
          instructions: [
            "أنت مصمم اختبارات تشخيصية سعودي خبير في القياس التربوي. أنشئ أسئلة عربية واضحة ومناسبة للصف المحدد، وتجنب الغموض والتكرار والتحيز.",
            "التزم حرفيًا بنوع كل خانة وعددها، واربط كل سؤال برمز هدف موجود. وزع الأسئلة على أكبر عدد ممكن من الأهداف والفروع، ونوع المستويات بين المعرفة والتطبيق والاستدلال.",
            "للاختيار من متعدد اكتب أربعة بدائل قصيرة متمايزة وإجابة صحيحة واحدة فقط، واجعل answerKey مطابقًا حرفيًا لأحد البدائل. للأسئلة المفتوحة والرسمية أعد choices فارغة واكتب مفتاح إجابة وسلمًا موجزًا قابلًا للتصحيح.",
            alignment.enabled
              ? `الأهداف مستندة إلى ${alignment.framework}. هذه أسئلة جديدة مولدة ومتوافقة مع النواتج وليست أسئلة نافس رسمية أو مسربة، ولا يجوز وصفها بذلك.`
              : "هذه أسئلة جديدة مولدة من أهداف المعلم وليست أسئلة رسمية من جهة تقويمية.",
          ].join(" "),
          prompt: JSON.stringify({
            assessment: { title: input.title, subject: alignment.subject, grade: input.grade },
            objectives: input.objectives,
            slots: slots.map((type, index) => ({ slot: index + 1, type })),
            source: alignment.enabled ? { framework: alignment.framework, referenceUrl: alignment.referenceUrl } : null,
          }),
          output: Output.object({ schema: generatedAssessmentSchema }),
          maxOutputTokens: 7_000,
          maxRetries: 0,
          timeout: { totalMs: 60_000 },
          include: { requestBody: false, responseBody: false },
        });
        questions = normalizeQuestions(output, slots, objectiveCodes, input.objectives);
        generatedBy = modelName;
        break;
      } catch (error) {
        failures.push(error);
        console.warn(`Gemini assessment generation failed with ${modelName}`, error);
      }
    }

    if (!questions) {
      if (failures.some((error) => isQuotaError(error))) {
        return Response.json({ error: "اكتملت حصة Gemini المتاحة حاليًا لجميع النماذج. فعّل الفوترة في Google AI Studio أو حاول بعد تجدد الحصة." }, { status: 429 });
      }
      return Response.json({ error: "تعذر توليد الأسئلة عبر Gemini الآن. يمكنك المحاولة مجددًا دون فقد إعداداتك." }, { status: 502 });
    }

    return Response.json({ questions, generatedBy, alignedWithNafs: alignment.enabled });
  } catch (error) {
    return apiError(error);
  }
}
