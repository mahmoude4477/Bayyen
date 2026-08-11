import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  ListChecks,
  PenLine,
  UserRound,
  UsersRound,
} from "lucide-react";
import { PageHeading } from "@/components/page-heading";

export type StudentSubmissionViewData = {
  id: string;
  studentCode: string;
  studentName: string;
  submittedAt: string;
  validPayload: boolean;
  answers: {
    questionId: string;
    position: number;
    prompt: string;
    type: "SHORT_ANSWER" | "MULTIPLE_CHOICE" | "INK";
    text: string | null;
    strokeCount: number;
  }[];
};

const questionTypeLabels = {
  SHORT_ANSWER: "إجابة قصيرة",
  MULTIPLE_CHOICE: "اختيار من متعدد",
  INK: "إجابة مرسومة",
} as const;

export function StudentSubmissionsView({
  analysisId,
  analysisTitle,
  submissions,
}: {
  analysisId: string;
  analysisTitle: string;
  submissions: StudentSubmissionViewData[];
}) {
  const questionCount = submissions[0]?.answers.length ?? 0;
  const answerCount = submissions.reduce((total, submission) => total + submission.answers.filter((answer) => answer.text || answer.strokeCount).length, 0);

  return (
    <div className="page-stack student-submissions-page">
      <PageHeading
        backHref={`/ar/analyses/${analysisId}`}
        backLabel="لوحة الاختبار"
        eyebrow={`الاختبار · ${analysisTitle}`}
        title="إجابات الطلاب"
        description="الإجابات الأصلية كما أرسلها الطلاب وحُفظت في قاعدة البيانات، قبل أي تصحيح أو تحليل آلي."
        actions={<Link className="secondary-btn" href={`/ar/analyses/${analysisId}/forms`}><FileText size={16} /> رابط الطلاب وحالة التسليم</Link>}
      />

      <section className="submission-summary-grid" aria-label="ملخص التسليمات">
        <article><span className="submission-summary-icon blue"><UsersRound size={20} /></span><div><small>التسليمات</small><strong>{submissions.length}</strong><p>طلاب أرسلوا إجاباتهم</p></div></article>
        <article><span className="submission-summary-icon teal"><ListChecks size={20} /></span><div><small>أسئلة الاختبار</small><strong>{questionCount}</strong><p>أسئلة في كل نموذج</p></div></article>
        <article><span className="submission-summary-icon amber"><CheckCircle2 size={20} /></span><div><small>الإجابات المحفوظة</small><strong>{answerCount}</strong><p>إجابات قابلة للاستعراض</p></div></article>
      </section>

      <section className="panel student-submissions-panel" aria-labelledby="student-submissions-title">
        <div className="panel-heading">
          <div><p className="eyebrow">سجل التسليم</p><h2 id="student-submissions-title">افتح اسم الطالب لعرض إجاباته</h2></div>
          <span className="soft-badge"><Clock3 size={14} /> مرتبة حسب وقت التسليم</span>
        </div>

        <div className="student-submission-list">
          {submissions.map((submission, submissionIndex) => (
            <details className="student-submission" key={submission.id} open={submissionIndex === 0}>
              <summary>
                <span className="submission-student-avatar"><UserRound size={18} /></span>
                <span className="submission-student-copy">
                  <strong>{submission.studentName}</strong>
                  <small><bdi dir="ltr">{submission.studentCode}</bdi> · سُلّم في {submission.submittedAt}</small>
                </span>
                <span className="submission-answer-count">{submission.answers.length} إجابات</span>
                <ChevronDown className="submission-chevron" size={18} aria-hidden="true" />
              </summary>

              <div className="submission-details-body">
                {!submission.validPayload ? <p className="submission-payload-warning">صيغة هذا التسليم قديمة أو غير مكتملة؛ نعرض ما أمكن قراءته منها.</p> : null}
                <ol className="submission-answer-list">
                  {submission.answers.map((answer) => (
                    <li className="submission-answer" key={answer.questionId}>
                      <span className="submission-question-number">{String(answer.position).padStart(2, "0")}</span>
                      <div>
                        <div className="submission-question-heading">
                          <h3>{answer.prompt}</h3>
                          <span>{questionTypeLabels[answer.type]}</span>
                        </div>
                        <div className={`submission-answer-value ${answer.text || answer.strokeCount ? "has-answer" : "is-empty"}`}>
                          {answer.type === "INK" ? <PenLine size={17} /> : <FileText size={17} />}
                          <p>{answer.text ?? (answer.strokeCount ? `إجابة مرسومة محفوظة (${answer.strokeCount} مسارات)` : "لم تُحفظ إجابة لهذا السؤال")}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
