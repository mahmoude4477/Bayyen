export const analysisId = "fractions-6a";

export const session = {
  title: "اختبار مقارنة الكسور",
  subject: "الرياضيات",
  grade: "الصف السادس",
  classroom: "سادس / أ",
  status: "COMPLETED",
  completedAt: "٨ أغسطس ٢٠٢٦، ١٠:٤٢ ص",
  run: "RUN-003",
  dataset: "gold-v1",
};

export const metrics = [
  { label: "أعمال الطلاب", value: "٣٦/٣٦", hint: "ورقة قابلة للتحليل", tone: "blue" },
  { label: "تحتاج مراجعة", value: "٤", hint: "حالات بقرار بشري", tone: "amber" },
  { label: "اتفاق القياس", value: "٩١٪", hint: "قبل مراجعة المعلم", tone: "green" },
  { label: "وقت التحليل", value: "٦:٤٢", hint: "دقائق من القبول للاكتمال", tone: "violet" },
];

export const gaps = [
  {
    id: "fraction-roles",
    rank: "٠١",
    title: "الخلط بين البسط والمقام",
    description: "ضعف في تمييز دور كل جزء عند تفسير قيمة الكسر ومقارنته.",
    affected: 18,
    total: 25,
    percent: 72,
    confidence: "مرتفعة",
    evidence: "١٨ إجابة متسقة عبر سؤالين",
    color: "#cf6b43",
  },
  {
    id: "common-denominator",
    rank: "٠٢",
    title: "توحيد المقامات دون حفظ القيمة",
    description: "يغيّر بعض الطلاب المقام من دون تطبيق التحويل نفسه على البسط.",
    affected: 13,
    total: 27,
    percent: 48,
    confidence: "متوسطة",
    evidence: "١٣ إجابة عبر ثلاثة أنماط",
    color: "#d6a13f",
  },
  {
    id: "number-line",
    rank: "٠٣",
    title: "تمثيل الكسر على خط الأعداد",
    description: "تحديد غير دقيق للمسافات المتساوية وموقع الكسر بين الصفر والواحد.",
    affected: 9,
    total: 28,
    percent: 32,
    confidence: "متوسطة",
    evidence: "٩ إجابات مع دليل بصري",
    color: "#3e8f84",
  },
];

export const reviewItems = [
  {
    id: "rv-1",
    student: "S-014",
    question: "السؤال ٤ · مقارنة ٣/٥ و ٥/٨",
    reason: "ثقة منخفضة",
    extracted: "٣/٥ أكبر لأن ٥ أكبر من ٨",
    suggestion: "غير متقن",
    confidence: "٤٧٪",
    severity: "high",
  },
  {
    id: "rv-2",
    student: "S-021",
    question: "السؤال ٦ · التمثيل على خط الأعداد",
    reason: "الصورة غير واضحة",
    extracted: "تعذر قراءة موضع العلامة",
    suggestion: "غير مقروء",
    confidence: "—",
    severity: "high",
  },
  {
    id: "rv-3",
    student: "S-008",
    question: "السؤال ٢ · معنى المقام",
    reason: "دليل ناقص",
    extracted: "هو الرقم في الأسفل لأنه الأصغر",
    suggestion: "إتقان جزئي",
    confidence: "٦٢٪",
    severity: "medium",
  },
  {
    id: "rv-4",
    student: "S-033",
    question: "السؤال ٥ · الكسور المتكافئة",
    reason: "تعارض مع المرجع",
    extracted: "٢/٣ = ٤/٥",
    suggestion: "غير متقن",
    confidence: "٦٨٪",
    severity: "medium",
  },
];

export const groups = [
  {
    id: "foundation",
    label: "تأسيس",
    title: "تمييز البسط والمقام",
    count: 14,
    color: "coral",
    description: "نمذجة بصرية ومفردات المفهوم الأساسية",
    students: ["S-003", "S-006", "S-008", "S-011", "S-014", "S-017", "S-021", "S-023", "S-027", "S-029", "S-031", "S-033", "S-035", "S-036"],
  },
  {
    id: "practice",
    label: "تدريب",
    title: "المقارنة باستراتيجيات متعددة",
    count: 13,
    color: "amber",
    description: "تدريب موجّه مع تغذية راجعة قصيرة",
    students: ["S-001", "S-004", "S-005", "S-009", "S-010", "S-012", "S-015", "S-018", "S-020", "S-024", "S-026", "S-028", "S-034"],
  },
  {
    id: "mastery",
    label: "إتقان",
    title: "تطبيق ونقل أثر التعلم",
    count: 9,
    color: "teal",
    description: "تحديات مركّبة وتفسير الاستراتيجية",
    students: ["S-002", "S-007", "S-013", "S-016", "S-019", "S-022", "S-025", "S-030", "S-032"],
  },
];

export const recentSessions = [
  { id: analysisId, title: session.title, meta: "رياضيات · الصف السادس", date: "اليوم، ١٠:٤٢ ص", status: "مكتمل", progress: 100 },
  { id: "algebra-7b", title: "المعادلات ذات الخطوة الواحدة", meta: "رياضيات · الصف السابع", date: "أمس، ١:١٥ م", status: "تحتاج مراجعة", progress: 86 },
  { id: "reading-5a", title: "الفكرة الرئيسة والتفاصيل", meta: "لغتي · الصف الخامس", date: "٦ أغسطس", status: "مسودة", progress: 42 },
];

export const formatArabicNumber = (value: number) =>
  new Intl.NumberFormat("ar-SA").format(value);
