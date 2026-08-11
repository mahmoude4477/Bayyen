import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AnalysisOverview, type AnalysisOverviewData } from "@/components/analysis-overview";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

const statusLabel = {
  DRAFT: "مسودة",
  READY: "جاهز للتحليل",
  PROCESSING: "التحليل جارٍ",
  REVIEW: "تحتاج مراجعة",
  COMPLETED: "مكتمل",
  PARTIAL: "مكتمل جزئيًا",
  FAILED: "تعذر التحليل",
} as const;

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const userSession = await auth.api.getSession({ headers: await headers() });
  if (!userSession) redirect("/ar/login");
  const { id } = await params;
  const analysis = await db.analysisSession.findFirst({
    where: { id, ownerId: userSession.user.id },
    include: {
      _count: { select: { formSubmissions: true, assets: true } },
      runs: {
        orderBy: { version: "desc" },
        take: 1,
        include: {
          results: { select: { needsReview: true, decision: true } },
          gaps: { select: { id: true } },
          groups: { select: { id: true, plans: { select: { id: true, status: true } } } },
        },
      },
    },
  });
  if (!analysis) notFound();
  const run = analysis.runs[0] ?? null;
  const plans = run?.groups.flatMap((group) => group.plans) ?? [];
  const formatter = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" });
  const data: AnalysisOverviewData = {
    id: analysis.id,
    title: analysis.title,
    subject: analysis.subject,
    grade: analysis.grade,
    lesson: analysis.lesson,
    classroom: analysis.classroom,
    inputMode: analysis.inputMode,
    statusLabel: statusLabel[analysis.status],
    updatedAt: formatter.format(analysis.updatedAt),
    submissionCount: analysis._count.formSubmissions,
    assetCount: analysis._count.assets,
    run: run ? { status: run.status, progress: run.progress, version: run.version } : null,
    evidenceCount: run?.results.length ?? 0,
    pendingReview: run?.results.filter((result) => result.needsReview && !result.decision).length ?? 0,
    gapCount: run?.gaps.length ?? 0,
    groupCount: run?.groups.length ?? 0,
    planCount: plans.length,
    approvedPlanCount: plans.filter((plan) => plan.status === "APPROVED").length,
  };
  return <AppShell userName={userSession.user.name}><AnalysisOverview data={data} /></AppShell>;
}
