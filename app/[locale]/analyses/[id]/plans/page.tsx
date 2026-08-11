import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AnalysisStageEmpty } from "@/components/analysis-stage-empty";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export default async function PlansIndex({ params }: { params: Promise<{ id: string }> }) {
  const userSession = await auth.api.getSession({ headers: await headers() });
  if (!userSession) redirect("/ar/login");
  const { id } = await params;
  const analysis = await db.analysisSession.findFirst({ where: { id, ownerId: userSession.user.id }, select: { id: true } });
  if (!analysis) notFound();
  const plan = await db.interventionPlan.findFirst({
    where: { group: { sessionId: id, session: { ownerId: userSession.user.id } } },
    orderBy: [{ group: { key: "asc" } }, { version: "desc" }],
  });
  if (!plan) {
    return <AppShell userName={userSession.user.name}><AnalysisStageEmpty analysisId={id} eyebrow="الخطط العلاجية" title="لا توجد خطط علاجية بعد" description="تظهر الخطط بعد اكتمال التحليل وإنشاء مجموعات الطلاب لهذا الاختبار." actionHref={`/ar/analyses/${id}/groups`} actionLabel="فتح مجموعات الطلاب" /></AppShell>;
  }
  redirect(`/ar/analyses/${id}/plans/${plan.id}`);
}
