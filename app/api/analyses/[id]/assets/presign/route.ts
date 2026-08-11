import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { z } from "zod";
import { formatArabicInteger } from "@/lib/analysis-config";
import { apiError, ApiError, requireOwnedAnalysis, requestIp } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";
import { presignUpload } from "@/lib/server/storage";
import { STORAGE_DISABLED_MESSAGE, STORAGE_ENABLED } from "@/lib/storage-config";

const inputSchema = z.object({
  fileName: z.string().min(1).max(180),
  contentType: z.enum(["application/pdf", "image/png", "image/jpeg"]),
  size: z.number().int().positive().max(15 * 1024 * 1024),
  checksum: z.string().min(20).max(100).optional(),
  studentCode: z.string().regex(/^S-\d{3}$/),
});

export async function POST(request: Request, context: RouteContext<"/api/analyses/[id]/assets/presign">) {
  try {
    if (!STORAGE_ENABLED) throw new ApiError(503, STORAGE_DISABLED_MESSAGE, "STORAGE_DISABLED");
    const { id } = await context.params;
    const { user, analysis } = await requireOwnedAnalysis(request, id);
    if (analysis.lockedAt) throw new ApiError(409, "الجلسة مقفلة بعد بدء التحليل.", "ANALYSIS_LOCKED");
    const input = inputSchema.parse(await request.json());
    const limit = await rateLimit(`presign:${user.id}:${requestIp(request) ?? "unknown"}`, 120, 3600);
    if (!limit.allowed) throw new ApiError(429, "تجاوزت حد طلبات الرفع المؤقت.", "RATE_LIMITED");
    const [student, assetCount, studentCount] = await Promise.all([
      db.student.findFirst({ where: { sessionId: id, code: input.studentCode } }),
      db.submissionAsset.count({ where: { sessionId: id, status: { in: ["PENDING", "UPLOADED", "MAPPED"] } } }),
      db.student.count({ where: { sessionId: id } }),
    ]);
    if (!student) throw new ApiError(422, "رمز الطالب غير موجود في الجلسة.", "STUDENT_NOT_FOUND");
    if (assetCount >= studentCount) throw new ApiError(409, `اكتمل الحد الأقصى وهو ${formatArabicInteger(studentCount)} ملفات.`, "ASSET_LIMIT");
    const extension = extname(input.fileName).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".bin";
    const objectKey = `${user.id}/${id}/${randomUUID()}${extension}`;
    const asset = await db.submissionAsset.create({ data: {
      sessionId: id, studentId: student.id, objectKey, fileName: input.fileName,
      contentType: input.contentType, size: input.size, checksum: input.checksum,
    } });
    const uploadUrl = await presignUpload({ objectKey, contentType: input.contentType, checksum: input.checksum });
    await audit({ actorId: user.id, action: "asset.presigned", entityType: "SubmissionAsset", entityId: asset.id, metadata: { studentCode: input.studentCode, size: input.size } });
    return Response.json({ assetId: asset.id, uploadUrl, objectKey, expiresIn: 300 }, { status: 201 });
  } catch (error) { return apiError(error); }
}
