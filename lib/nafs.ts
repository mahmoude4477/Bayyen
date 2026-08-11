export const NAFS_FRAMEWORK = "وثيقة نواتج التعلم للاختبارات الوطنية 2026";
export const NAFS_OUTCOMES_URL = "https://media.etec.gov.sa/media/sszdnh2h/%D9%86%D9%88%D8%A7%D8%AA%D8%AC-%D8%A7%D9%84%D8%AA%D8%B9%D9%84%D9%85-2026.pdf";

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670]/g;

export type NafsLearningOutcome = {
  code: string;
  title: string;
  branch: "علوم الحياة" | "العلوم الفيزيائية" | "علوم الأرض والفضاء";
};

export const NAFS_SCIENCE_GRADE_6_OUTCOMES: readonly NafsLearningOutcome[] = [
  {
    code: "NAFS-SCI6-01",
    branch: "علوم الحياة",
    title: "يتعرف على تركيب الخلية ووظائفها الحيوية، ويصف أجهزة الجسم ووظائفها ونمو المخلوقات الحية، ويصنفها وفق صفاتها الظاهرية.",
  },
  {
    code: "NAFS-SCI6-02",
    branch: "علوم الحياة",
    title: "يصف الأنظمة البيئية ومكوناتها وعلاقاتها، ويتتبع انتقال المادة والطاقة فيها، ويفسر التكيف وأثر التغيرات والنشاط البشري.",
  },
  {
    code: "NAFS-SCI6-03",
    branch: "علوم الحياة",
    title: "يفسر وراثة الصفات والتباين فيها وانتقالها بين الأجيال، ويميز بين الصفات السائدة والمتنحية ويوضح أثر البيئة فيها.",
  },
  {
    code: "NAFS-SCI6-04",
    branch: "العلوم الفيزيائية",
    title: "يستكشف خصائص المادة الفيزيائية والكيميائية وتركيبها وتغيراتها، ويفسر التفاعلات الكيميائية والعوامل المؤثرة فيها ويطبق حفظ الكتلة.",
  },
  {
    code: "NAFS-SCI6-05",
    branch: "العلوم الفيزيائية",
    title: "يوضح مفهوم القوة وأنواعها والعوامل المؤثرة فيها، ويستوعب قوانين نيوتن ويفسر حركة الأجسام في ضوئها.",
  },
  {
    code: "NAFS-SCI6-06",
    branch: "العلوم الفيزيائية",
    title: "يميز بين الطاقة والشغل، ويستوعب حفظ الطاقة والطاقة الحركية وانتقالها وتطبيقاتها في الحياة اليومية.",
  },
  {
    code: "NAFS-SCI6-07",
    branch: "العلوم الفيزيائية",
    title: "يستوعب مفهوم الموجات وخصائصها وانعكاس الضوء وانتقال الصوت، ويفسر دورهما في التفاعل والتواصل في البيئة.",
  },
  {
    code: "NAFS-SCI6-08",
    branch: "العلوم الفيزيائية",
    title: "يفسر الشحنة الكهربائية وتجاذب وتنافر الأجسام المشحونة، ويقارن الكهرباء الساكنة والمتحركة ويصف خصائص المغناطيس واستخداماته.",
  },
  {
    code: "NAFS-SCI6-09",
    branch: "علوم الأرض والفضاء",
    title: "يصف أغلفة الأرض ومكوناتها وخصائصها، ويشرح العمليات التي تحدث فيها وأسبابها وآثارها.",
  },
  {
    code: "NAFS-SCI6-10",
    branch: "علوم الأرض والفضاء",
    title: "يتعرف على النظام الشمسي ودور الجاذبية في حركة مكوناته، ويفسر الظواهر المرتبطة به وعلاقته بالمجرات والكون.",
  },
];

function normalizeArabicText(value: string) {
  return value
    .trim()
    .replace(ARABIC_DIACRITICS, "")
    .replace(/ـ/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/٦/g, "6")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isSixthPrimaryGrade(grade: string) {
  const normalized = normalizeArabicText(grade);
  return normalized.includes("السادس") || /(^|\s)6($|\s)/.test(normalized);
}

function isPhysicsSubject(subject: string) {
  const normalized = normalizeArabicText(subject);
  return normalized.includes("فيزياء") || normalized === "physics";
}

function isScienceSubject(subject: string) {
  const normalized = normalizeArabicText(subject);
  return normalized.includes("علوم") || normalized === "science" || isPhysicsSubject(subject);
}

export function canonicalizeSubject(subject: string, grade: string) {
  if (isSixthPrimaryGrade(grade) && isPhysicsSubject(subject)) return "العلوم";
  return subject.trim();
}

export type NafsAlignment = {
  enabled: boolean;
  subject: string;
  domain: string | null;
  framework: string | null;
  referenceUrl: string | null;
};

export function resolveNafsAlignment(input: { subject: string; grade: string }): NafsAlignment {
  const subject = canonicalizeSubject(input.subject, input.grade);
  const enabled = isSixthPrimaryGrade(input.grade) && isScienceSubject(subject);
  return {
    enabled,
    subject,
    domain: enabled ? "العلوم الطبيعية · الصف السادس" : null,
    framework: enabled ? NAFS_FRAMEWORK : null,
    referenceUrl: enabled ? NAFS_OUTCOMES_URL : null,
  };
}

export function getNafsLearningOutcomes(input: { subject: string; grade: string }) {
  return resolveNafsAlignment(input).enabled ? NAFS_SCIENCE_GRADE_6_OUTCOMES : [];
}
