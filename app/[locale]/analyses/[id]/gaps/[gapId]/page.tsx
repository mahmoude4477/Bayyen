import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { GapDetailView, type GapDetailData } from "@/components/gap-detail-view";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

const masteryLabels = {
  MASTERED: "متقن",
  PARTIAL: "إتقان جزئي",
  NOT_MASTERED: "غير متقن",
  UNREADABLE: "غير مقروء",
} as const;

const masteryExplanations = {
  MASTERED: "الإجابة تطابق معيار التصحيح",
  PARTIAL: "الإجابة تحتوي جزءًا صحيحًا لكنها لا تحقق المعيار كاملًا",
  NOT_MASTERED: "الإجابة لا تحقق معيار التصحيح لهذا السؤال",
  UNREADABLE: "تعذرت قراءة الإجابة آليًا وتحتاج مراجعة المعلم",
} as const;

export default async function GapPage({ params }: { params: Promise<{ id: string; gapId: string }> }) {
  const userSession = await auth.api.getSession({ headers: await headers() });
  if (!userSession) redirect("/ar/login");
  const { id, gapId } = await params;

  const gap = await db.learningGap.findFirst({
    where: { slug: gapId, run: { sessionId: id, session: { ownerId: userSession.user.id } } },
    include: {
      students: { select: { studentId: true } },
      run: {
        include: {
          session: {
            include: {
              questions: { include: { objective: true }, orderBy: { position: "asc" } },
            },
          },
        },
      },
    },
  });
  if (!gap) notFound();

  const positionFromSlug = Number(gap.slug.match(/-(\d+)$/)?.[1]);
  const targetQuestion = gap.run.session.questions.find((question) => question.position === positionFromSlug)
    ?? gap.run.session.questions.find((question) => gap.description.includes(question.prompt))
    ?? gap.run.session.questions[0];
  if (!targetQuestion) notFound();

  const objectiveQuestions = gap.run.session.questions.filter((question) => question.objectiveId === targetQuestion.objectiveId);
  const questionIds = objectiveQuestions.map((question) => question.id);
  const affectedStudentIds = gap.students.map((item) => item.studentId);

  const [evidenceResults, groupedResults] = await Promise.all([
    db.answerResult.findMany({
      where: { runId: gap.runId, questionId: targetQuestion.id, studentId: { in: affectedStudentIds }, mastery: { not: "MASTERED" } },
      include: { student: true },
      orderBy: [{ confidence: "asc" }, { studentId: "asc" }],
      take: 12,
    }),
    db.answerResult.groupBy({
      by: ["questionId", "mastery"],
      where: { runId: gap.runId, questionId: { in: questionIds } },
      _count: { _all: true },
    }),
  ]);

  const questions = objectiveQuestions.map((question) => {
    const rows = groupedResults.filter((row) => row.questionId === question.id);
    const total = rows.reduce((sum, row) => sum + row._count._all, 0);
    const affected = rows.filter((row) => row.mastery !== "MASTERED").reduce((sum, row) => sum + row._count._all, 0);
    return { position: question.position, prompt: question.prompt, affected, total, percent: total ? Math.round((affected / total) * 100) : 0 };
  });
  const targetStats = questions.find((question) => question.position === targetQuestion.position) ?? { affected: gap.affectedCount, total: gap.population, percent: gap.population ? Math.round((gap.affectedCount / gap.population) * 100) : 0 };
  const comparisonRates = questions.filter((question) => question.position !== targetQuestion.position && question.total > 0).map((question) => question.percent);
  const bestComparison = comparisonRates.length ? Math.min(...comparisonRates) : null;

  let quality: GapDetailData["quality"];
  if (targetStats.total < 5) {
    quality = {
      title: "لا توجد بيانات كافية للحكم على الصياغة",
      description: `التحليل الحالي مبني على ${targetStats.total === 1 ? "إجابة طالب واحد" : `${targetStats.total} إجابات`} فقط. لا يصح استنتاج أن السؤال غامض من هذه العينة الصغيرة.`,
    };
  } else if (bestComparison !== null && targetStats.percent >= bestComparison + 20) {
    quality = {
      title: "قد يستحق السؤال مراجعة المعلم",
      description: `بلغ التعثر في هذا السؤال ${targetStats.percent}٪، وهو أعلى بوضوح من أفضل سؤال آخر للهدف نفسه (${bestComparison}٪). قد يكون السبب صعوبة المفهوم أو صياغة السؤال؛ لا يمكن للنظام الجزم وحده.`,
    };
  } else {
    quality = {
      title: "لا تظهر إشارة قوية إلى مشكلة في الصياغة",
      description: "معدل التعثر قريب من بقية أسئلة هدف التعلّم نفسه، لذلك يرجح أن النمط مرتبط بالمفهوم أكثر من صياغة سؤال واحد.",
    };
  }

  const total = gap.population;
  const affected = gap.affectedCount;
  const data: GapDetailData = {
    title: "تفاصيل الفجوة",
    description: gap.description,
    affected,
    total,
    percent: total ? Math.round((affected / total) * 100) : 0,
    objectiveTitle: targetQuestion.objective.title,
    question: { position: targetQuestion.position, prompt: targetQuestion.prompt, answerKey: targetQuestion.answerKey },
    evidence: evidenceResults.map((result) => ({
      student: result.student.name ?? result.student.code,
      questionPosition: targetQuestion.position,
      answer: result.extractedAnswer,
      expectedAnswer: targetQuestion.answerKey,
      mastery: masteryLabels[result.mastery],
      explanation: masteryExplanations[result.mastery],
    })),
    why: `ظهرت الفجوة لأن ${affected} من ${total} ${total === 1 ? "طالب" : "طلاب"} لم يصلوا إلى الإتقان في السؤال ${targetQuestion.position}. قارن النظام الإجابات بمعيار التصحيح المسجل، وأرسل الإجابات غير الواضحة أو غير المقروءة إلى مراجعة المعلم.`,
    quality,
    questions,
  };
  return <AppShell userName={userSession.user.name}><GapDetailView analysisId={id} gap={data} /></AppShell>;
}
