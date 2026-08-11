import "server-only";
import { randomBytes } from "node:crypto";
import { analysisJobV1 } from "@/packages/contracts/analysis-job.v1";
import { NAFS_OUTCOMES_URL } from "@/lib/nafs";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { analyzeFormRun } from "@/lib/server/form-analyzer";
import { signBody } from "@/lib/server/hmac";
import { presignDownload } from "@/lib/server/storage";

export async function dispatchAnalysisRun(runId: string) {
  const run = await db.analysisRun.findUniqueOrThrow({
    where: { id: runId },
    include: {
      session: {
        include: {
          questions: { orderBy: { position: "asc" }, include: { objective: true } },
          assets: { where: { status: "MAPPED" }, include: { student: true } },
        },
      },
    },
  });
  if (run.session.inputMode === "FORM") return analyzeFormRun(runId);
  const submissions = await Promise.all(run.session.assets.map(async (asset) => ({
    assetId: asset.id,
    studentId: asset.studentId!,
    studentCode: asset.student!.code,
    downloadUrl: await presignDownload(asset.objectKey),
    contentType: asset.contentType,
    checksum: asset.checksum,
  })));
  const job = analysisJobV1.parse({
    schemaVersion: "analysis-job.v1",
    runId: run.id,
    analysisId: run.sessionId,
    callbackUrl: `${env.CALLBACK_BASE_URL}/api/internal/analyzer/callback`,
    locale: "ar",
    context: {
      title: run.session.title,
      subject: run.session.subject,
      grade: run.session.grade,
      objectives: run.session.questions.reduce<{ code: string; title: string }[]>((items, question) => items.some((item) => item.code === question.objective.code) ? items : [...items, { code: question.objective.code, title: question.objective.title }], []),
      nafsAlignment: run.session.nafsAligned && run.session.nafsDomain && run.session.nafsFramework ? {
        enabled: true as const,
        framework: run.session.nafsFramework,
        domain: run.session.nafsDomain,
        referenceUrl: NAFS_OUTCOMES_URL,
      } : undefined,
    },
    questions: run.session.questions.map((question) => ({
      id: question.id, type: question.type, prompt: question.prompt, answerKey: question.answerKey,
      rubric: question.rubric,
      choices: Array.isArray(question.choices) ? question.choices.filter((choice): choice is string => typeof choice === "string") : [],
      objectiveCode: question.objective.code,
    })),
    submissions,
  });
  const rawBody = JSON.stringify(job);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(16).toString("hex");
  const analyzerUrl = env.ANALYZER_BACKEND === "ai-sdk"
    ? env.AI_ANALYZER_URL
    : env.PYTHON_ANALYZER_URL;
  const response = await fetch(`${analyzerUrl}/v1/jobs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-basira-key-id": "v1",
      "x-basira-timestamp": timestamp,
      "x-basira-nonce": nonce,
      "x-basira-signature": signBody(rawBody, env.WEB_TO_PYTHON_HMAC_KEYS, timestamp, nonce),
    },
    body: rawBody,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Analyzer rejected the job (${response.status})`);
  const result = await response.json() as { jobId: string };
  await db.$transaction([
    db.analysisRun.update({ where: { id: run.id }, data: { analyzerJobId: result.jobId } }),
    db.outboxEvent.updateMany({ where: { aggregateId: run.id, processedAt: null }, data: { processedAt: new Date() } }),
  ]);
  return result;
}
