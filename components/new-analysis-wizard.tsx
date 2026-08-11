"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  FileCheck2,
  FileText,
  GripVertical,
  ListChecks,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  UploadCloud,
  UsersRound,
} from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { formatArabicInteger, REQUIRED_STUDENT_COUNT, studentCode } from "@/lib/analysis-config";
import { canonicalizeSubject, getNafsLearningOutcomes, NAFS_OUTCOMES_URL, resolveNafsAlignment } from "@/lib/nafs";
import { STORAGE_DISABLED_MESSAGE, STORAGE_ENABLED } from "@/lib/storage-config";

type QuestionType = "SHORT_ANSWER" | "MULTIPLE_CHOICE" | "INK";
type ObjectiveDraft = { code: string; title: string; branch?: string; source: "NAFS" | "TEACHER" };
type QuestionBlueprint = Record<QuestionType, number>;
type GeneratedQuestion = {
  type: QuestionType;
  objectiveCode: string;
  prompt: string;
  choices: string[];
  answerKey: string;
  rubric: string;
};

const steps = [
  { title: "نطاق الاختبار", icon: BookOpen },
  { title: "الأهداف والمواصفات", icon: Target },
  { title: "مراجعة الأسئلة", icon: FileText },
  { title: "طريقة الإجابة", icon: UploadCloud },
  { title: "المراجعة والنشر", icon: CheckCircle2 },
];

const DEFAULT_BLUEPRINT: QuestionBlueprint = {
  MULTIPLE_CHOICE: 2,
  SHORT_ANSWER: 3,
  INK: 0,
};

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: "اختيار من متعدد",
  SHORT_ANSWER: "مقالي / إجابة مفتوحة",
  INK: "رسم أو إجابة بصورة",
};

function teacherObjectiveCode(objectives: ObjectiveDraft[]) {
  for (let index = 1; index <= 99; index += 1) {
    const code = `TEACHER-${String(index).padStart(2, "0")}`;
    if (!objectives.some((objective) => objective.code === code)) return code;
  }
  return `TEACHER-${Date.now().toString().slice(-6)}`;
}

