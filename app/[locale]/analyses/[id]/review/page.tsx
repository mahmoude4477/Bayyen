import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AnalysisStageEmpty } from "@/components/analysis-stage-empty";
import { AppShell } from "@/components/app-shell";
import { ReviewView, type ReviewItem } from "@/components/review-view";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const userSession = await auth.api.getSession({ headers: await headers() });
  if (!userSession) redirect("/ar/login");
  const { id } = await params;
  const analysis = await db.analysisSession.findFirst({ where: { id, ownerId: userSession.user.id }, include: { runs: { orderBy: { version: "desc" }, take: 1, include: { results: { where: { needsReview: true, decision: null }, include: { student: { include: { assets: { where: { status: "MAPPED" }, orderBy: { createdAt: "desc" }, take: 1 } } }, question: true }, orderBy: [{ confidence: "asc" }, { id: "asc" }] } } } } });
  if (!analysis) notFound();
  if (!analysis.runs[0]) {
    return <AppShell userName={userSession.user.name}><AnalysisStageEmpty analysisId={id} eyebrow="قائمة المراجعة" title="لم يبدأ التحليل بعد" description="ستظهر هنا الإجابات التي تحتاج قرارك بعد تشغيل تحليل هذا الاختبار." actionHref={`/ar/analyses/${id}`} actionLabel="فتح لوحة الاختبار" /></AppShell>;
  }
  if (!analysis.runs[0].results.length) {
    return <AppShell userName={userSession.user.name}><AnalysisStageEmpty analysisId={id} eyebrow="قائمة المراجعة" title="المراجعة مكتملة" description="لا توجد إجابات معلّقة تحتاج قرارك في أحدث تشغيل لهذا الاختبار." actionHref={`/ar/analyses/${id}/results`} actionLabel="فتح نتائج التحليل" complete /></AppShell>;
  }
  const mastery = { MASTERED: "متقن", PARTIAL: "إتقان جزئي", NOT_MASTERED: "غير متقن", UNREADABLE: "غير مقروء" } as const;
  const items: ReviewItem[] = analysis.runs[0].results.map((result) => ({
    id: result.id, student: result.student.name ?? result.student.code, question: `السؤال ${result.question.position} · ${result.question.prompt}`,
    reason: result.confidence < .5 ? "إجابة غير واضحة" : "الإجابة تحتاج تأكيدك", extracted: result.extractedAnswer,
    suggestion: mastery[result.mastery], answerKey: result.question.answerKey,
    // File previews stay hidden while storage is disabled.
    imageUrl: null,
    severity: result.confidence < .5 ? "high" : "medium",
  }));
  return <AppShell userName={userSession.user.name}><ReviewView analysisId={id} reviewItems={items} /></AppShell>;
}
