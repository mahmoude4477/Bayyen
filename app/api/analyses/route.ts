import { z } from "zod";
import { REQUIRED_STUDENT_COUNT, studentCode } from "@/lib/analysis-config";
import { resolveNafsAlignment } from "@/lib/nafs";
import { apiError, ApiError, requireApiUser, requestIp } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";
import { STORAGE_DISABLED_MESSAGE, STORAGE_ENABLED } from "@/lib/storage-config";

const createSchema = z.object({
  inputMode: z.enum(["FORM", "PDF"]).default("FORM"),
  title: z.string().trim().min(3).max(120),
  subject: z.string().trim().min(2).max(80),
  grade: z.string().trim().min(2).max(80),
  classroom: z.string().trim().min(1).max(80),
  objectives: z.array(z.object({ code: z.string().trim().min(1).max(20), title: z.string().trim().min(3).max(240) })).min(1).max(20),
  questions: z.array(z.object({
    objectiveCode: z.string(),
    type: z.enum(["SHORT_ANSWER", "MULTIPLE_CHOICE", "INK"]),
    prompt: z.string().trim().min(3).max(1000),
    answerKey: z.string().trim().min(1).max(1000),
    rubric: z.string().trim().max(2000).nullable().optional(),
    choices: z.array(z.string().trim().min(1).max(240)).max(4).optional().default([]),
  })).min(5).max(10),
}).superRefine((input, context) => {
  input.questions.forEach((question, index) => {
    if (question.type === "MULTIPLE_CHOICE" && question.choices.length !== 4) {
      context.addIssue({ code: "custom", path: ["questions", index, "choices"], message: "سؤال الاختيار من متعدد يحتاج أربعة بدائل." });
    }
    if (question.type === "MULTIPLE_CHOICE" && !question.choices.includes(question.answerKey)) {
      context.addIssue({ code: "custom", path: ["questions", index, "answerKey"], message: "الإجابة الصحيحة يجب أن تطابق أحد البدائل." });
    }
  });
});

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const analyses = await db.analysisSession.findMany({
      where: { ownerId: user.id },
      select: { id: true, title: true, subject: true, grade: true, status: true, updatedAt: true, _count: { select: { assets: true, runs: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return Response.json({ analyses });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const ip = requestIp(request) ?? "unknown";
    const limit = await rateLimit(`analysis:create:${user.id}:${ip}`, 10, 3600);
    if (!limit.allowed) return Response.json({ error: "تجاوزت حد إنشاء الجلسات المؤقت." }, { status: 429 });
    const input = createSchema.parse(await request.json());
    if (input.inputMode === "PDF" && !STORAGE_ENABLED) {
      throw new ApiError(503, STORAGE_DISABLED_MESSAGE, "STORAGE_DISABLED");
    }
    const nafsAlignment = resolveNafsAlignment(input);
    const objectiveCodes = new Set(input.objectives.map((item) => item.code));
    if (input.questions.some((item) => !objectiveCodes.has(item.objectiveCode))) {
      return Response.json({ error: "كل سؤال يجب أن يرتبط بهدف موجود.", code: "OBJECTIVE_MISMATCH" }, { status: 422 });
    }
    const analysis = await db.analysisSession.create({
      data: {
        ownerId: user.id, title: input.title, subject: nafsAlignment.subject, grade: input.grade, classroom: input.classroom,
        nafsAligned: nafsAlignment.enabled,
        nafsDomain: nafsAlignment.domain,
        nafsFramework: nafsAlignment.framework,
        inputMode: input.inputMode,
        publishedAt: input.inputMode === "FORM" ? new Date() : null,
        students: input.inputMode === "PDF" ? { create: Array.from({ length: REQUIRED_STUDENT_COUNT }, (_, index) => ({ code: studentCode(index) })) } : undefined,
        objectives: { create: input.objectives.map((item, index) => ({ ...item, position: index + 1 })) },
      },
      include: { objectives: true },
    });
    const objectives = new Map(analysis.objectives.map((item) => [item.code, item.id]));
    await db.question.createMany({ data: input.questions.map((item, index) => ({
      sessionId: analysis.id, objectiveId: objectives.get(item.objectiveCode)!, type: item.type,
      prompt: item.prompt, answerKey: item.answerKey, rubric: item.rubric, choices: item.choices, position: index + 1,
    })) });
    await audit({ actorId: user.id, action: "analysis.created", entityType: "AnalysisSession", entityId: analysis.id, metadata: { questionCount: input.questions.length, nafsAligned: nafsAlignment.enabled, nafsDomain: nafsAlignment.domain }, ipAddress: ip });
    return Response.json({ analysisId: analysis.id, status: "DRAFT", inputMode: input.inputMode }, { status: 201 });
  } catch (error) { return apiError(error); }
}
