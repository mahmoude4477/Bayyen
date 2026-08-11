import { z } from "zod";
import { apiError, ApiError, requireOwnedAnalysis } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { db } from "@/lib/server/db";

const schema = z.object({
  decision: z.enum(["ACCEPTED", "EDITED", "REPROCESS"]),
  teacherAnswer: z.string().trim().max(2000).nullable().optional(),
  teacherNote: z.string().trim().max(1000).nullable().optional(),
});

export async function PATCH(request: Request, context: RouteContext<"/api/analyses/[id]/review/[resultId]">) {
  try {
    const { id, resultId } = await context.params;
    const { user } = await requireOwnedAnalysis(request, id);
    const input = schema.parse(await request.json());
    const result = await db.answerResult.findFirst({ where: { id: resultId, run: { sessionId: id } } });
    if (!result) throw new ApiError(404, "حالة المراجعة غير موجودة.", "RESULT_NOT_FOUND");
    await db.answerResult.update({ where: { id: result.id }, data: { ...input, reviewedAt: new Date() } });
    const remaining = await db.answerResult.count({ where: { runId: result.runId, needsReview: true, decision: null } });
    if (remaining === 0) {
      await db.$transaction([
        db.analysisRun.update({ where: { id: result.runId }, data: { status: "COMPLETED", completedAt: new Date() } }),
        db.analysisSession.update({ where: { id }, data: { status: "COMPLETED" } }),
        db.analysisEvent.create({ data: { runId: result.runId, type: "REVIEW_COMPLETED", payload: { reviewerId: user.id } } }),
      ]);
    }
    await audit({ actorId: user.id, action: "result.reviewed", entityType: "AnswerResult", entityId: result.id, metadata: { decision: input.decision, remaining } });
    return Response.json({ resultId: result.id, remaining, analysisStatus: remaining === 0 ? "COMPLETED" : "REVIEW" });
  } catch (error) { return apiError(error); }
}
