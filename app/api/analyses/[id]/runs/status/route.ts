import { apiError, requireOwnedAnalysis } from "@/lib/server/api";
import { db } from "@/lib/server/db";

export async function GET(request: Request, context: RouteContext<"/api/analyses/[id]/runs/status">) {
  try {
    const { id } = await context.params;
    await requireOwnedAnalysis(request, id);
    const run = await db.analysisRun.findFirst({
      where: { sessionId: id }, orderBy: { version: "desc" },
      select: { id: true, version: true, status: true, progress: true, errorCode: true, errorMessage: true, updatedAt: true, _count: { select: { results: true, gaps: true, groups: true } } },
    });
    return Response.json({ run }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return apiError(error); }
}
