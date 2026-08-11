import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  FilePlus2,
  MoreHorizontal,
  ScanLine,
} from "lucide-react";
import { formatArabicNumber } from "@/lib/demo-data";

export type DashboardSession = {
  id: string;
  title: string;
  meta: string;
  date: string;
  status: string;
  progress: number;
  studentCount: number;
  href: string;
};

export function DashboardView({ sessions, userName, stats }: { sessions: DashboardSession[]; userName: string; stats: { sessions: number; pendingReview: number; approvedPlans: number } }) {
  return (
    <div className="page-stack dashboard-page">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">مساحة الاختبارات</p>
          <h1>اختبارات {userName}</h1>
          <p>اختر اختبارًا لفتح لوحته الخاصة ومتابعة إجاباته وتحليله ومراجعته ومجموعاته، أو أنشئ اختبارًا جديدًا.</p>
        </div>
        <Link className="primary-btn" href="/ar/analyses/new"><FilePlus2 size={18} /> إنشاء اختبار جديد</Link>
      </section>

      <section aria-labelledby="overview-title">
        <div className="section-heading"><div><p className="eyebrow">ملخص جميع الاختبارات</p><h2 id="overview-title">نظرة عامة</h2></div></div>
        <div className="dashboard-stats">
          <article className="dashboard-stat"><span className="stat-icon coral"><ScanLine size={20} /></span><div><p>كل الاختبارات</p><strong>{formatArabicNumber(stats.sessions)}</strong><span>اختبارات محفوظة في حسابك</span></div></article>
          <article className="dashboard-stat"><span className="stat-icon amber"><Clock3 size={20} /></span><div><p>بانتظار قرارك</p><strong>{formatArabicNumber(stats.pendingReview)}</strong><span>إجابات من مختلف الاختبارات</span></div></article>
          <article className="dashboard-stat"><span className="stat-icon teal"><CheckCircle2 size={20} /></span><div><p>خطط معتمدة</p><strong>{formatArabicNumber(stats.approvedPlans)}</strong><span>خطط علاجية جاهزة للتنفيذ</span></div></article>
        </div>
      </section>

      <section className="recent-panel" aria-labelledby="recent-title">
        <div className="section-heading">
          <div><p className="eyebrow">مرتبة حسب آخر تحديث</p><h2 id="recent-title">كل الاختبارات</h2></div>
          <span className="soft-badge">{formatArabicNumber(sessions.length)} اختبار</span>
        </div>
        <div className="session-list">
          {!sessions.length && <div className="dashboard-empty"><FilePlus2 size={24} /><strong>لا توجد اختبارات بعد</strong><span>أنشئ أول اختبار لتظهر لوحته وحالة طلابه هنا.</span><Link className="primary-btn" href="/ar/analyses/new">إنشاء اختبار جديد</Link></div>}
          {sessions.map((item) => (
            <Link className="session-row" href={item.href} key={item.id}>
              <span className="session-doc-icon"><span /></span>
              <span className="session-name"><strong>{item.title}</strong><small>{item.meta}</small></span>
              <span className={`status-pill status-${item.status === "مكتمل" ? "complete" : item.status === "مسودة" ? "draft" : "review"}`}>{item.status}</span>
              <span className="session-progress"><span><i style={{ width: `${item.progress}%` }} /></span><small>{formatArabicNumber(item.progress)}٪</small></span>
              <time>{item.date}</time>
              <MoreHorizontal size={19} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
