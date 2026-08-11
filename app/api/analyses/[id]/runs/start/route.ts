import { randomUUID } from "node:crypto";
import { formatArabicInteger } from "@/lib/analysis-config";
import { apiError, ApiError, requireOwnedAnalysis, requestIp } from "@/lib/server/api";
import { dispatchAnalysisRun } from "@/lib/server/analyzer";
import { audit } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { STORAGE_DISABLED_MESSAGE, STORAGE_ENABLED } from "@/lib/storage-config";

export const maxDuration = 60;

async function failRun(runId: string, sessionId: string) {
  const message = "تعذر تشغيل محلل الإجابات. حاول مرة أخرى.";
  await db.$transaction([
    db.analysisRun.update({ where: { id: runId }, data: { status: "FAILED", progress: 0, errorCode: "ANALYZER_START_FAILED", errorMessage: message, completedAt: new Date() } }),
    db.analysisSession.update({ where: { id: sessionId }, data: { status: "READY", lockedAt: null } }),
    db.outboxEvent.updateMany({ where: { aggregateId: runId, processedAt: null }, data: { attempts: { increment: 1 } } }),
    db.analysisEvent.create({ data: { runId, type: "FAILED", payload: { progress: 0, errorCode: "ANALYZER_START_FAILED" } } }),
  ]);
}

export async function POST(request: Request, context: RouteContext<"/api/analyses/[id]/runs/start">) {
  try {
    const { id } = await context.params;
    const { user, analysis: ownedAnalysis } = await requireOwnedAnalysis(request, id);
    if (ownedAnalysis.inputMode === "PDF" && !STORAGE_ENABLED) {
      throw new ApiError(503, STORAGE_DISABLED_MESSAGE, "STORAGE_DISABLED");
    }
    const current = await db.analysisRun.findFirst({ where: { sessionId: id, status: { in: ["QUEUED", "PROCESSING"] } }, orderBy: { version: "desc" } });
    if (current) {
      let dispatched = Boolean(current.analyzerJobId) || current.status === "PROCESSING";
      if (!dispatched) {
        try {
          await dispatchAnalysisRun(current.id);
          dispatched = true;
        } catch (error) {
          await failRun(current.id, id);
          console.error("Analyzer redispatch failed", error);
          throw new ApiError(502, "تعذر تحليل الإجابات عبر Gemini الآن. أعد المحاولة بعد قليل.", "ANALYZER_START_FAILED");
        }
      }
      const refreshed = await db.analysisRun.findUniqueOrThrow({ where: { id: current.id }, select: { status: true, progress: true } });
      return Response.json(
        { runId: current.id, status: refreshed.status, progress: refreshed.progress, duplicate: true, dispatched },
        { status: ["QUEUED", "PROCESSING"].includes(refreshed.status) ? 202 : 200 },
      );
    }
    const analysis = await db.analysisSession.findUniqueOrThrow({
      where: { id }, include: { questions: true, students: true, formSubmissions: { select: { studentId: true } }, assets: { where: { status: "MAPPED" } }, runs: { select: { version: true }, orderBy: { version: "desc" }, take: 1 } },
    });
    const expectedStudentCount = analysis.inputMode === "FORM" ? analysis.formSubmissions.length : analysis.students.length;
    const missing: string[] = [];
    if (analysis.questions.length < 5 || analysis.questions.length > 10) missing.push("٥-١٠ أسئلة مكتملة");
    if (expectedStudentCount === 0) missing.push(analysis.inputMode === "FORM" ? "تسليم طالب واحد على الأقل" : "رموز الطلاب");
    if (analysis.inputMode === "PDF") {
      const distinctStudents = new Set(analysis.assets.map((asset) => asset.studentId).filter(Boolean));
      if (analysis.assets.length !== expectedStudentCount || distinctStudents.size !== expectedStudentCount) {
        missing.push(`${formatArabicInteger(expectedStudentCount)} ملفات مربوطة بالطلاب`);
      }
    }
    if (missing.length) throw new ApiError(422, `لا يمكن البدء قبل اكتمال: ${missing.join("، ")}.`, "GATES_INCOMPLETE");
    const version = (analysis.runs[0]?.version ?? 0) + 1;
    const idempotencyKey = `${id}:v${version}:${randomUUID()}`;
    const run = await db.$transaction(async (tx) => {
      const created = await tx.analysisRun.create({ data: { sessionId: id, version, idempotencyKey } });
      await tx.analysisSession.update({ where: { id }, data: { status: "PROCESSING", lockedAt: new Date() } });
      await tx.outboxEvent.create({ data: { type: "analysis.run.requested", aggregateId: created.id, payload: { analysisId: id, runId: created.id, schemaVersion: "analysis-job.v1" } } });
      await tx.analysisEvent.create({ data: { runId: created.id, type: "QUEUED", payload: { progress: 0 } } });
      return created;
    });
    let dispatched = true;
    try { await dispatchAnalysisRun(run.id); }
    catch (error) {
      dispatched = false;
      await failRun(run.id, id);
      console.error("Analyzer dispatch failed", error);
      throw new ApiError(502, "تعذر تحليل الإجابات عبر Gemini الآن. لم يُغلق الاختبار ويمكنك إعادة المحاولة.", "ANALYZER_START_FAILED");
    }
    await audit({ actorId: user.id, action: "analysis.started", entityType: "AnalysisRun", entityId: run.id, metadata: { version, dispatched }, ipAddress: requestIp(request) });
    const refreshed = await db.analysisRun.findUniqueOrThrow({ where: { id: run.id }, select: { status: true, progress: true } });
    return Response.json(
      { runId: run.id, status: refreshed.status, progress: refreshed.progress, dispatched },
      { status: ["QUEUED", "PROCESSING"].includes(refreshed.status) ? 202 : 200 },
    );
  } catch (error) { return apiError(error); }
}
