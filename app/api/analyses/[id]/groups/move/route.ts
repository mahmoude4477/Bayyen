import { z } from "zod";
import { apiError, ApiError, requireOwnedAnalysis } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { db } from "@/lib/server/db";

const schema = z.object({
  studentCode: z.string().regex(/^S-\d+$/),
  targetGroupId: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
});

export async function PATCH(request: Request, context: RouteContext<"/api/analyses/[id]/groups/move">) {
  try {
    const { id } = await context.params;
    const { user } = await requireOwnedAnalysis(request, id);
    const input = schema.parse(await request.json());
    const [student, target] = await Promise.all([
      db.student.findFirst({ where: { sessionId: id, code: input.studentCode } }),
      db.studentGroup.findFirst({ where: { id: input.targetGroupId, sessionId: id } }),
    ]);
    if (!student || !target) throw new ApiError(404, "الطالب أو المجموعة غير موجود.", "GROUP_MOVE_NOT_FOUND");
    await db.$transaction(async (tx) => {
      await tx.groupMember.deleteMany({ where: { studentId: student.id, group: { runId: target.runId } } });
      await tx.groupMember.create({ data: { groupId: target.id, studentId: student.id, reason: input.reason, movedBy: user.id } });
    });
    await audit({ actorId: user.id, action: "group.member.moved", entityType: "Student", entityId: student.id, metadata: { targetGroupId: target.id, reason: input.reason } });
    return Response.json({ studentCode: student.code, groupId: target.id });
  } catch (error) { return apiError(error); }
}
