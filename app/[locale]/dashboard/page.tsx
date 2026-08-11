import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DashboardView, type DashboardSession } from "@/components/dashboard-view";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

const statusLabel = {
  DRAFT: "مسودة", READY: "جاهز", PROCESSING: "قيد المعالجة", REVIEW: "تحتاج مراجعة",
  COMPLETED: "مكتمل", PARTIAL: "جزئي", FAILED: "تعذر التحليل",
} as const;

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/ar/login");
  const [analyses, pendingReview, approvedPlans] = await Promise.all([
    db.analysisSession.findMany({
      where: { ownerId: session.user.id },
      include: { _count: { select: { students: true, formSubmissions: true } }, runs: { orderBy: { version: "desc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
    }),
    db.answerResult.count({ where: { needsReview: true, decision: null, run: { session: { ownerId: session.user.id } } } }),
    db.interventionPlan.count({ where: { status: "APPROVED", group: { session: { ownerId: session.user.id } } } }),
  ]);
  const formatter = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" });
  const view: DashboardSession[] = analyses.map((item) => ({
    id: item.id, title: item.title, meta: `${item.subject} · ${item.grade}`,
    date: formatter.format(item.updatedAt), status: statusLabel[item.status],
    progress: item.runs[0]?.progress ?? (item.status === "DRAFT" ? 20 : 0),
    studentCount: item.inputMode === "FORM" ? item._count.formSubmissions : item._count.students,
    href: `/ar/analyses/${item.id}`,
  }));
  return <AppShell userName={session.user.name}><DashboardView sessions={view} userName={session.user.name} stats={{ sessions: analyses.length, pendingReview, approvedPlans }} /></AppShell>;
}
