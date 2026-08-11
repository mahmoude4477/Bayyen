import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  Download,
  FileCheck2,
  Printer,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { formatArabicNumber } from "@/lib/demo-data";
import { NAFS_OUTCOMES_URL } from "@/lib/nafs";
import { PageHeading } from "@/components/page-heading";
import { RunStatusNotice } from "@/components/run-status-notice";

export type ResultsData = {
  analysisId: string;
  inputMode: "FORM" | "PDF";
  population: number;
  sourceCount: number;
  evidenceCount: number;
  session: {
    title: string;
    subject: string;
    grade: string;
    classroom: string;
    completedAt: string;
    run: string;
    fixture: boolean;
    nafsAligned: boolean;
    nafsDomain: string | null;
    nafsFramework: string | null;
  };
  run: { status: string; progress: number };
  metrics: { label: string; value: string; hint: string; tone: string }[];
  gaps: { id: string; rank: string; title: string; description: string; affected: number; total: number; percent: number; evidence: string; color: string }[];
  groups: { id: string; label: string; count: number; color: string }[];
  reviewCount: number;
};

export function ResultsView({ data }: { data: ResultsData }) {
  const { analysisId, inputMode, population, sourceCount, evidenceCount, session, run, metrics, gaps, groups, reviewCount } = data;
  const isProcessing = ["QUEUED", "PROCESSING"].includes(run.status);
  return (
    <div className="page-stack results-page">
      <PageHeading
        eyebrow={`${session.subject} · ${session.grade} · ${session.classroom}`}
        title={session.title}
        description={isProcessing
          ? `بدأ التحليل ${session.completedAt} · ${session.run}`
          : `اكتمل التحليل ${session.completedAt} · تشغيل محفوظ ${session.run}`}
        actions={<><button className="secondary-btn"><Download size={17} /> تصدير</button><button className="secondary-btn"><Printer size={17} /> طباعة</button></>}
      />

      <RunStatusNotice analysisId={analysisId} initialStatus={run.status} initialProgress={run.progress} />

      {session.nafsAligned ? <div className="fixture-notice nafs-results-notice" role="note">
        <ShieldCheck size={18} />
        <div><strong>نواتج نافس مستخدمة في التحليل</strong><span>{session.nafsFramework} · {session.nafsDomain}. وُجّه Gemini لتصنيف الفجوات والخطط وفقها، مع اعتماد إجابات المعلم أساسًا للتصحيح. <a href={NAFS_OUTCOMES_URL} target="_blank" rel="noreferrer">وثيقة النواتج</a></span></div>
      </div> : null}

      {session.fixture ? <div className="fixture-notice" role="note">
        <ShieldCheck size={18} />
        <div><strong>نتائج تطوير محفوظة</strong><span>هذه البيانات من معالج <bdi dir="ltr">fixture</bdi> الموثّق وليست استدلال مزود إنتاج.</span></div>
      </div> : null}

      <section className="metric-grid" aria-label="مؤشرات التحليل">
        {metrics.map((metric) => (
          <article className={`metric-card metric-${metric.tone}`} key={metric.label}>
            <div className="metric-top"><span>{metric.label}</span><i /></div>
            <strong>{metric.value}</strong>
            <small>{metric.hint}</small>
          </article>
        ))}
      </section>

      <div className="results-layout">
        <section className="panel gap-panel" aria-labelledby="gaps-title">
          <div className="panel-heading">
            <div><p className="eyebrow">مرتبة حسب الانتشار</p><h2 id="gaps-title">أعلى فجوات التعلّم</h2></div>
            <span className="soft-badge"><Sparkles size={14} /> {formatArabicNumber(gaps.length)} أنماط واضحة</span>
          </div>
          <div className="gap-list">
            {gaps.map((gap) => (
              <Link href={`/ar/analyses/${analysisId}/gaps/${gap.id}`} className="gap-card" key={gap.id}>
                <span className="gap-rank">{gap.rank}</span>
                <div className="gap-main">
                  <h3>{gap.title}</h3>
                  <p>{gap.description}</p>
                  <div className="gap-evidence"><CircleDot size={14} /> {gap.evidence}</div>
                </div>
                <div className="gap-score">
                  <strong>{formatArabicNumber(gap.percent)}٪</strong>
                  <small>انتشار الفجوة</small>
                  <span>{formatArabicNumber(gap.affected)} من {formatArabicNumber(gap.total)} {gap.affected === 1 ? "لم يصل إلى الإتقان" : "لم يصلوا إلى الإتقان"}</span>
                  <div className="gap-bar"><i style={{ width: `${gap.percent}%`, background: gap.color }} /></div>
                </div>
                <ArrowLeft className="gap-arrow" size={18} />
              </Link>
            ))}
          </div>
        </section>

        <aside className="results-aside">
          <section className={`panel review-callout ${isProcessing ? "review-processing" : reviewCount === 0 ? "review-clear" : ""}`}>
            {isProcessing ? <>
              <span className="callout-icon"><Sparkles size={21} /></span>
              <div><p className="eyebrow">التحليل جارٍ</p><h2>تُحلل إجابات الطلاب الآن</h2></div>
              <p>ستظهر هنا الإجابات التي تحتاج قرارك بعد اكتمال التحليل.</p>
            </> : <>
              <span className="callout-icon">{reviewCount === 0 ? <CheckCircle2 size={21} /> : <AlertTriangle size={21} />}</span>
              <div>
                <p className="eyebrow">{reviewCount === 0 ? "المراجعة مكتملة" : "مراجعة المعلم"}</p>
                <h2>{reviewCount === 0 ? "لا توجد إجابات تحتاج مراجعتك" : `${formatArabicNumber(reviewCount)} إجابات تحتاج قرارك`}</h2>
              </div>
              <p>{reviewCount === 0 ? "كل الإجابات واضحة، ويمكنك الانتقال إلى قائمة الطلاب والمجموعات." : "هذه إجابات غير واضحة لم يعتمدها النظام تلقائيًا. افتحها ثم أكّد الاقتراح أو عدّله."}</p>
              <Link className="primary-btn full-btn" href={reviewCount === 0 ? `/ar/analyses/${analysisId}/groups` : `/ar/analyses/${analysisId}/review`}>
                {reviewCount === 0 ? "عرض الطلاب" : "فتح الإجابات للمراجعة"} <ArrowLeft size={17} />
              </Link>
            </>}
          </section>

          <section className="panel group-summary" aria-labelledby="groups-summary-title">
            <div className="panel-heading compact"><div><p className="eyebrow">توزيع مبدئي</p><h2 id="groups-summary-title">المجموعات</h2></div><UsersRound size={20} /></div>
            <div className="stacked-bar" aria-label="توزيع مجموعات الطلاب">
              {groups.map((group) => <i className={`group-${group.color}`} style={{ width: `${population ? (group.count / population) * 100 : 0}%` }} key={group.id} />)}
            </div>
            <div className="group-legend">
              {groups.map((group) => <div key={group.id}><span className={`dot group-${group.color}`} /><p>{group.label}</p><strong>{formatArabicNumber(group.count)} طالبًا</strong></div>)}
            </div>
            <Link className="text-link" href={`/ar/analyses/${analysisId}/groups`}>عرض الطلاب <ArrowLeft size={15} /></Link>
          </section>
        </aside>
      </div>

      <section className="evidence-thread" aria-labelledby="thread-title">
        <div><p className="eyebrow">من الدليل إلى القرار</p><h2 id="thread-title">كل استنتاج قابل للتتبّع</h2></div>
        <ol>
          <li><span><FileCheck2 size={18} /></span><div><strong>{formatArabicNumber(sourceCount)} {inputMode === "FORM" ? "تسليمات" : "أوراق"}</strong><small>{inputMode === "FORM" ? "إجابات رقمية محفوظة في قاعدة البيانات" : "ملفات خاصة ومتحقق منها"}</small></div></li>
          <li><span><CircleDot size={18} /></span><div><strong>{formatArabicNumber(evidenceCount)} دليلًا</strong><small>إجابات مرتبطة بالسؤال</small></div></li>
          <li><span><UsersRound size={18} /></span><div><strong>{formatArabicNumber(groups.length)} مجموعات</strong><small>سبب واضح لكل إسناد</small></div></li>
          <li><span><CheckCircle2 size={18} /></span><div><strong>قرار المعلم</strong><small>اعتماد محفوظ وقابل للمراجعة</small></div></li>
        </ol>
      </section>
    </div>
  );
}
