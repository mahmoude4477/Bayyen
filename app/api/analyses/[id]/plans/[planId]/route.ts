import { z } from "zod";
import { apiError, ApiError, requireOwnedAnalysis } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { db } from "@/lib/server/db";

const schema = z.object({
  objective: z.string().trim().min(3).max(500),
  duration: z.string().trim().min(2).max(100),
  teacherSteps: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
  explanation: z.string().trim().min(3).max(3000),
  example: z.string().trim().min(3).max(3000),
  activity: z.string().trim().min(3).max(3000),
  practice: z.array(z.string().trim().min(1).max(1000)).min(1).max(12),
  exitTicket: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).min(1).max(10),
  adaptations: z.record(z.string(), z.string()),
  approve: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext<"/api/analyses/[id]/plans/[planId]">) {
  try {
    const { id, planId } = await context.params;
    const { user } = await requireOwnedAnalysis(request, id);
    const input = schema.parse(await request.json());
    const source = await db.interventionPlan.findFirst({ where: { id: planId, group: { sessionId: id } } });
    if (!source) throw new ApiError(404, "الخطة غير موجودة.", "PLAN_NOT_FOUND");
    const latest = await db.interventionPlan.findFirst({ where: { groupId: source.groupId }, orderBy: { version: "desc" } });
    const plan = await db.interventionPlan.create({ data: {
      groupId: source.groupId, version: (latest?.version ?? 0) + 1,
      objective: input.objective, duration: input.duration, teacherSteps: input.teacherSteps,
      explanation: input.explanation, example: input.example, activity: input.activity,
      practice: input.practice, exitTicket: input.exitTicket, adaptations: input.adaptations,
      status: input.approve ? "APPROVED" : "DRAFT", approvedAt: input.approve ? new Date() : null,
    } });
    await audit({ actorId: user.id, action: input.approve ? "plan.approved" : "plan.revised", entityType: "InterventionPlan", entityId: plan.id, metadata: { sourcePlanId: source.id, version: plan.version } });
    return Response.json({ planId: plan.id, version: plan.version, status: plan.status }, { status: 201 });
  } catch (error) { return apiError(error); }
}
