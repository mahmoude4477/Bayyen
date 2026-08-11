import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PlanView, type PlanData } from "@/components/plan-view";
import { normalizePlanObjective } from "@/lib/plan-objective";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export default async function PlanPage({ params }: { params: Promise<{ id: string; planId: string }> }) {
  const userSession = await auth.api.getSession({ headers: await headers() });
  if (!userSession) redirect("/ar/login");
  const { id, planId } = await params;
  const plan = await db.interventionPlan.findFirst({ where: { id: planId, group: { sessionId: id, session: { ownerId: userSession.user.id } } }, include: { group: { include: { _count: { select: { members: true } } } } } });
  if (!plan) notFound();
  const objective = normalizePlanObjective(plan.objective, plan.group.label);
  const data: PlanData = {
    id: plan.id, analysisId: id, groupLabel: plan.group.label, groupCount: plan.group._count.members,
    title: `خطة علاجية لمجموعة ${plan.group.label}`, version: plan.version, status: plan.status, duration: plan.duration,
    objective, teacherSteps: plan.teacherSteps as string[], explanation: plan.explanation,
    example: plan.example, activity: plan.activity, practice: plan.practice as string[],
    exitTicket: plan.exitTicket as { question: string; answer: string }[], adaptations: plan.adaptations as Record<string, string>,
  };
  return <AppShell userName={userSession.user.name}><PlanView data={data} /></AppShell>;
}
