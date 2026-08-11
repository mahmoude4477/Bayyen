"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, LoaderCircle, Play, RefreshCw, UserRound, UsersRound } from "lucide-react";
import { PageHeading } from "@/components/page-heading";

type StudentStatus = { code: string; name: string | null; submittedAt: string | null };

export function FormLinksView({ analysisId, title, publicUrl, students }: { analysisId: string; title: string; publicUrl: string; students: StudentStatus[] }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const submittedCount = students.filter((student) => student.submittedAt).length;
  const canAnalyze = submittedCount > 0;

  useEffect(() => {
    if (starting) return;
    const timer = window.setInterval(() => router.refresh(), 7_500);
    return () => window.clearInterval(timer);
  }, [router, starting]);

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  }

  async function startAnalysis() {
    setStarting(true);
    setError("");
    try {
      const response = await fetch(`/api/analyses/${analysisId}/runs/start`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "تعذر بدء التحليل.");
      if (result.dispatched === false) throw new Error("لم تبدأ خدمة التحليل. حاول مرة أخرى.");
      router.push(`/ar/analyses/${analysisId}/results`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر بدء التحليل.");
      setStarting(false);
    }
  }

  return (
    <div className="page-stack form-links-page">
      <PageHeading
        eyebrow="الخطوة ٤ من ٥ · نشر الاختبار"
        title={title}
        description="انسخ رابطًا واحدًا وأرسله لجميع الطلاب. كل طالب يكتب اسمه ثم يجيب، وستظهر الأسماء وحالة التسليم هنا تلقائيًا."
        actions={<><Link className="secondary-btn" href={`/ar/analyses/${analysisId}/submissions`}><UserRound size={16} /> عرض الإجابات</Link><button className="secondary-btn" type="button" onClick={() => router.refresh()}><RefreshCw size={16} /> تحديث</button></>}
      />

      <section className="form-progress-hero">
        <div><span><UsersRound size={22} /></span><div><p className="eyebrow">التسليمات الحالية</p><h2>{submittedCount} {submittedCount === 1 ? "طالب سلّم الاختبار" : "طلاب سلّموا الاختبار"}</h2><p>{canAnalyze ? "يمكنك استقبال مزيد من الطلاب أو بدء التحليل الآن بقرارك." : "أرسل الرابط العام نفسه للطلاب؛ سيظهر كل اسم هنا بعد التسليم."}</p></div></div>
        <div className="form-open-notice"><Check size={15} /> لا يوجد حد ثابت لعدد الطلاب، والتحليل لا يبدأ تلقائيًا.</div>
      </section>

      <section className="panel public-form-link-card">
        <div><p className="eyebrow">رابط الاختبار العام</p><h2>رابط واحد لجميع الطلاب</h2><p>يفتح كل طالب الرابط ويكتب اسمه قبل الإجابة. لا ترسل روابط مختلفة.</p></div>
        <div className="public-form-link-row"><bdi dir="ltr">{publicUrl}</bdi><button className="secondary-btn" type="button" onClick={copyLink}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "تم النسخ" : "نسخ الرابط"}</button><a className="secondary-btn" href={publicUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> فتح</a></div>
      </section>

      <section className="panel form-link-panel">
        <div className="panel-heading"><div><p className="eyebrow">أسماء الطلاب</p><h2>حالة التسليم</h2></div><span className="soft-badge"><UserRound size={14} /> تظهر الأسماء بعد فتح الرابط</span></div>
        <div className="form-link-list student-status-list">
          {!students.length ? <div className="form-empty-students"><UserRound size={22} /><strong>لم يسلّم أي طالب بعد</strong><span>انسخ الرابط العام وأرسله للطلاب، ولا يوجد حد ثابت لعدد المشاركين.</span></div> : null}
          {students.map((student) => (
            <article key={student.code}>
              <span className="form-student-code">{student.code}</span>
              <div><strong>{student.name ?? "بانتظار طالب"}</strong><small>{student.submittedAt ? "تم حفظ الإجابات وربطها باسم الطالب" : student.name ? "بدأ الطالب ولم يسلّم بعد" : "لم يُستخدم هذا المقعد بعد"}</small></div>
              <span className={`form-submit-state ${student.submittedAt ? "done" : "waiting"}`}>{student.submittedAt ? <Check size={14} /> : <LoaderCircle size={14} />} {student.submittedAt ?? "لم يسلّم"}</span>
            </article>
          ))}
        </div>
      </section>

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <section className="form-start-card"><div><p className="eyebrow">قرار المعلم</p><h2>{canAnalyze ? `تحليل ${submittedCount} ${submittedCount === 1 ? "تسليم" : "تسليمات"}` : "بانتظار أول تسليم"}</h2><p>لن يبدأ التحليل تلقائيًا. عند ضغط الزر يُغلق استقبال الإجابات ويحلل النظام كل التسليمات المكتملة حاليًا.</p></div><button type="button" disabled={!canAnalyze || starting} onClick={startAnalysis}>{starting ? <LoaderCircle className="spin" size={18} /> : <Play size={18} />} {starting ? "جارٍ البدء…" : "بدء تحليل الإجابات الآن"}</button></section>
    </div>
  );
}
