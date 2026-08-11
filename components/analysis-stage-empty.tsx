import Link from "next/link";
import { ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import { PageHeading } from "@/components/page-heading";

export function AnalysisStageEmpty({
  analysisId,
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel,
  complete = false,
}: {
  analysisId: string;
  eyebrow: string;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
  complete?: boolean;
}) {
  const Icon = complete ? CheckCircle2 : Sparkles;
  return (
    <div className="page-stack analysis-empty-page">
      <PageHeading
        backHref={`/ar/analyses/${analysisId}`}
        backLabel="لوحة الاختبار"
        eyebrow={eyebrow}
        title={title}
        description={description}
      />
      <section className={`panel analysis-empty-state ${complete ? "is-complete" : ""}`}>
        <span><Icon size={27} /></span>
        <div><h2>{title}</h2><p>{description}</p></div>
        <div className="analysis-empty-actions">
          <Link className="primary-btn" href={actionHref}>{actionLabel} <ArrowLeft size={16} /></Link>
          <Link className="secondary-btn" href={`/ar/analyses/${analysisId}`}>العودة إلى لوحة الاختبار</Link>
        </div>
      </section>
    </div>
  );
}
