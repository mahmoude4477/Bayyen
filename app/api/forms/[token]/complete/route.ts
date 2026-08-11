import { studentCode } from "@/lib/analysis-config";
import { apiError, ApiError, requestIp } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";
import { normalizeStudentName } from "@/lib/student-name";
import { formSubmissionPayloadV1 } from "@/packages/contracts/form-submission.v1";

function prismaCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : null;
}

export async function POST(request: Request, context: RouteContext<"/api/forms/[token]/complete">) {
  try {
    const { token } = await context.params;
    const input = formSubmissionPayloadV1.parse(await request.json());
    const { name, nameKey } = normalizeStudentName(input.studentName);
    const limit = await rateLimit(`form:complete:${token}:${requestIp(request) ?? "unknown"}`, 500, 3600);
    if (!limit.allowed) throw new ApiError(429, "تجاوزت عدد محاولات التسليم.", "RATE_LIMITED");

    const session = await db.analysisSession.findUnique({
      where: { formToken: token },
      include: { questions: { orderBy: { position: "asc" } } },
    });
    if (!session || session.inputMode !== "FORM" || !session.publishedAt) {
      throw new ApiError(404, "رابط الاختبار غير موجود.", "FORM_NOT_FOUND");
    }
    if (session.lockedAt) throw new ApiError(409, "أُغلق الاختبار وبدأ التحليل.", "FORM_CLOSED");

    const answerByQuestion = new Map(input.answers.map((answer) => [answer.questionId, answer]));
    if (answerByQuestion.size !== session.questions.length || input.answers.length !== session.questions.length) {
      throw new ApiError(422, "يجب إرسال إجابة واحدة لكل سؤال.", "ANSWERS_INCOMPLETE");
    }
    const answers = session.questions.map((question) => {
      const answer = answerByQuestion.get(question.id);
      if (!answer || answer.type !== question.type) {
        throw new ApiError(422, "نوع الإجابة لا يطابق السؤال.", "ANSWER_TYPE_MISMATCH");
      }
      if (question.type === "MULTIPLE_CHOICE") {
        const choices = Array.isArray(question.choices) ? question.choices.filter((choice): choice is string => typeof choice === "string") : [];
        if (!answer.text || !choices.includes(answer.text)) {
          throw new ApiError(422, "إجابة الاختيار من متعدد غير صالحة.", "INVALID_CHOICE");
        }
      }
      return answer;
    });

    let submittedCount = 0;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        submittedCount = await db.$transaction(async (tx) => {
          const existing = await tx.student.findFirst({
            where: { sessionId: session.id, nameKey },
            include: { formSubmission: true },
          });
          if (existing?.formSubmission) {
            throw new ApiError(409, "سبق تسليم اختبار بهذا الاسم. راجع معلمك إذا كان هناك تشابه أسماء.", "STUDENT_ALREADY_SUBMITTED");
          }
          const student = existing ?? await tx.student.create({
            data: {
              sessionId: session.id,
              code: studentCode(await tx.student.count({ where: { sessionId: session.id } })),
              name,
              nameKey,
            },
          });
          await tx.formSubmission.create({
            data: {
              sessionId: session.id,
              studentId: student.id,
              payload: { schemaVersion: "form-submission.v1", studentName: name, answers },
            },
          });
          await tx.analysisSession.update({ where: { id: session.id }, data: { status: "READY" } });
          return tx.formSubmission.count({ where: { sessionId: session.id } });
        }, { isolationLevel: "Serializable" });
        break;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (["P2002", "P2034"].includes(prismaCode(error) ?? "") && attempt < 4) continue;
        throw error;
      }
    }
    if (!submittedCount) throw new ApiError(503, "تعذر حفظ الإجابات الآن. حاول مرة أخرى.", "SUBMISSION_BUSY");
    return Response.json({ status: "SUBMITTED", submittedCount }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
