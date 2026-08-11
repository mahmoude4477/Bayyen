import { z } from "zod";
import { apiError, ApiError, requireOwnedAnalysis } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { inspectObject } from "@/lib/server/storage";
import { STORAGE_DISABLED_MESSAGE, STORAGE_ENABLED } from "@/lib/storage-config";

const inputSchema = z.object({ assetId: z.string().min(1) });

export async function POST(request: Request, context: RouteContext<"/api/analyses/[id]/assets/complete">) {
  try {
    if (!STORAGE_ENABLED) throw new ApiError(503, STORAGE_DISABLED_MESSAGE, "STORAGE_DISABLED");
    const { id } = await context.params;
    const { user } = await requireOwnedAnalysis(request, id);
    const { assetId } = inputSchema.parse(await request.json());
    const asset = await db.submissionAsset.findFirst({ where: { id: assetId, sessionId: id } });
    if (!asset) throw new ApiError(404, "سجل الملف غير موجود.", "ASSET_NOT_FOUND");
    const object = await inspectObject(asset.objectKey);
    if (Number(object.ContentLength) !== asset.size || object.ContentType !== asset.contentType) {
      throw new ApiError(422, "خصائص الملف المرفوع لا تطابق طلب الرفع.", "ASSET_MISMATCH");
    }
    await db.$transaction([
      db.submissionAsset.update({ where: { id: asset.id }, data: { status: "MAPPED", uploadedAt: new Date() } }),
      db.pageMapping.create({ data: { assetId: asset.id, studentId: asset.studentId!, pageNumber: 1 } }),
    ]);
    await audit({ actorId: user.id, action: "asset.completed", entityType: "SubmissionAsset", entityId: asset.id, metadata: { size: asset.size } });
    return Response.json({ assetId: asset.id, status: "MAPPED" });
  } catch (error) { return apiError(error); }
}
