import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AnalysisStageEmpty } from "@/components/analysis-stage-empty";
import { AppShell } from "@/components/app-shell";
import { GroupsView, type GroupViewData } from "@/components/groups-view";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export default async function GroupsPage({ params }: { params: Promise<{ id: string }> }) {
  const userSession = await auth.api.getSession({ headers: await headers() });
  if (!userSession) redirect("/ar/login");
  const { id } = await params;
  const analysis = await db.analysisSession.findFirst({ where: { id, ownerId: userSession.user.id }, include: { runs: { orderBy: { version: "desc" }, take: 1, include: { groups: { include: { members: { include: { student: true } }, plans: { orderBy: { version: "desc" }, take: 1 } }, orderBy: { key: "asc" } } } } } });
  if (!analysis) notFound();
  if (!analysis.runs[0]) {
    return <AppShell userName={userSession.user.name}><AnalysisStageEmpty analysisId={id} eyebrow="مجموعات الطلاب" title="لم يبدأ التحليل بعد" description="تُنشأ مجموعات الطلاب بعد وصول الإجابات وتشغيل التحليل لهذا الاختبار." actionHref={`/ar/analyses/${id}`} actionLabel="فتح لوحة الاختبار" /></AppShell>;
  }
  const groups: GroupViewData[] = analysis.runs[0].groups.map((group) => ({ id: group.id, key: group.key, label: group.label, title: group.title, color: group.color, description: group.description, students: group.members.map((member) => ({ code: member.student.code, label: member.student.name ?? member.student.code })).sort((first, second) => first.label.localeCompare(second.label, "ar")), planId: group.plans[0]?.id ?? null }));
  if (!groups.length) {
    return <AppShell userName={userSession.user.name}><AnalysisStageEmpty analysisId={id} eyebrow="مجموعات الطلاب" title="لا توجد مجموعات مولّدة" description="اكتمل تشغيل التحليل دون إنشاء مجموعات طلاب لهذا الاختبار. راجع النتائج والفجوات أولًا." actionHref={`/ar/analyses/${id}/results`} actionLabel="فتح نتائج التحليل" /></AppShell>;
  }
  return <AppShell userName={userSession.user.name}><GroupsView analysisId={id} groups={groups} /></AppShell>;
}
