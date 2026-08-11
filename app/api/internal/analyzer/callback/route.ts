import { analysisCallbackV1 } from "@/packages/contracts/analysis-job.v1";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { verifyBody } from "@/lib/server/hmac";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-basira-timestamp") ?? "";
  const nonce = request.headers.get("x-basira-nonce") ?? "";
  const signature = request.headers.get("x-basira-signature") ?? "";
  const keyId = request.headers.get("x-basira-key-id") ?? "";
  if (keyId !== "v1" || !verifyBody({ rawBody, timestamp, nonce, signature, key: env.PYTHON_TO_WEB_HMAC_KEYS })) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }
  const replay = await db.callbackNonce.findUnique({ where: { nonce } });
  if (replay) return Response.json({ error: "replayed callback" }, { status: 409 });
  await db.callbackNonce.create({ data: { nonce, keyId, expiresAt: new Date(Date.now() + 10 * 60_000) } });

  const parsed = analysisCallbackV1.safeParse(JSON.parse(rawBody));
  if (!parsed.success) return Response.json({ error: "invalid contract", issues: parsed.error.issues }, { status: 422 });
  const payload = parsed.data;
  const run = await db.analysisRun.findUnique({
    where: { id: payload.runId },
    include: { session: { include: { students: true, questions: true, formSubmissions: { select: { studentId: true } } } }, _count: { select: { results: true } } },
  });
  if (!run) return Response.json({ error: "run not found" }, { status: 404 });
  if (!["QUEUED", "PROCESSING"].includes(run.status) && run.progress === 100) {
    return Response.json({ runId: run.id, duplicate: true });
  }

  if (payload.status === "PROCESSING") {
    await db.$transaction([
      db.analysisRun.update({ where: { id: run.id }, data: { status: "PROCESSING", progress: payload.progress, startedAt: run.startedAt ?? new Date() } }),
      db.analysisEvent.create({ data: { runId: run.id, type: "PROCESSING", payload: { progress: payload.progress } } }),
    ]);
    return Response.json({ runId: run.id, accepted: true });
  }

  const students = new Map(run.session.students.map((student) => [student.code, student.id]));
  const questionIds = new Set(run.session.questions.map((question) => question.id));
  if (payload.results.some((result) => !students.has(result.studentCode) || !questionIds.has(result.questionId))) {
    return Response.json({ error: "result ownership mismatch" }, { status: 422 });
  }
  const nextSessionStatus = payload.status === "FAILED" ? "FAILED" : payload.status === "PARTIAL" ? "PARTIAL" : payload.status === "COMPLETED" ? "COMPLETED" : "REVIEW";
  const population = run.session.inputMode === "FORM" ? run.session.formSubmissions.length : run.session.students.length;

  await db.$transaction(async (tx) => {
    await tx.answerResult.deleteMany({ where: { runId: run.id } });
    await tx.learningGap.deleteMany({ where: { runId: run.id } });
    await tx.studentGroup.deleteMany({ where: { runId: run.id } });
    if (payload.results.length) {
      await tx.answerResult.createMany({ data: payload.results.map((result) => ({
        runId: run.id,
        studentId: students.get(result.studentCode)!,
        questionId: result.questionId,
        extractedAnswer: result.extractedAnswer,
        mastery: result.mastery,
        score: result.score,
        confidence: result.confidence,
        needsReview: result.needsReview,
      })) });
    }
    for (const gap of payload.gaps) {
      await tx.learningGap.create({ data: {
        runId: run.id, slug: gap.slug, title: gap.title, description: gap.description,
        affectedCount: gap.affectedCodes.length, population,
        confidence: gap.confidence, evidence: gap.evidence, color: gap.color, rank: gap.rank,
        students: { create: gap.affectedCodes.filter((code) => students.has(code)).map((code) => ({ studentId: students.get(code)! })) },
      } });
    }
    for (const group of payload.groups) {
      const created = await tx.studentGroup.create({ data: {
        sessionId: run.sessionId, runId: run.id, key: group.key, label: group.label,
        title: group.title, description: group.description, color: group.color,
        members: { create: group.members.filter((member) => students.has(member.studentCode)).map((member) => ({ studentId: students.get(member.studentCode)!, reason: member.reason })) },
      } });
      const plan = payload.plans.find((item) => item.groupKey === group.key);
      if (plan) await tx.interventionPlan.create({ data: {
        groupId: created.id, version: 1, objective: plan.objective, duration: plan.duration,
        teacherSteps: plan.teacherSteps, explanation: plan.explanation, example: plan.example,
        activity: plan.activity, practice: plan.practice, exitTicket: plan.exitTicket, adaptations: plan.adaptations,
      } });
    }
    await tx.analysisRun.update({ where: { id: run.id }, data: {
      status: payload.status, progress: payload.progress, errorCode: payload.errorCode,
      errorMessage: payload.errorMessage, completedAt: payload.progress === 100 ? new Date() : null,
    } });
    await tx.analysisSession.update({ where: { id: run.sessionId }, data: { status: nextSessionStatus } });
    await tx.analysisEvent.create({ data: { runId: run.id, type: payload.status, payload: { progress: payload.progress, resultCount: payload.results.length } } });
  });
  return Response.json({ runId: run.id, accepted: true });
}
