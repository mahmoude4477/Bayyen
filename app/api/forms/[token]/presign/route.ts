import { randomUUID } from "node:crypto";
import { z } from "zod";
import { studentCode } from "@/lib/analysis-config";
import { apiError, ApiError, requestIp } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";
import { presignUpload } from "@/lib/server/storage";
import { STORAGE_DISABLED_MESSAGE, STORAGE_ENABLED } from "@/lib/storage-config";
import { normalizeStudentName } from "@/lib/student-name";

const inputSchema = z.object({
  size: z.number().int().positive().max(10 * 1024 * 1024),
  studentName: z.string().min(2).max(80),
});

function prismaCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : null;
}

async function getOrCreateStudent(sessionId: string, name: string, nameKey: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        const existingStudent = await tx.student.findFirst({
          where: { sessionId, nameKey },
          include: { formSubmission: true },
        });
        if (existingStudent?.formSubmission) {
          throw new ApiError(409, "سبق تسليم اختبار بهذا الاسم. راجع معلمك إذا كان هناك تشابه أسماء.", "STUDENT_ALREADY_SUBMITTED");
        }
        if (existingStudent) return existingStudent;

        const studentCount = await tx.student.count({ where: { sessionId } });
        return tx.student.create({
          data: { sessionId, code: studentCode(studentCount), name, nameKey },
          include: { formSubmission: true },
        });
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (["P2002", "P2034"].includes(prismaCode(error) ?? "")) continue;
      throw error;
    }
  }
  throw new ApiError(503, "تعذر تسجيل الاسم بسبب كثرة الطلبات المتزامنة. حاول مجددًا.", "STUDENT_CREATE_BUSY");
}

export async function POST(request: Request, context: RouteContext<"/api/forms/[token]/presign">) {
  try {
    if (!STORAGE_ENABLED) throw new ApiError(503, STORAGE_DISABLED_MESSAGE, "STORAGE_DISABLED");
    const { token } = await context.params;
    const input = inputSchema.parse(await request.json());
    const { name, nameKey } = normalizeStudentName(input.studentName);
    if (name.length < 2) throw new ApiError(422, "اكتب اسم الطالب كاملًا.", "STUDENT_NAME_REQUIRED");

    const limit = await rateLimit(`form:presign:${token}:${requestIp(request) ?? "unknown"}`, 500, 3600);
    if (!limit.allowed) throw new ApiError(429, "تجاوزت عدد محاولات الإرسال المؤقتة.", "RATE_LIMITED");

    const session = await db.analysisSession.findUnique({ where: { formToken: token } });
    if (!session || session.inputMode !== "FORM" || !session.publishedAt) {
      throw new ApiError(404, "رابط الاختبار غير موجود.", "FORM_NOT_FOUND");
    }
    if (session.lockedAt) throw new ApiError(409, "أُغلق الاختبار وبدأ التحليل.", "FORM_CLOSED");

    const student = await getOrCreateStudent(session.id, name, nameKey);

    const existing = await db.submissionAsset.findFirst({
      where: { sessionId: session.id, studentId: student.id, status: { in: ["PENDING", "UPLOADED"] } },
      orderBy: { createdAt: "desc" },
    });
    const objectKey = existing?.objectKey ?? `forms/${session.id}/${student.id}/${randomUUID()}.png`;
    const asset = existing
      ? await db.submissionAsset.update({
          where: { id: existing.id },
          data: { fileName: `${student.code}.png`, contentType: "image/png", size: input.size },
        })
      : await db.submissionAsset.create({
          data: { sessionId: session.id, studentId: student.id, objectKey, fileName: `${student.code}.png`, contentType: "image/png", size: input.size },
        });
    const uploadUrl = await presignUpload({ objectKey, contentType: "image/png" });
    return Response.json({ assetId: asset.id, uploadUrl, expiresIn: 300 }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
