import { apiError, requireOwnedAnalysis } from "@/lib/server/api";
import { db } from "@/lib/server/db";

export async function GET(request: Request, context: RouteContext<"/api/analyses/[id]">) {
  try {
    const { id } = await context.params;
    await requireOwnedAnalysis(request, id);
    const analysis = await db.analysisSession.findUniqueOrThrow({
      where: { id },
      include: {
        objectives: { orderBy: { position: "asc" } },
        questions: { orderBy: { position: "asc" }, include: { objective: true } },
        students: { orderBy: { code: "asc" } },
        assets: { orderBy: { createdAt: "asc" }, include: { student: true } },
        runs: { orderBy: { version: "desc" }, take: 1 },
      },
    });
    return Response.json({ analysis });
  } catch (error) { return apiError(error); }
}
