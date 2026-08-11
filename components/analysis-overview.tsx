import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Link2,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { formatArabicNumber } from "@/lib/demo-data";
import { PageHeading } from "@/components/page-heading";

export type AnalysisOverviewData = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  lesson: string | null;
  classroom: string;
  inputMode: "FORM" | "PDF";
  statusLabel: string;
  updatedAt: string;
  submissionCount: number;
  assetCount: number;
  run: { status: string; progress: number; version: number } | null;
  evidenceCount: number;
  pendingReview: number;
  gapCount: number;
  groupCount: number;
  planCount: number;
  approvedPlanCount: number;
};

export function AnalysisOverview({ data }: { data: AnalysisOverviewData }) {
  const hasRun = Boolean(data.run);
  const isProcessing = data.run ? ["QUEUED", "PROCESSING"].includes(data.run.status) : false;
  const nextHref = !hasRun && data.inputMode === "FORM"
    ? `/ar/analyses/${data.id}/forms`
    : data.pendingReview > 0
      ? `/ar/analyses/${data.id}/review`
      : hasRun
        ? `/ar/analyses/${data.id}/results`
        : "/ar/dashboard";
  const nextLabel = !hasRun && data.inputMode === "FORM"
    ? "استقبال إجابات الطلاب"
    : data.pendingReview > 0
      ? `مراجعة ${formatArabicNumber(data.pendingReview)} إجابات`
      : isProcessing
        ? "متابعة التحليل"
        : hasRun
          ? "فتح نتائج التحليل"
          : "العودة إلى الاختبارات";
  const nextDescription = !hasRun && data.inputMode === "FORM"
    ? "شارك رابط الاختبار وتابع وصول التسليمات، ثم ابدأ التحليل عندما تصبح الإجابات جاهزة."
    : data.pendingReview > 0
      ? "هناك إجابات لم يعتمدها النظام تلقائيًا وتحتاج قرارك قبل الانتقال إلى التدخل التعليمي."
      : isProcessing
        ? "التحليل يعمل الآن وستتحدث النتائج تلقائيًا حتى يكتمل التشغيل."
        : hasRun
          ? "النتائج جاهزة لقراءة فجوات التعلّم ومراجعة الأدلة والمجموعات المقترحة."
          : "لم يبدأ تشغيل التحليل لهذا الاختبار بعد.";

  const stages = [
    {
      title: data.inputMode === "FORM" ? "إجابات الطلاب" : "ملفات الطلاب",
      value: formatArabicNumber(data.inputMode === "FORM" ? data.submissionCount : data.assetCount),
      description: data.inputMode === "FORM" ? "افتح كل طالب واقرأ إجاباته الأصلية" : "ملفات مرتبطة بهذا الاختبار",
      href: data.inputMode === "FORM" ? `/ar/analyses/${data.id}/submissions` : null,
      icon: FileCheck2,
      tone: "blue",
    },
    {
      title: "نتائج التحليل",
      value: hasRun ? (isProcessing ? `${formatArabicNumber(data.run?.progress ?? 0)}٪` : formatArabicNumber(data.evidenceCount)) : "—",
      description: hasRun ? (isProcessing ? "نسبة اكتمال التشغيل الحالي" : "أدلة مصنفة وقابلة للتتبع") : "تظهر بعد بدء التحليل",
      href: hasRun ? `/ar/analyses/${data.id}/results` : null,
      icon: BarChart3,
      tone: "teal",
    },
    {
      title: "قائمة المراجعة",
      value: hasRun ? formatArabicNumber(data.pendingReview) : "—",
      description: data.pendingReview ? "إجابات تنتظر قرار المعلم" : hasRun ? "لا توجد حالات معلّقة" : "تظهر بعد التحليل",
      href: hasRun ? `/ar/analyses/${data.id}/review` : null,
      icon: ClipboardCheck,
      tone: data.pendingReview ? "amber" : "teal",
    },
    {
      title: "مجموعات الطلاب",
      value: hasRun ? formatArabicNumber(data.groupCount) : "—",
      description: data.groupCount ? `${formatArabicNumber(data.gapCount)} فجوات تعلّم وراء التجميع` : hasRun ? "لا توجد مجموعات مولّدة" : "تظهر بعد التحليل",
      href: hasRun ? `/ar/analyses/${data.id}/groups` : null,
      icon: UsersRound,
      tone: "coral",
    },
    {
      title: "الخطط العلاجية",
      value: hasRun ? formatArabicNumber(data.planCount) : "—",
      description: data.approvedPlanCount ? `${formatArabicNumber(data.approvedPlanCount)} خطط معتمدة` : hasRun ? "لا توجد خطط معتمدة بعد" : "تظهر بعد التحليل",
      href: hasRun ? `/ar/analyses/${data.id}/plans` : null,
      icon: BookOpenCheck,
      tone: "violet",
    },
  ];

  return (
    <div className="page-stack analysis-overview-page">
      <PageHeading
        backHref="/ar/dashboard"
        backLabel="كل الاختبارات"
        eyebrow="لوحة الاختبار"
        title={data.title}
        description={`${data.subject} · ${data.grade}${data.lesson ? ` · ${data.lesson}` : ""} · ${data.classroom} · آخر تحديث ${data.updatedAt}`}
        actions={data.inputMode === "FORM" || hasRun ? (
          <Link className="secondary-btn" href={data.inputMode === "FORM" ? `/ar/analyses/${data.id}/forms` : `/ar/analyses/${data.id}/results`}>
            <Link2 size={16} /> {data.inputMode === "FORM" ? "رابط الطلاب" : "ملفات الاختبار"}
          </Link>
        ) : undefined}
      />

      <section className="analysis-next-step" aria-labelledby="analysis-next-title">
        <div className="analysis-next-icon"><Sparkles size={23} /></div>
        <div>
          <p className="eyebrow">الخطوة التالية · {data.statusLabel}</p>
          <h2 id="analysis-next-title">{nextLabel}</h2>
          <p>{nextDescription}</p>
        </div>
        <Link className="analysis-next-action" href={nextHref}>{nextLabel} <ArrowLeft size={17} /></Link>
      </section>

      <section aria-labelledby="analysis-stages-title">
        <div className="section-heading">
          <div><p className="eyebrow">مسار هذا الاختبار</p><h2 id="analysis-stages-title">من الإجابة إلى الخطة العلاجية</h2></div>
          {data.run && <span className="soft-badge"><CheckCircle2 size={14} /> تشغيل {String(data.run.version).padStart(3, "0")}</span>}
        </div>
        <div className="analysis-stage-grid">
          {stages.map((stage) => {
            const Icon = stage.icon;
            const content = <>
              <span className={`analysis-stage-icon stage-${stage.tone}`}><Icon size={20} /></span>
              <div><p>{stage.title}</p><strong>{stage.value}</strong><small>{stage.description}</small></div>
              {stage.href && <ArrowLeft className="analysis-stage-arrow" size={17} />}
            </>;
            return stage.href
              ? <Link className="analysis-stage-card" href={stage.href} key={stage.title}>{content}</Link>
              : <article className="analysis-stage-card is-disabled" key={stage.title}>{content}</article>;
          })}
        </div>
      </section>
    </div>
  );
}
