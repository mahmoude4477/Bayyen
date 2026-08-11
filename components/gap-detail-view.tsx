import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CircleDot,
  FileSearch,
  Lightbulb,
  UsersRound,
} from "lucide-react";
import { formatArabicNumber } from "@/lib/demo-data";
import { PageHeading } from "@/components/page-heading";

type EvidenceItem = {
  student: string;
  questionPosition: number;
  answer: string;
  expectedAnswer: string;
  mastery: string;
  explanation: string;
};

type QuestionBreakdown = {
  position: number;
  prompt: string;
  affected: number;
  total: number;
  percent: number;
};

export type GapDetailData = {
  title: string;
  description: string;
  percent: number;
  affected: number;
  total: number;
  objectiveTitle: string;
  question: { position: number; prompt: string; answerKey: string };
  evidence: EvidenceItem[];
  why: string;
  quality: { title: string; description: string };
  questions: QuestionBreakdown[];
};

export function GapDetailView({ analysisId, gap }: { analysisId: string; gap: GapDetailData }) {
  return (
    <div className="page-stack gap-detail-page">
      <PageHeading
        backHref={`/ar/analyses/${analysisId}/results`}
        backLabel="العودة إلى النتائج"
        eyebrow="شرح فجوة التعلّم"
        title={gap.title}
        description="هذه الصفحة تشرح بالأرقام والإجابات الفعلية لماذا صنّف النظام هذا السؤال كفجوة محتملة. القرار النهائي للمعلم."
        actions={<Link className="primary-btn" href={`/ar/analyses/${analysisId}/groups`}><UsersRound size={17} /> مجموعات الطلاب <ArrowLeft size={16} /></Link>}
      />

      <section className="gap-hero panel">
        <div className="gap-hero-score"><strong>{formatArabicNumber(gap.percent)}٪</strong><span>{formatArabicNumber(gap.affected)} من {formatArabicNumber(gap.total)} طلاب لم يصلوا إلى الإتقان</span><div><i style={{ width: `${gap.percent}%` }} /></div></div>
        <div><p className="eyebrow">هدف التعلّم</p><h2>{gap.objectiveTitle}</h2><p><strong>السؤال {formatArabicNumber(gap.question.position)}:</strong> {gap.question.prompt}</p></div>
      </section>

      <div className="gap-detail-layout">
        <section className="panel evidence-panel" aria-labelledby="evidence-title">
          <div className="panel-heading"><div><p className="eyebrow">إجابات فعلية</p><h2 id="evidence-title">ما الذي أجاب به الطلاب؟</h2></div><span className="soft-badge"><FileSearch size={14} /> {formatArabicNumber(gap.affected)} {gap.affected === 1 ? "إجابة متأثرة" : "إجابات متأثرة"}</span></div>
          <div className="evidence-cards">
            {gap.evidence.map((item) => (
              <article key={`${item.student}-${item.questionPosition}`}>
                <div className="evidence-card-head"><span className="evidence-code">{item.student} · السؤال {formatArabicNumber(item.questionPosition)}</span><span className="evidence-mastery">{item.mastery}</span></div>
                <div className="answer-comparison"><div><small>إجابة الطالب</small><blockquote>«{item.answer || "لم تُستخرج إجابة"}»</blockquote></div><div><small>الإجابة الصحيحة أو المعيار</small><p>{item.expectedAnswer}</p></div></div>
                <p><CircleDot size={13} /> {item.explanation}</p>
                <a href={`#question-${item.questionPosition}`}>عرض السؤال ضمن الهدف <ArrowLeft size={14} /></a>
              </article>
            ))}
            {!gap.evidence.length ? <div className="evidence-empty">لا توجد إجابة قابلة للعرض. راجع الحالات غير المقروءة في قائمة المراجعة.</div> : null}
          </div>
          <div className="why-box"><span><Lightbulb size={19} /></span><div><strong>لماذا ظهرت هذه الفجوة؟</strong><p>{gap.why}</p></div></div>
        </section>

        <aside className="panel question-signal">
          <span className="callout-icon"><AlertTriangle size={21} /></span>
          <p className="eyebrow">هل المشكلة من صياغة السؤال؟</p>
          <h2>{gap.quality.title}</h2>
          <p>{gap.quality.description}</p>
          <small>هذا مؤشر مساعد مبني على مقارنة نتائج الأسئلة، وليس حكمًا آليًا على جودة السؤال ولا يغيّر درجات الطلاب.</small>
        </aside>
      </div>

      <section id="questions" className="panel question-breakdown">
        <div className="panel-heading"><div><p className="eyebrow">أسئلة هدف التعلّم نفسه</p><h2>في أي سؤال ظهر التعثر؟</h2></div><span className="soft-badge">النسبة = غير متقن أو إتقان جزئي</span></div>
        {gap.questions.map((question) => (
          <div id={`question-${question.position}`} className="question-row" key={question.position}>
            <span>س{formatArabicNumber(question.position)}</span>
            <div><strong>{question.prompt}</strong><small>{formatArabicNumber(question.affected)} من {formatArabicNumber(question.total)} طلاب تعثروا</small></div>
            <div className="question-bar"><i style={{ width: `${question.percent}%` }} /></div>
            <strong>{formatArabicNumber(question.percent)}٪</strong>
          </div>
        ))}
      </section>
    </div>
  );
}
