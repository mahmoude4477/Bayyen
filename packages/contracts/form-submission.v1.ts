import { z } from "zod";

const pointSchema = z.tuple([z.number(), z.number(), z.number().min(0).max(1)]);
const strokeSchema = z.object({
  raw: z.array(pointSchema).min(1).max(2500),
  corrected: z.array(pointSchema).min(1).max(2500),
  snapped: z.boolean(),
});

export const formAnswerV1 = z.object({
  questionId: z.string().min(1),
  type: z.enum(["SHORT_ANSWER", "MULTIPLE_CHOICE", "INK"]),
  text: z.string().trim().max(4000).optional(),
  strokes: z.array(strokeSchema).max(50).optional(),
}).superRefine((answer, context) => {
  if (answer.type === "INK" && !answer.strokes?.length) {
    context.addIssue({ code: "custom", path: ["strokes"], message: "إجابة الرسم مطلوبة." });
  }
  if (answer.type !== "INK" && !answer.text) {
    context.addIssue({ code: "custom", path: ["text"], message: "الإجابة النصية مطلوبة." });
  }
});

export const formSubmissionPayloadV1 = z.object({
  schemaVersion: z.literal("form-submission.v1").default("form-submission.v1"),
  studentName: z.string().trim().min(2).max(80),
  answers: z.array(formAnswerV1).min(5).max(10),
});

export type FormSubmissionPayloadV1 = z.infer<typeof formSubmissionPayloadV1>;
