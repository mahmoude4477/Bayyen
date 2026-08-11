import { describe, expect, it } from "vitest";
import { analysisCallbackV1, analysisJobV1 } from "@/packages/contracts/analysis-job.v1";
import { formSubmissionPayloadV1 } from "@/packages/contracts/form-submission.v1";

describe("analysis contracts v1", () => {
  const questions = Array.from({ length: 5 }, (_, index) => ({ id: `q${index}`, prompt: "سؤال", answerKey: "إجابة", rubric: null, choices: [], objectiveCode: "OBJ-01" }));
  const submissions = [{ assetId: "a1", studentId: "s1", studentCode: "S-001", downloadUrl: "https://storage.test/a1", contentType: "application/pdf", checksum: null }];

  it("accepts a versioned analysis job", () => {
    expect(analysisJobV1.parse({ schemaVersion: "analysis-job.v1", runId: "r1", analysisId: "x1", callbackUrl: "https://web.test/callback", locale: "ar", questions, submissions }).runId).toBe("r1");
  });

  it("carries subject context and visual question types without assuming a lesson", () => {
    const parsed = analysisJobV1.parse({
      schemaVersion: "analysis-job.v1",
      runId: "r-context",
      analysisId: "x-context",
      callbackUrl: "https://web.test/callback",
      locale: "ar",
      context: {
        title: "اختبار مرن",
        subject: "الفيزياء",
        grade: "الصف الأول الثانوي",
        objectives: [{ code: "OBJ-01", title: "يفسر القوى" }],
      },
      questions: questions.map((question, index) => ({ ...question, type: index === 4 ? "INK" : "SHORT_ANSWER" })),
      submissions,
    });
    expect(parsed.context?.subject).toBe("الفيزياء");
    expect(parsed.questions[4].type).toBe("INK");
  });

  it("carries multiple-choice options to the analyzer", () => {
    const parsed = analysisJobV1.parse({
      schemaVersion: "analysis-job.v1",
      runId: "r-choices",
      analysisId: "x-choices",
      callbackUrl: "https://web.test/callback",
      locale: "ar",
      questions: questions.map((question, index) => index === 0 ? { ...question, type: "MULTIPLE_CHOICE", choices: ["أ", "ب", "ج", "د"], answerKey: "أ" } : question),
      submissions,
    });
    expect(parsed.questions[0].choices).toEqual(["أ", "ب", "ج", "د"]);
  });

  it("carries the NAFS framework into the analyzer context", () => {
    const parsed = analysisJobV1.parse({
      schemaVersion: "analysis-job.v1",
      runId: "r-nafs",
      analysisId: "x-nafs",
      callbackUrl: "https://web.test/callback",
      locale: "ar",
      context: {
        title: "اختبار القوى والحركة",
        subject: "العلوم",
        grade: "الصف السادس الابتدائي",
        objectives: [{ code: "OBJ-01", title: "يفسر أثر القوة" }],
        nafsAlignment: {
          enabled: true,
          framework: "وثيقة نواتج التعلم للاختبارات الوطنية 2026",
          domain: "العلوم الطبيعية · الصف السادس",
          referenceUrl: "https://media.etec.gov.sa/media/sszdnh2h/%D9%86%D9%88%D8%A7%D8%AA%D8%AC-%D8%A7%D9%84%D8%AA%D8%B9%D9%84%D9%85-2026.pdf",
        },
      },
      questions,
      submissions,
    });
    expect(parsed.context?.nafsAlignment?.domain).toBe("العلوم الطبيعية · الصف السادس");
  });

  it("accepts cohorts larger than the former 36-student limit", () => {
    const largeSubmissions = Array.from({ length: 50 }, (_, index) => ({
      ...submissions[0],
      assetId: `a-${index}`,
      studentId: `s-${index}`,
      studentCode: `S-${String(index + 1).padStart(3, "0")}`,
    }));
    expect(analysisJobV1.parse({ schemaVersion: "analysis-job.v1", runId: "r-large", analysisId: "x1", callbackUrl: "https://web.test/callback", locale: "ar", questions, submissions: largeSubmissions }).submissions).toHaveLength(50);
  });

  it("accepts a text-only form submission stored directly in the database", () => {
    const payload = formSubmissionPayloadV1.parse({
      schemaVersion: "form-submission.v1",
      studentName: "طالب تجريبي",
      answers: questions.map((question) => ({ questionId: question.id, type: "SHORT_ANSWER", text: "إجابة نصية" })),
    });
    expect(payload.answers).toHaveLength(questions.length);
    expect(payload.answers[0].text).toBe("إجابة نصية");
  });

  it("rejects an incomplete text form answer", () => {
    expect(() => formSubmissionPayloadV1.parse({
      schemaVersion: "form-submission.v1",
      studentName: "طالب تجريبي",
      answers: questions.map((question) => ({ questionId: question.id, type: "SHORT_ANSWER", text: "" })),
    })).toThrow();
  });

  it("rejects an unknown contract version", () => {
    expect(() => analysisJobV1.parse({ schemaVersion: "analysis-job.v2", runId: "r1", analysisId: "x1", callbackUrl: "https://web.test/callback", locale: "ar", questions, submissions })).toThrow();
  });

  it("requires confidence to stay within 0..1", () => {
    expect(() => analysisCallbackV1.parse({ schemaVersion: "analysis-result.v1", runId: "r1", status: "REVIEW", progress: 100, results: [{ studentCode: "S-001", questionId: "q1", extractedAnswer: "x", mastery: "PARTIAL", score: .5, confidence: 2, needsReview: true }], gaps: [], groups: [], plans: [] })).toThrow();
  });
});
