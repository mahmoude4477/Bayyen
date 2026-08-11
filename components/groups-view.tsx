"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  Info,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import { formatArabicNumber } from "@/lib/demo-data";
import { PageHeading } from "@/components/page-heading";

export type GroupViewData = { id: string; key: string; label: string; title: string; color: string; description: string; students: { code: string; label: string }[]; planId: string | null };

export function GroupsView({ analysisId, groups }: { analysisId: string; groups: GroupViewData[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("ملاحظة المعلم بعد مراجعة إجابة الطالب");
  const selectedGroup = groups.find((group) => group.students.some((student) => student.code === selected));
  const studentLabels = new Map(groups.flatMap((group) => group.students.map((student) => [student.code, student.label] as const)));

  async function moveStudent(groupId: string) {
    if (!selected) return;
    const response = await fetch(`/api/analyses/${analysisId}/groups/move`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ studentCode: selected, targetGroupId: groupId, reason }) });
    if (!response.ok) return;
    setMoved((current) => ({ ...current, [selected]: groupId }));
    setSelected(null);
  }

  return (
    <div className="page-stack groups-page">
      <PageHeading
        backHref={`/ar/analyses/${analysisId}/results`}
        backLabel="نتائج التحليل"
        eyebrow="تجميع تعليمي مرن"
        title="مجموعات الطلاب"
        description="ثلاث مجموعات تصف الحاجة الحالية، لا مستوى الطالب الدائم. يمكنك نقل أي طالب مع حفظ السبب."
        actions={<Link className="primary-btn" href={`/ar/analyses/${analysisId}/plans`}><Sparkles size={17} /> فتح الخطط العلاجية</Link>}
      />
      <div className="group-principle"><Info size={18} /><span><strong>تجميع بلا وصم.</strong> تظهر أسماء الطلاب للمعلم فقط، ويظل سبب الإسناد واضحًا وقابلًا للمراجعة.</span></div>
      <section className="groups-board" aria-label="مجموعات الطلاب الثلاث">
        {groups.map((group) => {
          const visibleStudents = [
            ...group.students.map((student) => student.code).filter((student) => !moved[student] || moved[student] === group.id),
            ...Object.entries(moved).filter(([student, target]) => target === group.id && !group.students.some((item) => item.code === student)).map(([student]) => student),
          ];
          return (
            <article className={`group-column group-column-${group.color}`} key={group.id}>
              <header>
                <div className="group-icon"><UsersRound size={19} /></div>
                <div><p className="micro-label">مجموعة {group.label}</p><h2>{group.title}</h2></div>
                <span className="group-count">{formatArabicNumber(visibleStudents.length)}</span>
              </header>
              <p className="group-description">{group.description}</p>
              <div className="student-chip-list">
                {visibleStudents.map((student) => (
                  <button onClick={() => setSelected(student)} className={selected === student ? "selected" : ""} key={student}>
                    <span><UserRound size={14} /></span><bdi>{studentLabels.get(student) ?? student}</bdi><ArrowRightLeft size={13} />
                  </button>
                ))}
              </div>
              <footer>
                <div><span>سبب الإسناد</span><p>{group.key === "foundation" ? "خطأ مفاهيمي ظهر في سؤالين بثقة مرتفعة" : group.key === "practice" ? "إتقان جزئي يحتاج ممارسة موجّهة" : "أداء ثابت مع قدرة على تفسير الحل"}</p></div>
                {group.planId ? <Link href={`/ar/analyses/${analysisId}/plans/${group.planId}`}>فتح خطة المجموعة <ArrowLeft size={15} /></Link> : null}
              </footer>
            </article>
          );
        })}
      </section>
      {selected && (
        <div className="move-drawer" role="dialog" aria-modal="true" aria-labelledby="move-title">
          <button className="move-backdrop" onClick={() => setSelected(null)} aria-label="إغلاق" />
          <div className="move-card">
            <div><p className="eyebrow">تعديل مسجّل</p><h2 id="move-title">نقل الطالب <bdi>{studentLabels.get(selected) ?? selected}</bdi></h2><p>المجموعة الحالية: {selectedGroup?.label ?? "معدّلة"}. اختر المجموعة الجديدة.</p></div>
            <div className="move-options">{groups.map((group) => <button onClick={() => moveStudent(group.id)} key={group.id}><span className={`dot group-${group.color}`} /><div><strong>{group.label}</strong><small>{group.title}</small></div><CheckCircle2 size={17} /></button>)}</div>
            <label>سبب النقل<textarea placeholder="اكتب سببًا موجزًا يساعد في تتبع القرار" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            <button className="secondary-btn" onClick={() => setSelected(null)}>إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}
