import { beforeAll, describe, expect, it } from "vitest";
import { analysisCallbackV1, analysisJobV1 } from "@/packages/contracts/analysis-job.v1";

type AnalyzerModule = typeof import("@/services/ai-analyzer/src/server");
let buildFixtureAnalysis: AnalyzerModule["buildFixtureAnalysis"];

beforeAll(async () => {
  process.env.WEB_TO_PYTHON_HMAC_KEYS = "test-web-to-analyzer-key-with-entropy";
  process.env.PYTHON_TO_WEB_HMAC_KEYS = "test-analyzer-to-web-key-with-entropy";
  process.env.AI_ANALYZER_MODE = "fixture";
  ({ buildFixtureAnalysis } = await import("@/services/ai-analyzer/src/server"));
}, 30_000);

describe("AI analyzer adapter", () => {
  const job = analysisJobV1.parse({
    schemaVersion: "analysis-job.v1",
    runId: "run-ai-1",
    analysisId: "analysis-1",
    callbackUrl: "https://web.test/callback",
    locale: "ar",
    questions: Array.from({ length: 5 }, (_, index) => ({
      id: `q${index + 1}`,
      prompt: `السؤال ${index + 1}`,
      answerKey: "إجابة صحيحة",
      rubric: null,
      objectiveCode: `OBJ-${index + 1}`,
    })),
    submissions: Array.from({ length: 6 }, (_, index) => ({
      assetId: `asset-${index + 1}`,
      studentId: `student-${index + 1}`,
      studentCode: `S-${String(index + 1).padStart(3, "0")}`,
      downloadUrl: `https://storage.test/${index + 1}.pdf`,
      contentType: "application/pdf",
      checksum: null,
    })),
  });

  it("produces a callback-compatible result for every student and question", () => {
    const output = buildFixtureAnalysis(job);
    expect(output.results).toHaveLength(30);
    expect(() => analysisCallbackV1.parse({
      schemaVersion: "analysis-result.v1",
      runId: job.runId,
      status: "REVIEW",
      progress: 100,
      ...output,
    })).not.toThrow();
  });

  it("assigns every student once and creates a plan for every group", () => {
    const output = buildFixtureAnalysis(job);
    const members = output.groups.flatMap((group) => group.members.map((member) => member.studentCode));
    expect(output.groups.map((group) => group.key)).toEqual(["foundation", "practice", "mastery"]);
    expect(new Set(members).size).toBe(job.submissions.length);
    expect(members).toHaveLength(job.submissions.length);
    expect(output.plans.map((plan) => plan.groupKey)).toEqual(output.groups.map((group) => group.key));
  });
});
