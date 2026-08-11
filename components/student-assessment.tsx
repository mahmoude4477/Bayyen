"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, LoaderCircle, PenLine, Send, ShieldCheck } from "lucide-react";
import type { InkStroke } from "@/lib/ink";

const InkPad = dynamic(() => import("@/components/ink-pad").then((module) => module.InkPad), {
  ssr: false,
  loading: () => <div className="ink-loading">جارٍ تجهيز لوحة القلم…</div>,
});

type Assessment = {
  token: string;
  title: string;
  subject: string;
  grade: string;
  closed: boolean;
  questions: { id: string; prompt: string; type: "SHORT_ANSWER" | "MULTIPLE_CHOICE" | "INK"; choices: string[]; position: number }[];
};

export function StudentAssessment({ assessment }: { assessment: Assessment }) {
  const [studentName, setStudentName] = useState("");
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [inks, setInks] = useState<Record<string, InkStroke[]>>({});
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  async function submit() {
    const normalizedName = studentName.normalize("NFKC").trim().replace(/\s+/g, " ");
    if (normalizedName.length < 2) {
      setError("اكتب اسم الطالب أولًا.");
      return;
    }
    const missing = assessment.questions.some((question) => question.type === "INK" ? !inks[question.id]?.length : !texts[question.id]?.trim());
    if (missing) {
      setError("أجب عن جميع الأسئلة قبل التسليم.");
      return;
    }
    setState("sending");
    setError("");
    try {
      const answers = assessment.questions.map((question) => ({
        questionId: question.id,
        type: question.type,
        ...(question.type === "INK" ? { strokes: inks[question.id] } : { text: texts[question.id] }),
      }));
      const complete = await fetch(`/api/forms/${assessment.token}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schemaVersion: "form-submission.v1", studentName: normalizedName, answers }),
      });
      const completed = await complete.json();
      if (!complete.ok) throw new Error(completed.error ?? "تعذر تأكيد التسليم.");
      setState("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إرسال الإجابات.");
      setState("idle");
    }
  }

  if (assessment.closed) return (
    <main className="student-test-page student-test-done">
      <div className="student-test-card"><ShieldCheck size={52} /><h1>اكتمل تسليم الاختبار</h1><p>وصل العدد المطلوب من الإجابات وبدأت مرحلة التحليل. راجع معلمك إذا كنت تحتاج إلى إضافة إجابة أخرى.</p></div>
    </main>
  );

  if (state === "done") return (
    <main className="student-test-page student-test-done">
      <div className="student-test-card"><CheckCircle2 size={52} /><h1>تم تسليم إجاباتك</h1><p>حُفظت إجاباتك مباشرة في قاعدة البيانات. يمكنك إغلاق هذه الصفحة الآن.</p><Link href="/ar/login">العودة إلى بيِن</Link></div>
    </main>
  );

  return (
    <main className="student-test-page">
      <header className="student-test-header">
        <div><p className="eyebrow">اختبار رقمي للطالب</p><h1>{assessment.title}</h1><p>{assessment.subject} · {assessment.grade}</p></div>
        <span><ShieldCheck size={18} /> إجابتك خاصة بالمعلم</span>
      </header>
      <section className="student-identity-card">
        <div><p className="eyebrow">قبل أن تبدأ</p><h2>اكتب اسمك</h2><p>سيُستخدم الاسم لعرض نتيجتك للمعلم وربط إجاباتك بك فقط.</p></div>
        <label>اسم الطالب<input autoComplete="name" maxLength={80} value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="مثال: أحمد محمد" /></label>
      </section>
      <section className="student-question-list">
        {assessment.questions.map((question) => (
          <article className="student-question" key={question.id}>
            <div className="student-question-number">{question.position}</div>
            <div className="student-question-body">
              <h2>{question.prompt}</h2>
              {question.type === "INK" ? (
                <>
                  <p className="ink-prompt"><PenLine size={16} /> ارسم إجابتك داخل الموقع؛ تُحفظ نقاط الرسم مباشرة مع التسليم.</p>
                  <InkPad value={inks[question.id] ?? []} onChange={(strokes) => setInks((current) => ({ ...current, [question.id]: strokes }))} />
                </>
              ) : question.type === "MULTIPLE_CHOICE" ? (
                <fieldset className="student-choice-list">
                  <legend className="sr-only">اختر إجابة السؤال {question.position}</legend>
                  {question.choices.map((choice, choiceIndex) => (
                    <label className={texts[question.id] === choice ? "selected" : ""} key={`${question.id}-${choiceIndex}`}>
                      <input type="radio" name={`question-${question.id}`} value={choice} checked={texts[question.id] === choice} onChange={(event) => setTexts((current) => ({ ...current, [question.id]: event.target.value }))} />
                      <span>{choice}</span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                <label>إجابتك<textarea rows={4} value={texts[question.id] ?? ""} onChange={(event) => setTexts((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="اكتب إجابتك هنا…" /></label>
              )}
            </div>
          </article>
        ))}
      </section>
      {error ? <p className="form-error student-submit-error" role="alert">{error}</p> : null}
      <footer className="student-submit-bar"><div><strong>راجع إجاباتك قبل التسليم</strong><small>ستُحفظ الإجابات مباشرة في قاعدة البيانات، وبعد التسليم لا يمكن تعديلها.</small></div><button type="button" disabled={state === "sending"} onClick={submit}>{state === "sending" ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />} {state === "sending" ? "جارٍ الحفظ…" : "تسليم الاختبار"}</button></footer>
    </main>
  );
}
