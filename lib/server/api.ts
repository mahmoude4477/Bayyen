import "server-only";
import { ZodError } from "zod";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code: string) {
    super(message);
  }
}

export async function requireApiUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new ApiError(401, "يجب تسجيل الدخول أولًا.", "UNAUTHENTICATED");
  return session.user;
}

export async function requireOwnedAnalysis(request: Request, analysisId: string) {
  const user = await requireApiUser(request);
  const analysis = await db.analysisSession.findFirst({
    where: { id: analysisId, ownerId: user.id },
  });
  if (!analysis) throw new ApiError(404, "جلسة التحليل غير موجودة.", "ANALYSIS_NOT_FOUND");
  return { user, analysis };
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return Response.json(
      { error: "البيانات المرسلة غير صالحة.", code: "VALIDATION_ERROR", issues: error.issues },
      { status: 422 },
    );
  }
  console.error(error);
  return Response.json(
    { error: "تعذر إكمال الطلب. حاول مرة أخرى.", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}

export function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}
