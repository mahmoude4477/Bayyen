import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FormLinksView } from "@/components/form-links-view";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export default async function FormLinksPage({ params }: { params: Promise<{ id: string }> }) {
  const requestHeaders = await headers();
  const userSession = await auth.api.getSession({ headers: requestHeaders });
  if (!userSession) redirect("/ar/login");
  const { id } = await params;
  const analysis = await db.analysisSession.findFirst({
    where: { id, ownerId: userSession.user.id },
    select: {
      id: true,
      title: true,
      inputMode: true,
      formToken: true,
      students: {
        where: { name: { not: null } },
        orderBy: { code: "asc" },
        select: { code: true, name: true, formSubmission: { select: { submittedAt: true } } },
      },
    },
  });
  if (!analysis || analysis.inputMode !== "FORM") notFound();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  const formatter = new Intl.DateTimeFormat("ar-SA", { dateStyle: "short", timeStyle: "short" });
  return <AppShell userName={userSession.user.name}><FormLinksView analysisId={analysis.id} title={analysis.title} publicUrl={`${protocol}://${host}/ar/test/${analysis.formToken}`} students={analysis.students.map((student) => ({
    code: student.code,
    name: student.name,
    submittedAt: student.formSubmission ? formatter.format(student.formSubmission.submittedAt) : null,
  }))} /></AppShell>;
}
