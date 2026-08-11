import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AnalysisStageEmpty } from "@/components/analysis-stage-empty";
import { AppShell } from "@/components/app-shell";
import { StudentSubmissionsView, type StudentSubmissionViewData } from "@/components/student-submissions-view";
import { formSubmissionPayloadV1 } from "@/packages/contracts/form-submission.v1";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export default async function StudentSubmissionsPage({ params }: { params: Promise<{ id: string }> }) {
  const userSession = await auth.api.getSession({ headers: await headers() });
  if (!userSession) redirect("/ar/login");

  const { id } = await params;
  const analysis = await db.analysisSession.findFirst({
    where: { id, ownerId: userSession.user.id },
    select: {
      id: true,
      title: true,
      inputMode: true,
      questions: {
        orderBy: { position: "asc" },
        select: { id: true, prompt: true, position: true, type: true },
      },
      formSubmissions: {
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          payload: true,
          submittedAt: true,
          student: { select: { code: true, name: true } },
        },
      },
    },
  });

  if (!analysis || analysis.inputMode !== "FORM") notFound();
  if (!analysis.formSubmissions.length) {
    return (
      <AppShell userName={userSession.user.name}>
        <AnalysisStageEmpty
          analysisId={id}
          eyebrow="إجابات الطلاب"
          title="لا توجد إجابات بعد"
          description="ستظهر هنا إجابة كل طالب فور إرساله النموذج، ويمكنك استعراضها قبل تشغيل التحليل."
          actionHref={`/ar/analyses/${id}/forms`}
          actionLabel="فتح رابط الطلاب"
        />
      </AppShell>
    );
  }

  const formatter = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" });
  const submissions: StudentSubmissionViewData[] = analysis.formSubmissions.map((submission) => {
    const parsed = formSubmissionPayloadV1.safeParse(submission.payload);
    const answersByQuestion = new Map(parsed.success ? parsed.data.answers.map((answer) => [answer.questionId, answer]) : []);
    return {
      id: submission.id,
      studentCode: submission.student.code,
      studentName: parsed.success ? parsed.data.studentName : submission.student.name ?? submission.student.code,
      submittedAt: formatter.format(submission.submittedAt),
      validPayload: parsed.success,
      answers: analysis.questions.map((question) => {
        const answer = answersByQuestion.get(question.id);
        return {
          questionId: question.id,
          position: question.position,
          prompt: question.prompt,
          type: question.type,
          text: answer?.text ?? null,
          strokeCount: answer?.strokes?.length ?? 0,
        };
      }),
    };
  });

  return <AppShell userName={userSession.user.name}><StudentSubmissionsView analysisId={id} analysisTitle={analysis.title} submissions={submissions} /></AppShell>;
}
