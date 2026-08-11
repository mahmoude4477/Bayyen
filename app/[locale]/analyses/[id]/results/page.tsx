import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ResultsView, type ResultsData } from "@/components/results-view";
import { formatArabicInteger } from "@/lib/analysis-config";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

const GAP_COLOR = "#3b8278";

export default async function ResultsPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const userSession = await auth.api.getSession({ headers: await headers() });
  if (!userSession) redirect("/ar/login");
  const { locale, id } = await params;
  const analysis = await db.analysisSession.findFirst({ where: { id, ownerId: userSession.user.id }, include: {
    assets: { where: { status: "MAPPED" }, select: { id: true } },
    questions: { select: { position: true, objective: { select: { title: true } } } },
    _count: { select: { students: true, formSubmissions: true } },
    runs: { orderBy: { version: "desc" }, take: 1, include: {
      gaps: { orderBy: { rank: "asc" } },
      groups: { include: { _count: { select: { members: true } } } },
      results: { select: { needsReview: true, decision: true } },
    } },
  } });
  if (!analysis) notFound();
  if (!analysis.runs[0]) {
    redirect(analysis.inputMode === "FORM" ? `/${locale}/analyses/${id}/forms` : `/${locale}/dashboard`);
  }
  const run = analysis.runs[0];
  const objectiveTitleByPosition = new Map(analysis.questions.map((question) => [question.position, question.objective.title]));
  const reviewCount = run.results.filter((result) => result.needsReview && !result.decision).length;
  const formatter = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" });
  const elapsed = run.startedAt && run.completedAt ? Math.max(1, Math.round((run.completedAt.getTime() - run.startedAt.getTime()) / 1000)) : null;
  const population = analysis.inputMode === "FORM" ? analysis._count.formSubmissions : analysis._count.students;
  const isProcessing = ["QUEUED", "PROCESSING"].includes(run.status);
  const data: ResultsData = {
    analysisId: analysis.id,
    inputMode: analysis.inputMode,
    population,
    sourceCount: analysis.inputMode === "FORM" ? analysis._count.formSubmissions : analysis.assets.length,
    evidenceCount: run.results.length,
    session: {
      title: analysis.title,
      subject: analysis.subject,
      grade: analysis.grade,
      classroom: analysis.classroom,
      completedAt: formatter.format(run.completedAt ?? run.updatedAt),
      run: `RUN-${String(run.version).padStart(3, "0")}`,
      fixture: run.analyzerJobId?.includes("fixture") ?? false,
      nafsAligned: analysis.nafsAligned,
      nafsDomain: analysis.nafsDomain,
      nafsFramework: analysis.nafsFramework,
    },
    run: { status: run.status, progress: run.progress },
    metrics: [
      analysis.inputMode === "FORM"
        ? { label: "إجابات الطلاب", value: `${formatArabicInteger(population)}/${formatArabicInteger(population)}`, hint: "تسليمات رقمية محفوظة في قاعدة البيانات", tone: "blue" }
        : { label: "أعمال الطلاب", value: `${formatArabicInteger(analysis.assets.length)}/${formatArabicInteger(population)}`, hint: "ورقة مرتبطة وقابلة للتحليل", tone: "blue" },
      isProcessing
        ? { label: "تقدم التحليل", value: `${formatArabicInteger(run.progress)}٪`, hint: "تتحدث النتائج تلقائيًا", tone: "green" }
        : { label: "تحتاج مراجعة المعلم", value: String(reviewCount), hint: "إجابات غير واضحة تنتظر قرارك", tone: "amber" },
      { label: "وقت التحليل", value: elapsed ? `${elapsed}ث` : "جارٍ", hint: "من القبول إلى النتيجة", tone: "violet" },
    ],
    gaps: run.gaps.map((gap) => ({
      id: gap.slug,
      rank: String(gap.rank).padStart(2, "0"),
      title: `هدف التعلّم: ${objectiveTitleByPosition.get(Number(gap.slug.match(/-(\d+)$/)?.[1])) ?? gap.title}`,
      description: gap.description,
      affected: gap.affectedCount,
      total: gap.population,
      percent: gap.population > 0 ? Math.round((gap.affectedCount / gap.population) * 100) : 0,
      color: GAP_COLOR,
      evidence: gap.evidence,
    })),
    groups: run.groups.map((group) => ({ id: group.key, label: group.label, count: group._count.members, color: group.color })),
    reviewCount,
  };
  return <AppShell userName={userSession.user.name}><ResultsView data={data} /></AppShell>;
}
