import { notFound } from "next/navigation";
import { StudentAssessment } from "@/components/student-assessment";
import { db } from "@/lib/server/db";

export default async function StudentTestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const analysis = await db.analysisSession.findUnique({
    where: { formToken: token },
    select: {
      formToken: true,
      title: true,
      subject: true,
      grade: true,
      inputMode: true,
      publishedAt: true,
      lockedAt: true,
      questions: { orderBy: { position: "asc" }, select: { id: true, prompt: true, type: true, choices: true, position: true } },
    },
  });
  if (!analysis || analysis.inputMode !== "FORM" || !analysis.publishedAt) notFound();
  return <StudentAssessment assessment={{
    token: analysis.formToken,
    title: analysis.title,
    subject: analysis.subject,
    grade: analysis.grade,
    closed: Boolean(analysis.lockedAt),
    questions: analysis.questions.map((question) => ({
      ...question,
      choices: Array.isArray(question.choices) ? question.choices.filter((choice): choice is string => typeof choice === "string") : [],
    })),
  }} />;
}