export function NewAnalysisWizard() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const loadedObjectiveKey = useRef("");
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState({ title: "", subject: "", grade: "", classroom: "" });
  const [objectives, setObjectives] = useState<ObjectiveDraft[]>([{ code: "TEACHER-01", title: "", source: "TEACHER" }]);
  const [blueprint, setBlueprint] = useState<QuestionBlueprint>(DEFAULT_BLUEPRINT);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>([]);
  const [questionChoices, setQuestionChoices] = useState<string[][]>([]);
  const [questionObjectiveCodes, setQuestionObjectiveCodes] = useState<string[]>([]);
  const [inputMode, setInputMode] = useState<"FORM" | "PDF">("FORM");
  const [files, setFiles] = useState<File[]>([]);
  const [uploaded, setUploaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedBy, setGeneratedBy] = useState("");
  const [running, setRunning] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");

  const nafsAlignment = resolveNafsAlignment(details);
  const questionTotal = Object.values(blueprint).reduce((sum, count) => sum + count, 0);
  const questionTotalValid = questionTotal >= 5 && questionTotal <= 10;

  function previous() {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
  }

  function loadScienceDemo() {
    const nextDetails = { title: "اختبار تشخيصي في العلوم", subject: "العلوم", grade: "الصف السادس الابتدائي", classroom: "السادس / أ" };
    const outcomes = getNafsLearningOutcomes(nextDetails);
    setDetails(nextDetails);
    setObjectives(outcomes.map((outcome) => ({ ...outcome, source: "NAFS" })));
    loadedObjectiveKey.current = `${nextDetails.subject}|${nextDetails.grade}`;
    setBlueprint(DEFAULT_BLUEPRINT);
    setQuestions([]);
    setAnswers([]);
    setQuestionTypes([]);
    setQuestionChoices([]);
    setQuestionObjectiveCodes([]);
    setGeneratedBy("");
    setError("");
  }

  function prepareAssessmentScope() {
    if (Object.values(details).some((value) => !value.trim())) {
      setError("أكمل اسم الاختبار والمادة والصف والفصل.");
      return;
    }
    const normalizedSubject = canonicalizeSubject(details.subject, details.grade);
    const normalizedDetails = { ...details, subject: normalizedSubject };
    const outcomes = getNafsLearningOutcomes(normalizedDetails);
    const sourceKey = `${normalizedSubject}|${details.grade}`;
    setDetails(normalizedDetails);
    if (outcomes.length && loadedObjectiveKey.current !== sourceKey) {
      setObjectives(outcomes.map((outcome) => ({ ...outcome, source: "NAFS" })));
      loadedObjectiveKey.current = sourceKey;
      setQuestions([]);
      setAnswers([]);
      setQuestionTypes([]);
      setQuestionChoices([]);
      setQuestionObjectiveCodes([]);
      setGeneratedBy("");
    }
    setError("");
    setStep(1);
  }

  function updateBlueprint(type: QuestionType, value: number) {
    setBlueprint((current) => ({ ...current, [type]: Math.max(0, Math.min(10, Number.isFinite(value) ? value : 0)) }));
  }

  async function generateQuestions() {
    const cleanObjectives = objectives.filter((objective) => objective.title.trim());
    if (cleanObjectives.length !== objectives.length || cleanObjectives.length === 0) {
      setError("أكمل جميع أهداف التعلّم أو احذف الهدف الفارغ قبل التوليد.");
      return;
    }
    if (questionTotal < 5 || questionTotal > 10) {
      setError("اختر مجموعًا من ٥ إلى ١٠ أسئلة.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const response = await fetch("/api/assessments/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...details,
          subject: nafsAlignment.subject,
          objectives: cleanObjectives.map(({ code, title }) => ({ code, title })),
          blueprint,
        }),
      });
      const result = await response.json() as { error?: string; generatedBy?: string; questions?: GeneratedQuestion[] };
      if (!response.ok || !result.questions) throw new Error(result.error ?? "تعذر توليد الأسئلة.");
      setQuestions(result.questions.map((question) => question.prompt));
      setAnswers(result.questions.map((question) => question.answerKey));
      setQuestionTypes(result.questions.map((question) => question.type));
      setQuestionChoices(result.questions.map((question) => question.choices));
      setQuestionObjectiveCodes(result.questions.map((question) => question.objectiveCode));
      setGeneratedBy(result.generatedBy ?? "Gemini");
      setStep(2);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر توليد الأسئلة.");
    } finally {
      setGenerating(false);
    }
  }

  function validateQuestions() {
    const baseInvalid = questions.length < 5
      || questions.length > 10
      || questions.some((question) => !question.trim())
      || answers.some((answer) => !answer.trim());
    const multipleChoiceInvalid = questionTypes.some((type, index) => type === "MULTIPLE_CHOICE" && (
      questionChoices[index]?.length !== 4
      || questionChoices[index].some((choice) => !choice.trim())
      || new Set(questionChoices[index].map((choice) => choice.trim())).size !== 4
      || !questionChoices[index].includes(answers[index])
    ));
    if (baseInvalid || multipleChoiceInvalid) {
      setError("راجع الأسئلة والإجابات. كل سؤال اختياري يحتاج أربعة بدائل مختلفة وتحديد الإجابة الصحيحة.");
      return false;
    }
    setError("");
    return true;
  }

  function next() {
    if (step === 0) {
      prepareAssessmentScope();
      return;
    }
    if (step === 2 && !validateQuestions()) return;
    setError("");
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function chooseFiles(selected: FileList | null) {
    const nextFiles = Array.from(selected ?? []).sort((first, second) => first.name.localeCompare(second.name, undefined, { numeric: true }));
    setFiles(nextFiles);
    setUploaded(nextFiles.length === REQUIRED_STUDENT_COUNT);
    setError(nextFiles.length === REQUIRED_STUDENT_COUNT ? "" : `اختر ${formatArabicInteger(REQUIRED_STUDENT_COUNT)} ملفات بالضبط، ملفًا واحدًا لكل رمز طالب.`);
  }

  function removeObjective(index: number) {
    setObjectives((current) => {
      if (current.length === 1) return current;
      const removedCode = current[index].code;
      const nextObjectives = current.filter((_, objectiveIndex) => objectiveIndex !== index);
      setQuestionObjectiveCodes((codes) => codes.map((code) => code === removedCode ? nextObjectives[0].code : code));
      return nextObjectives;
    });
  }

  function changeQuestionType(index: number, type: QuestionType) {
    setQuestionTypes((current) => current.map((item, itemIndex) => itemIndex === index ? type : item));
    setQuestionChoices((current) => current.map((choices, itemIndex) => itemIndex === index
      ? type === "MULTIPLE_CHOICE" ? choices.length === 4 ? choices : ["", "", "", ""] : []
      : choices));
    if (type === "MULTIPLE_CHOICE") setAnswers((current) => current.map((answer, itemIndex) => itemIndex === index ? "" : answer));
  }

  function updateChoice(questionIndex: number, choiceIndex: number, value: string) {
    setQuestionChoices((current) => current.map((choices, itemIndex) => {
      if (itemIndex !== questionIndex) return choices;
      const previousChoice = choices[choiceIndex];
      if (answers[questionIndex] === previousChoice) {
        setAnswers((currentAnswers) => currentAnswers.map((answer, answerIndex) => answerIndex === questionIndex ? value : answer));
      }
      return choices.map((choice, index) => index === choiceIndex ? value : choice);
    }));
  }

  function removeQuestion(index: number) {
    setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setAnswers((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setQuestionTypes((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setQuestionChoices((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setQuestionObjectiveCodes((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function addQuestion() {
    if (questions.length >= 10) return;
    setQuestions((current) => [...current, ""]);
    setAnswers((current) => [...current, ""]);
    setQuestionTypes((current) => [...current, "SHORT_ANSWER"]);
    setQuestionChoices((current) => [...current, []]);
    setQuestionObjectiveCodes((current) => [...current, objectives[0]?.code ?? "TEACHER-01"]);
  }

  async function startAnalysis() {
    if (inputMode === "PDF" && !STORAGE_ENABLED) {
      setError(STORAGE_DISABLED_MESSAGE);
      return;
    }
    const missingDetails = Object.values(details).some((value) => !value.trim());
    const invalidObjectives = objectives.length === 0 || objectives.some((objective) => !objective.title.trim());
    if ((inputMode === "PDF" && files.length !== REQUIRED_STUDENT_COUNT) || missingDetails || invalidObjectives || !validateQuestions()) {
      if (!error) setError(inputMode === "PDF" ? `أكمل إعداد الاختبار ثم اختر ${formatArabicInteger(REQUIRED_STUDENT_COUNT)} ملفات.` : "أكمل إعداد الاختبار والأسئلة ومعايير التصحيح.");
      return;
    }
    setRunning(true);
    setError("");
    try {
      const create = await fetch("/api/analyses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...details,
          subject: nafsAlignment.subject,
          inputMode,
          objectives: objectives.map(({ code, title }) => ({ code, title })),
          questions: questions.map((prompt, index) => ({
            objectiveCode: questionObjectiveCodes[index] ?? objectives[0].code,
            type: questionTypes[index] ?? "SHORT_ANSWER",
            prompt,
            choices: questionTypes[index] === "MULTIPLE_CHOICE" ? questionChoices[index] : [],
            answerKey: answers[index],
            rubric: answers[index],
          })),
        }),
      });
      const created = await create.json();
      if (!create.ok) throw new Error(created.error ?? "تعذر إنشاء الجلسة.");
      if (inputMode === "FORM") {
        router.push(`/ar/analyses/${created.analysisId}/forms`);
        return;
      }
      let cursor = 0;
      let completed = 0;
      async function worker() {
        while (cursor < files.length) {
          const index = cursor++;
          const file = files[index];
          const presign = await fetch(`/api/analyses/${created.analysisId}/assets/presign`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size, studentCode: studentCode(index) }),
          });
          const signed = await presign.json();
          if (!presign.ok) throw new Error(signed.error ?? `تعذر تجهيز ${file.name}`);
          const upload = await fetch(signed.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
          if (!upload.ok) throw new Error(`تعذر رفع ${file.name}`);
          const complete = await fetch(`/api/analyses/${created.analysisId}/assets/complete`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ assetId: signed.assetId }),
          });
          if (!complete.ok) throw new Error((await complete.json()).error ?? `تعذر تأكيد ${file.name}`);
          completed += 1;
          setUploadProgress(Math.round((completed / REQUIRED_STUDENT_COUNT) * 100));
        }
      }
      await Promise.all(Array.from({ length: 4 }, () => worker()));
      const start = await fetch(`/api/analyses/${created.analysisId}/runs/start`, { method: "POST" });
      const run = await start.json();
      if (!start.ok) throw new Error(run.error ?? "تعذر بدء التحليل.");
      router.push(`/ar/analyses/${created.analysisId}/results`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إكمال العملية.");
      setRunning(false);
    }
  }

  return (
    <div className="wizard-page">
      <header className="wizard-topbar"><Link href="/ar/dashboard"><LogoMark /></Link><div><span>مسودة محفوظة</span><i /></div><Link href="/ar/dashboard">حفظ والخروج</Link></header>
      <div className="wizard-shell">
        <aside className="wizard-sidebar">
          <p className="eyebrow">إنشاء اختبار جديد</p><h1>ابنِ اختبارًا تشخيصيًا</h1><p>حدد نطاق المادة ومواصفات الأسئلة، ثم راجع ما يولده Gemini قبل نشر رابط الطلاب.</p>
          <ol>{steps.map((item, index) => { const Icon = item.icon; return <li className={index === step ? "active" : index < step ? "done" : ""} key={item.title}><span>{index < step ? <Check size={16} /> : <Icon size={17} />}</span><div><small>الخطوة {index + 1}</small><strong>{item.title}</strong></div></li>; })}</ol>
          <div className="wizard-help"><ShieldCheck size={19} /><div><strong>المعلم صاحب القرار</strong><p>Gemini يولّد المسودة، ويمكنك تعديل كل هدف وسؤال وإجابة قبل النشر.</p></div></div>
        </aside>

        <main className="wizard-main">
          <div className="wizard-progress-mobile"><span>الخطوة {step + 1} من ٥</span><div><i style={{ width: `${((step + 1) / 5) * 100}%` }} /></div></div>

          {step === 0 ? <section className="wizard-step" aria-labelledby="step-one-title">
            <div className="wizard-step-head"><span><BookOpen size={22} /></span><div><p className="eyebrow">الخطوة الأولى · نطاق التقويم</p><h2 id="step-one-title">معلومات الاختبار والمادة</h2><p>اختبارات نافس تقيس نواتج تراكمية للمادة؛ لذلك لا نطلب اسم درس واحد.</p></div></div>
            <button className="template-fill-btn" type="button" onClick={loadScienceDemo}><Sparkles size={17} /> تهيئة مثال علوم الصف السادس</button>
            <div className="form-grid">
              <label className="wide-field">اسم الاختبار<input value={details.title} onChange={(event) => setDetails((value) => ({ ...value, title: event.target.value }))} placeholder="مثال: اختبار تشخيصي في العلوم" /></label>
              <label>المادة<input value={details.subject} onChange={(event) => setDetails((value) => ({ ...value, subject: event.target.value }))} onBlur={() => setDetails((value) => ({ ...value, subject: canonicalizeSubject(value.subject, value.grade) }))} placeholder="العلوم، القراءة، الرياضيات…" /></label>
              <label>الصف<input value={details.grade} onChange={(event) => setDetails((value) => ({ ...value, grade: event.target.value }))} onBlur={() => setDetails((value) => ({ ...value, subject: canonicalizeSubject(value.subject, value.grade) }))} placeholder="مثال: الصف السادس الابتدائي" /></label>
              <label className="wide-field">الفصل<input value={details.classroom} onChange={(event) => setDetails((value) => ({ ...value, classroom: event.target.value }))} placeholder="مثال: السادس / أ" /></label>
            </div>
            <div className="context-preview"><Sparkles size={18} /><span>المادة والصف والأهداف الرسمية ومواصفات الأسئلة تُرسل إلى Gemini لتوليد مسودة منظمة.</span></div>
            {nafsAlignment.enabled ? <div className="nafs-alignment-card" role="status">
              <ShieldCheck size={20} />
              <div><strong>تم العثور على نواتج نافس الرسمية</strong><p>عند المتابعة ستُعبأ أهداف «العلوم الطبيعية للصف السادس» تلقائيًا من وثيقة 2026.</p><small>تقيس نافس نواتج تراكمية للصفوف ٤–٦؛ والاختبار الذي تنشئه هنا عينة تشخيصية وليس نسخة رسمية من اختبار نافس. <a href={NAFS_OUTCOMES_URL} target="_blank" rel="noreferrer">فتح وثيقة النواتج</a></small></div>
            </div> : null}
          </section> : null}

          {step === 1 ? <section className="wizard-step" aria-labelledby="step-two-title">
            <div className="wizard-step-head"><span><Target size={22} /></span><div><p className="eyebrow">النواتج ثم مخطط الاختبار</p><h2 id="step-two-title">الأهداف ومواصفات الأسئلة</h2><p>راجع الأهداف أولًا، ثم حدد عدد كل نوع. سيولد Gemini الأسئلة وفق اختيارك.</p></div></div>
            {nafsAlignment.enabled ? <div className="objective-source-note"><ShieldCheck size={18} /><div><strong>{objectives.filter((objective) => objective.source === "NAFS").length} نواتج رئيسة من نافس 2026</strong><span>يمكنك تعديلها أو حذفها أو إضافة هدف خاص بالمعلم.</span></div><a href={NAFS_OUTCOMES_URL} target="_blank" rel="noreferrer">المصدر الرسمي</a></div> : null}
            <div className="objective-list">{objectives.map((objective, index) => <div className="objective-row" key={objective.code}><span><GripVertical size={18} /></span><label><small>{objective.source === "NAFS" ? `نافس · ${objective.branch}` : `هدف المعلم ${index + 1}`}</small><input value={objective.title} onChange={(event) => setObjectives((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} placeholder="اكتب هدفًا قابلًا للقياس" /></label><button type="button" disabled={objectives.length === 1} aria-label={`حذف الهدف ${index + 1}`} onClick={() => removeObjective(index)}><Trash2 size={17} /></button></div>)}</div>
            <button className="add-row-btn" type="button" disabled={objectives.length >= 20} onClick={() => setObjectives((current) => [...current, { code: teacherObjectiveCode(current), title: "", source: "TEACHER" }])}><Plus size={17} /> إضافة هدف للمعلم</button>

            <div className="blueprint-section">
              <div className="blueprint-heading"><div><p className="eyebrow">قبل التوليد</p><h3>كم سؤالًا تريد من كل نوع؟</h3></div><span className={questionTotalValid ? "valid" : "invalid"}>{formatArabicInteger(questionTotal)} أسئلة</span></div>
              <div className="blueprint-grid">
                {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((type) => <label key={type}><span>{QUESTION_TYPE_LABELS[type]}</span><input type="number" inputMode="numeric" min={0} max={10} value={blueprint[type]} onChange={(event) => updateBlueprint(type, Number(event.target.value))} /></label>)}
              </div>
              <p className={`blueprint-help${questionTotalValid ? "" : " invalid"}`}><ListChecks size={15} /> {questionTotalValid ? "المجموع صحيح. الأسئلة المولّدة جديدة ومتوافقة مع النواتج وليست أسئلة نافس الرسمية." : "عدّل الأعداد ليكون المجموع من ٥ إلى ١٠ أسئلة، ثم اضغط زر التوليد."}</p>
            </div>
          </section> : null}

          {step === 2 ? <section className="wizard-step" aria-labelledby="step-three-title">
            <div className="wizard-step-head"><span><FileText size={22} /></span><div><p className="eyebrow">مسودة قابلة للتحرير</p><h2 id="step-three-title">راجع الأسئلة والإجابات</h2><p>عدّل النص والبدائل والهدف ومفتاح التصحيح، أو أضف واحذف ما تحتاجه.</p></div></div>
            {generatedBy ? <div className="generated-questions-note"><Sparkles size={17} /><strong>وُلّدت المسودة عبر {generatedBy}</strong><span>أنت تعتمد النسخة النهائية قبل نشرها.</span></div> : null}
            <div className="question-list">{questions.map((question, index) => <article className="question-editor" key={index}>
              <header><span>{index + 1}</span><select aria-label={`نوع السؤال ${index + 1}`} value={questionTypes[index] ?? "SHORT_ANSWER"} onChange={(event) => changeQuestionType(index, event.target.value as QuestionType)}><option value="MULTIPLE_CHOICE">اختيار من متعدد</option><option value="SHORT_ANSWER">مقالي / إجابة مفتوحة</option><option value="INK">رسم أو إجابة بصورة</option></select><button type="button" onClick={() => removeQuestion(index)} aria-label={`حذف السؤال ${index + 1}`}><Trash2 size={16} /></button></header>
              <label>نص السؤال<textarea value={question} onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder="اكتب السؤال كما سيظهر للطالب" /></label>
              {questionTypes[index] === "MULTIPLE_CHOICE" ? <div className="choice-editor"><small>بدائل الإجابة</small>{(questionChoices[index] ?? ["", "", "", ""]).map((choice, choiceIndex) => <label key={choiceIndex}><span>{["أ", "ب", "ج", "د"][choiceIndex]}</span><input value={choice} onChange={(event) => updateChoice(index, choiceIndex, event.target.value)} placeholder={`البديل ${choiceIndex + 1}`} /></label>)}</div> : null}
              <div><label>الهدف المرتبط<select aria-label={`هدف السؤال ${index + 1}`} value={questionObjectiveCodes[index] ?? objectives[0]?.code} onChange={(event) => setQuestionObjectiveCodes((current) => current.map((code, itemIndex) => itemIndex === index ? event.target.value : code))}>{objectives.map((objective) => <option value={objective.code} key={objective.code}>{objective.title || objective.code}</option>)}</select></label>{questionTypes[index] === "MULTIPLE_CHOICE" ? <label>الإجابة الصحيحة<select value={answers[index] ?? ""} onChange={(event) => setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? event.target.value : answer))}><option value="">اختر البديل الصحيح</option>{(questionChoices[index] ?? []).filter(Boolean).map((choice, choiceIndex) => <option value={choice} key={`${choice}-${choiceIndex}`}>{choice}</option>)}</select></label> : <label>الإجابة / معيار التصحيح<input value={answers[index] ?? ""} onChange={(event) => setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? event.target.value : answer))} placeholder="اكتب عناصر الإجابة الصحيحة" /></label>}</div>
            </article>)}</div>
            <button className="add-row-btn" type="button" disabled={questions.length >= 10} onClick={addQuestion}><Plus size={17} /> إضافة سؤال يدويًا</button>
          </section> : null}

          {step === 3 ? <section className="wizard-step" aria-labelledby="step-four-title">
            <div className="wizard-step-head"><span><UploadCloud size={22} /></span><div><p className="eyebrow">اختر مصدر الإجابات</p><h2 id="step-four-title">طريقة إجابة الطلاب</h2><p>انشر نموذجًا رقميًا أو ارفع ملفات PDF وصورًا.</p></div></div>
            {!STORAGE_ENABLED ? <div className="storage-disabled-notice" role="status"><ShieldCheck size={20} /><div><strong>النموذج الرقمي متاح</strong><p>{STORAGE_DISABLED_MESSAGE}</p></div></div> : null}
            <div className="input-mode-selector"><button className={inputMode === "FORM" ? "active" : ""} type="button" onClick={() => { setInputMode("FORM"); setError(""); }}><Sparkles size={21} /><strong>نموذج رقمي</strong><small>يحفظ الإجابات النصية مباشرة في قاعدة البيانات · موصى به</small></button><button className={inputMode === "PDF" ? "active" : ""} type="button" disabled={!STORAGE_ENABLED} onClick={() => { setInputMode("PDF"); setError(""); }}><FileText size={21} /><strong>ملفات PDF أو صور</strong><small>{STORAGE_ENABLED ? "خمسة ملفات للتجربة الحالية" : "متوقف مؤقتًا حتى ربط التخزين"}</small></button></div>
            {inputMode === "FORM" ? <div className="form-mode-preview"><UsersRound size={23} /><div><strong>سينشئ النظام رابطًا عامًا واحدًا</strong><p>أي عدد من الطلاب يفتحون الرابط نفسه، والأسئلة الاختيارية تظهر كبدائل فعلية قابلة للنقر.</p></div></div> : <><input ref={fileInput} className="sr-only" type="file" accept="application/pdf,image/png,image/jpeg" multiple onChange={(event) => chooseFiles(event.target.files)} />{!uploaded ? <button className="upload-zone" type="button" onClick={() => fileInput.current?.click()}><span><UploadCloud size={27} /></span><strong>اختر ٥ ملفات من جهازك</strong><small>PDF، PNG، JPG · حتى ١٥ م.ب للملف</small><em>تم اختيار {files.length} من ٥</em></button> : <div className="upload-complete"><div className="upload-complete-head"><span><FileCheck2 size={21} /></span><div><strong>تم اختيار ٥ ملفات</strong><small>سيتم التحقق من النوع والحجم بعد الرفع المباشر</small></div><b>{running ? `${uploadProgress}٪` : "جاهز"}</b></div><div className="upload-file-grid">{files.map((file, index) => <div key={`${file.name}-${index}`}><span><FileText size={15} /></span><bdi dir="ltr">{file.name}</bdi><Check size={14} /></div>)}</div></div>}</>}
            <div className="privacy-check"><ShieldCheck size={18} /><div><strong>اسم واضح لكل إجابة</strong><p>يكتب الطالب اسمه عند فتح الرابط، ويظهر الاسم للمعلم مع حالة التسليم والنتائج.</p></div></div>
          </section> : null}

          {step === 4 ? <section className="wizard-step" aria-labelledby="step-five-title">
            <div className="wizard-step-head"><span><CheckCircle2 size={22} /></span><div><p className="eyebrow">جاهز للنشر</p><h2 id="step-five-title">المراجعة النهائية</h2><p>تحقق من النطاق والمواصفات قبل نشر النموذج أو بدء تحليل الملفات.</p></div></div>
            <div className="final-review-card">
              <div><span><BookOpen size={18} /></span><div><small>الاختبار</small><strong>{details.title || "لم يُكتب اسم الاختبار"}</strong><p>{nafsAlignment.subject || "المادة"} · {details.grade || "الصف"} · {details.classroom || "الفصل"}</p></div><CheckCircle2 size={20} /></div>
              <div><span><Target size={18} /></span><div><small>الأهداف ومخطط الأسئلة</small><strong>{objectives.length} أهداف · {questions.length} أسئلة</strong><p>{questionTypes.filter((type) => type === "MULTIPLE_CHOICE").length} اختياري · {questionTypes.filter((type) => type === "SHORT_ANSWER").length} مقالي · {questionTypes.filter((type) => type === "INK").length} رسم/صورة</p></div><CheckCircle2 size={20} /></div>
              {nafsAlignment.enabled ? <div><span><ShieldCheck size={18} /></span><div><small>المصدر الوطني</small><strong>{nafsAlignment.framework}</strong><p>الأهداف من الوثيقة الرسمية، والأسئلة مسودة جديدة مولدة عبر Gemini وليست أسئلة نافس الرسمية.</p></div><CheckCircle2 size={20} /></div> : null}
              <div><span><UsersRound size={18} /></span><div><small>مصدر الإجابات</small><strong>{inputMode === "FORM" ? "نموذج رقمي · رابط عام واحد" : `${files.length} من ٥ ملفات`}</strong><p>{inputMode === "FORM" ? "لا يبدأ التحليل إلا عندما تضغط الزر" : "الملفات جاهزة للرفع والتحليل"}</p></div><CheckCircle2 size={20} /></div>
            </div>
            <label className="final-consent"><input type="checkbox" defaultChecked /><span><strong>أؤكد أنني راجعت الأسئلة المولّدة</strong><small>المعلم مسؤول عن اعتماد الصياغة ومفتاح الإجابة قبل نشر الاختبار.</small></span></label>
            <div className="run-preview"><Sparkles size={20} /><div><strong>ماذا سيحدث بعد المتابعة؟</strong><p>{inputMode === "FORM" ? "سيظهر رابط عام واحد يستقبل عددًا غير محدود، وتختار أنت وقت إغلاقه وبدء التحليل." : "ستُرفع الملفات ويبدأ تشغيل Gemini مباشرة."}</p></div></div>
          </section> : null}

          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <footer className="wizard-footer">
            <button className="secondary-btn" type="button" onClick={previous} disabled={step === 0 || running || generating}><ArrowRight size={17} /> السابق</button>
            <span id="generation-status" aria-live="polite">{inputMode === "PDF" && !STORAGE_ENABLED && step === 4 ? "رفع الملفات متوقف حتى يتم ربط التخزين" : generating ? "Gemini يبني مسودة الأسئلة الآن…" : running ? (inputMode === "FORM" ? "جارٍ نشر رابط الاختبار…" : `جارٍ الرفع والتجهيز ${uploadProgress}٪`) : "تُحفظ الجلسة عند المتابعة"}</span>
            {step === 1 ? <button className="primary-btn generation-btn" type="button" disabled={generating} aria-busy={generating} aria-describedby="generation-status" onClick={generateQuestions}>{generating ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />} {generating ? "جارٍ التوليد…" : "توليد الأسئلة والمتابعة"}</button> : step < 4 ? <button className="primary-btn" type="button" onClick={next}>التالي <ArrowLeft size={17} /></button> : <button className="primary-btn start-analysis-btn" type="button" disabled={running || (inputMode === "PDF" && (!STORAGE_ENABLED || !uploaded))} onClick={startAnalysis}><Sparkles size={17} /> {running ? "جارٍ التجهيز..." : inputMode === "FORM" ? "نشر رابط الاختبار" : STORAGE_ENABLED ? "بدء التحليل" : "رفع الملفات متوقف"}</button>}
          </footer>
        </main>
      </div>
      {generating ? <div className="generation-overlay" role="status" aria-live="assertive" aria-label="جارٍ توليد أسئلة الاختبار"><div className="generation-loading-card"><span><LoaderCircle className="spin" size={34} /></span><strong>Gemini يولّد أسئلة الاختبار الآن</strong><p>يطبّق عدد الأسئلة وأنواعها ويربط كل سؤال بناتج التعلّم. قد يستغرق ذلك بضع ثوانٍ.</p><small>لا تغلق الصفحة؛ ستنتقل تلقائيًا إلى مراجعة الأسئلة عند الاكتمال.</small></div></div> : null}
    </div>
  );
}
