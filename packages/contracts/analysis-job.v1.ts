import { z } from "zod";

export const analysisJobV1 = z.object({
  schemaVersion: z.literal("analysis-job.v1"),
  runId: z.string().min(1),
  analysisId: z.string().min(1),
  callbackUrl: z.string().url(),
  locale: z.literal("ar"),
  context: z.object({
    title: z.string(),
    subject: z.string(),
    grade: z.string(),
    objectives: z.array(z.object({ code: z.string(), title: z.string() })),
    nafsAlignment: z.object({
      enabled: z.literal(true),
      framework: z.string(),
      domain: z.string(),
      referenceUrl: z.string().url(),
    }).optional(),
  }).optional(),
  questions: z.array(z.object({
    id: z.string(),
    type: z.enum(["SHORT_ANSWER", "MULTIPLE_CHOICE", "INK"]).optional(),
    prompt: z.string(),
    answerKey: z.string(),
    rubric: z.string().nullable(),
    choices: z.array(z.string()).optional().default([]),
    objectiveCode: z.string(),
  })).min(5).max(10),
  submissions: z.array(z.object({
    assetId: z.string(),
    studentId: z.string(),
    studentCode: z.string(),
    downloadUrl: z.string().url(),
    contentType: z.string(),
    checksum: z.string().nullable(),
  })).min(1),
});

const answerResult = z.object({
  studentCode: z.string(),
  questionId: z.string(),
  extractedAnswer: z.string(),
  mastery: z.enum(["MASTERED", "PARTIAL", "NOT_MASTERED", "UNREADABLE"]),
  score: z.number().min(0).max(1).nullable(),
  confidence: z.number().min(0).max(1),
  needsReview: z.boolean(),
});

export const analysisCallbackV1 = z.object({
  schemaVersion: z.literal("analysis-result.v1"),
  runId: z.string().min(1),
  status: z.enum(["PROCESSING", "REVIEW", "COMPLETED", "PARTIAL", "FAILED"]),
  progress: z.number().int().min(0).max(100),
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  results: z.array(answerResult).default([]),
  gaps: z.array(z.object({
    slug: z.string(), title: z.string(), description: z.string(), affectedCodes: z.array(z.string()),
    confidence: z.number().min(0).max(1), evidence: z.string(), color: z.string(), rank: z.number().int(),
  })).default([]),
  groups: z.array(z.object({
    key: z.string(), label: z.string(), title: z.string(), description: z.string(), color: z.string(),
    members: z.array(z.object({ studentCode: z.string(), reason: z.string() })),
  })).default([]),
  plans: z.array(z.object({
    groupKey: z.string(), objective: z.string(), duration: z.string(), teacherSteps: z.array(z.string()),
    explanation: z.string(), example: z.string(), activity: z.string(), practice: z.array(z.string()),
    exitTicket: z.array(z.object({ question: z.string(), answer: z.string() })),
    adaptations: z.record(z.string(), z.string()),
  })).default([]),
});

export type AnalysisJobV1 = z.infer<typeof analysisJobV1>;
export type AnalysisCallbackV1 = z.infer<typeof analysisCallbackV1>;
