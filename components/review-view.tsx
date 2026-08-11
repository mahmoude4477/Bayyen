"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  FileImage,
} from "lucide-react";
import { formatArabicNumber } from "@/lib/demo-data";
import { PageHeading } from "@/components/page-heading";

type Decision = "confirm" | "unreadable";
const DECISION_LABELS: Record<Decision, string> = {
  confirm: "تم التأكيد",
  unreadable: "غير مقروء",
};
export type ReviewItem = { id: string; student: string; question: string; reason: string; extracted: string; suggestion: string; answerKey: string; imageUrl: string | null; severity: string };

export function ReviewView({ analysisId, reviewItems }: { analysisId: string; reviewItems: ReviewItem[] }) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [activeId, setActiveId] = useState(reviewItems[0].id);
  const [saving, setSaving] = useState(false);
  const active = reviewItems.find((item) => item.id === activeId) ?? reviewItems[0];
  const complete = Object.keys(decisions).length;
  const pending = reviewItems.length - complete;
  const progress = (complete / reviewItems.length) * 100;
  async function decide(value: Decision) {
    setSaving(true);
    const decision = value === "confirm" ? "ACCEPTED" : "EDITED";
    const response = await fetch(`/api/analyses/${analysisId}/review/${active.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision, teacherAnswer: value === "unreadable" ? "غير مقروء" : undefined }) });
    setSaving(false);
    if (!response.ok) return;
    setDecisions((current) => ({ ...current, [active.id]: value }));
    const next = reviewItems.find((item) => !decisions[item.id] && item.id !== active.id);
    if (next) setActiveId(next.id);
  }

  return (
    <div className="page-stack review-page">
      <PageHeading
        backHref={`/ar/analyses/${analysisId}/results`}
        backLabel="نتائج التحليل"
        eyebrow="قرار المعلم"
        title="قائمة المراجعة"
        description="راجع الإجابات التي لم يستطع النظام اعتمادها تلقائيًا، ثم أكّد الاقتراح أو صنّف الإجابة غير المقروءة."
        actions={<Link className={`primary-btn ${pending ? "disabled-link" : ""}`} aria-disabled={pending > 0} href={pending ? "#review-workspace" : `/ar/analyses/${analysisId}/groups`}><CheckCircle2 size={17} /> اعتماد النتائج</Link>}
      />

      <section className="review-progress panel" aria-label="تقدم المراجعة">
          <div><span className="progress-orb">{formatArabicNumber(complete)}</span><div><strong>{pending ? `تبقّى ${formatArabicNumber(pending)} من ${formatArabicNumber(reviewItems.length)}` : "اكتملت المراجعة"}</strong><small>{pending ? "كل قرار يُحفظ في سجل الجلسة" : "يمكنك الآن اعتماد النتائج"}</small></div></div>
        <div className="review-progress-bar"><i style={{ width: `${progress}%` }} /></div>
        <span>{formatArabicNumber(Math.round(progress))}٪</span>
      </section>

      <div id="review-workspace" className="review-workspace">
        <section className="panel review-queue" aria-labelledby="review-queue-title">
          <div className="panel-heading compact"><div><p className="eyebrow">إجابات تنتظر قرارك</p><h2 id="review-queue-title">الحالات</h2></div><span className="count-badge">{formatArabicNumber(reviewItems.length)}</span></div>
          <div className="review-item-list">
            {reviewItems.map((item) => {
              const chosen = decisions[item.id];
              return (
                <button key={item.id} className={`review-list-item ${active.id === item.id ? "active" : ""}`} onClick={() => setActiveId(item.id)}>
                  <span className={`severity-dot severity-${item.severity}`} />
                  <span className="review-list-copy"><strong><bdi dir="ltr">{item.student}</bdi> · {item.question.split("·")[0]}</strong><small>{item.reason}</small></span>
                  {chosen ? <span className="decision-done"><Check size={13} /> {DECISION_LABELS[chosen]}</span> : <ArrowLeft size={16} />}
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel review-detail" aria-labelledby="review-detail-title">
          <div className="review-detail-head">
            <div><span className={`severity-tag severity-${active.severity}`}><AlertCircle size={14} /> {active.reason}</span><h2 id="review-detail-title"><bdi dir="ltr">{active.student}</bdi> · {active.question}</h2></div>
          </div>
          <div className="paper-review-grid">
            <div className="paper-preview">
              <div className="paper-toolbar"><span><FileImage size={16} /> التسليم الأصلي للطالب</span>{active.imageUrl ? <a href={active.imageUrl} target="_blank" rel="noreferrer" aria-label="فتح صورة التسليم بالحجم الكامل"><Eye size={17} /></a> : null}</div>
              {active.imageUrl ? <div className="submission-preview-image" style={{ backgroundImage: `url(${active.imageUrl})` }} role="img" aria-label={`صورة تسليم ${active.student}`} /> : <div className="submission-preview-empty"><FileImage size={28} /><span>لا تتوفر صورة لهذا التسليم</span></div>}
            </div>
            <div className="extraction-panel">
              <p className="micro-label">الاستجابة المستخرجة</p>
              <blockquote>«{active.extracted}»</blockquote>
              <div className="suggestion-card"><span>اقتراح التحليل</span><strong>{active.suggestion}</strong><small>معيار التصحيح: {active.answerKey}</small></div>
              <div className="non-final-note"><AlertCircle size={16} /><span>هذا اقتراح مبني على الدليل، وليس حكمًا نهائيًا على الطالب.</span></div>
            </div>
          </div>
          <div className="review-decisions" aria-label="قرار المراجعة">
            <button disabled={saving} className={decisions[active.id] === "confirm" ? "selected" : ""} onClick={() => decide("confirm")}><CheckCircle2 size={17} /> تأكيد الاقتراح</button>
            <button disabled={saving} className={decisions[active.id] === "unreadable" ? "selected" : ""} onClick={() => decide("unreadable")}><FileImage size={17} /> غير مقروء</button>
          </div>
        </section>
      </div>
    </div>
  );
}
