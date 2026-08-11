"use client";

import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  Printer,
  Save,
  Sparkles,
} from "lucide-react";
import { PageHeading } from "@/components/page-heading";

export type PlanData = { id: string; analysisId: string; groupLabel: string; groupCount: number; title: string; version: number; status: string; duration: string; objective: string; teacherSteps: string[]; explanation: string; example: string; activity: string; practice: string[]; exitTicket: { question: string; answer: string }[]; adaptations: Record<string, string> };

function parseExitTickets(value: string, fallback: PlanData["exitTicket"]) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const separator = line.indexOf(" — ");
    if (separator === -1) {
      return { question: line, answer: fallback[index]?.answer ?? "إجابة وفق معيار النجاح" };
    }
    return {
      question: line.slice(0, separator).trim(),
      answer: line.slice(separator + 3).trim() || fallback[index]?.answer || "إجابة وفق معيار النجاح",
    };
  });
}

export function PlanView({ data }: { data: PlanData }) {
  const [editing, setEditing] = useState(false);
  const [approved, setApproved] = useState(data.status === "APPROVED");
  const [saved, setSaved] = useState(true);
  const [activePlanId, setActivePlanId] = useState(data.id);
  const [content, setContent] = useState([data.objective, data.teacherSteps.join("\n"), data.activity, data.practice.join("\n"), data.exitTicket.map((item) => `${item.question} — ${item.answer}`).join("\n")]);
  const sections = ["الهدف", "خطوات المعلم", "النشاط", "التدريب", "اختبار الخروج"];

  async function savePlan(approve = false) {
    setSaved(false);
    const response = await fetch(`/api/analyses/${data.analysisId}/plans/${activePlanId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({
      objective: content[0], duration: data.duration, teacherSteps: content[1].split("\n").filter(Boolean),
      explanation: data.explanation, example: data.example, activity: content[2], practice: content[3].split("\n").filter(Boolean),
      exitTicket: parseExitTickets(content[4], data.exitTicket),
      adaptations: data.adaptations,
      approve,
    }) });
    if (response.ok) {
      const result = await response.json();
      setActivePlanId(result.planId);
      setApproved(approve);
      setEditing(false);
      setSaved(true);
    }
  }

  return (
    <div className="page-stack plan-page">
      <PageHeading
        backHref={`/ar/analyses/${data.analysisId}/groups`}
        backLabel="مجموعات الطلاب"
        eyebrow={`خطة مجموعة ${data.groupLabel} · ${data.groupCount} طالبًا`}
        title={data.title}
        description="نسخة مولّدة قابلة للتحرير. يبقى الأصل محفوظًا ويُسجّل كل اعتماد."
        actions={<><button className="secondary-btn" onClick={() => window.print()}><Printer size={17} /> طباعة</button><button className="primary-btn" onClick={() => savePlan(true)}><CheckCircle2 size={17} /> {approved ? "تم الاعتماد" : "اعتماد الخطة"}</button></>}
      />
      <section className="plan-status panel">
        <div className={`status-seal ${approved ? "approved" : ""}`}>{approved ? <Check size={18} /> : <Sparkles size={18} />}</div>
        <div><p className="micro-label">حالة النسخة</p><strong>{approved ? "معتمدة من المعلم" : editing ? "نسخة معدّلة من المعلم" : "نسخة مولّدة"}</strong><small><bdi dir="ltr">PLAN-V{data.version}</bdi> · محفوظة في سجل الخطة</small></div>
        <div className="autosave"><span className={saved ? "saved" : "saving"} /> {saved ? "تم حفظ المسودة" : "جارٍ الحفظ…"}</div>
        <button className="secondary-btn" onClick={() => setEditing((value) => !value)}>{editing ? <Eye size={16} /> : <Copy size={16} />}{editing ? "معاينة" : "إنشاء نسخة تحرير"}</button>
      </section>
      <div className="plan-layout">
        <section className="panel plan-document" aria-labelledby="plan-content-title">
          <div className="plan-doc-head"><div><p className="eyebrow">الخطة العلاجية</p><h2 id="plan-content-title">{data.duration}</h2></div><span><Clock3 size={16} /> {data.duration}</span></div>
          {sections.map((label, index) => (
            <article className="plan-section" key={label}>
              <span className="plan-section-number">{String(index + 1).padStart(2, "0")}</span>
              <div><h3>{label}</h3>{editing ? <textarea value={content[index]} onChange={(event) => { setContent((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value)); setSaved(false); }} /> : <p>{content[index]}</p>}</div>
            </article>
          ))}
          {editing && <button className="save-plan-btn" onClick={() => savePlan(false)}><Save size={17} /> حفظ النسخة</button>}
        </section>
      </div>
    </div>
  );
}
