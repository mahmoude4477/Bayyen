import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../lib/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const email = process.env.BASIRA_DEMO_EMAIL;
  const password = process.env.BASIRA_DEMO_PASSWORD;
  if (!email || !password) {
    throw new Error("BASIRA_DEMO_EMAIL and BASIRA_DEMO_PASSWORD are required");
  }
  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({ data: { name: "محمود مسؤول", email, emailVerified: true, role: "TEACHER" } });
    await db.account.create({ data: {
      userId: user.id, accountId: user.id, providerId: "credential",
      password: await hashPassword(password),
    } });
  }
  if (await db.analysisSession.findUnique({ where: { id: "fractions-6a" } })) return;

  const analysis = await db.analysisSession.create({ data: {
    inputMode: "PDF",
    id: "fractions-6a", ownerId: user.id, title: "اختبار مقارنة الكسور", subject: "الرياضيات",
    grade: "الصف السادس", lesson: "مقارنة الكسور وترتيبها", classroom: "سادس / أ", status: "REVIEW", lockedAt: new Date(),
    objectives: { create: [
      { code: "OBJ-01", title: "تمييز دور البسط والمقام", position: 1 },
      { code: "OBJ-02", title: "مقارنة الكسور باستراتيجيات متعددة", position: 2 },
    ] },
    students: { create: Array.from({ length: 36 }, (_, index) => ({ code: `S-${String(index + 1).padStart(3, "0")}` })) },
  }, include: { objectives: true, students: true } });
  const objective = new Map(analysis.objectives.map((item) => [item.code, item.id]));
  await db.question.createMany({ data: [
    ["ما دور البسط في الكسر؟", "يمثل عدد الأجزاء المأخوذة", "OBJ-01"],
    ["ما دور المقام في الكسر؟", "يمثل عدد الأجزاء المتساوية", "OBJ-01"],
    ["قارن بين ٣/٥ و٥/٨.", "٣/٥ أصغر من ٥/٨", "OBJ-02"],
    ["رتب ١/٢ و٢/٣ و٣/٤.", "١/٢، ٢/٣، ٣/٤", "OBJ-02"],
    ["فسر استراتيجية المقارنة.", "توحيد المقامات أو استخدام قيمة مرجعية", "OBJ-02"],
  ].map((item, index) => ({ sessionId: analysis.id, prompt: item[0], answerKey: item[1], objectiveId: objective.get(item[2])!, type: "SHORT_ANSWER", position: index + 1 })) });
  const questions = await db.question.findMany({ where: { sessionId: analysis.id }, orderBy: { position: "asc" } });
  await db.submissionAsset.createMany({ data: analysis.students.map((student) => ({
    sessionId: analysis.id, studentId: student.id, objectKey: `demo/${analysis.id}/${student.code}.pdf`,
    fileName: `${student.code}.pdf`, contentType: "application/pdf", size: 1024, status: "MAPPED", uploadedAt: new Date(),
  })) });
  const assets = await db.submissionAsset.findMany({ where: { sessionId: analysis.id } });
  await db.pageMapping.createMany({ data: assets.map((asset) => ({ assetId: asset.id, studentId: asset.studentId!, pageNumber: 1 })) });
  const run = await db.analysisRun.create({ data: {
    id: "run-demo-003", sessionId: analysis.id, version: 1, status: "REVIEW", progress: 100,
    idempotencyKey: "fractions-6a:demo:v1", analyzerJobId: "fixture-gold-v1", startedAt: new Date(), completedAt: new Date(),
  } });
  await db.answerResult.createMany({ data: analysis.students.flatMap((student, studentIndex) => questions.map((question, questionIndex) => {
    const marker = (studentIndex + questionIndex) % 11;
    return {
      runId: run.id, studentId: student.id, questionId: question.id,
      extractedAnswer: marker > 4 ? question.answerKey : "إجابة تحتاج تحقق المعلم",
      mastery: marker > 4 ? "MASTERED" : marker > 1 ? "PARTIAL" : "NOT_MASTERED",
      score: marker > 4 ? 1 : marker > 1 ? 0.5 : 0,
      confidence: marker === 0 ? 0.46 : marker === 1 ? 0.68 : 0.92,
      needsReview: studentIndex < 4 && questionIndex === 0,
    };
  })) });
  const gapSpecs = [
    ["fraction-roles", "الخلط بين البسط والمقام", "ضعف في تمييز دور كل جزء عند تفسير قيمة الكسر.", 18, 0.91, "١٨ إجابة متسقة عبر سؤالين", "#cf6b43"],
    ["common-denominator", "توحيد المقامات دون حفظ القيمة", "يتغير المقام دون تطبيق التحويل نفسه على البسط.", 13, 0.82, "١٣ إجابة عبر ثلاثة أنماط", "#d6a13f"],
    ["number-line", "تمثيل الكسر على خط الأعداد", "تحديد غير دقيق للمسافات المتساوية.", 9, 0.76, "٩ إجابات مع دليل بصري", "#3e8f84"],
  ] as const;
  for (const [index, spec] of gapSpecs.entries()) {
    const gap = await db.learningGap.create({ data: { runId: run.id, slug: spec[0], title: spec[1], description: spec[2], affectedCount: spec[3], population: 36, confidence: spec[4], evidence: spec[5], color: spec[6], rank: index + 1 } });
    await db.gapStudent.createMany({ data: analysis.students.slice(0, spec[3]).map((student) => ({ gapId: gap.id, studentId: student.id })) });
  }
  const groupSpecs = [
    ["foundation", "تأسيس", "تمييز البسط والمقام", "نمذجة بصرية ومفردات المفهوم", "coral", analysis.students.slice(0, 14)],
    ["practice", "تدريب", "المقارنة باستراتيجيات متعددة", "تدريب موجّه مع تغذية راجعة", "amber", analysis.students.slice(14, 27)],
    ["mastery", "إتقان", "تطبيق ونقل أثر التعلم", "تحديات مركبة وتفسير الاستراتيجية", "teal", analysis.students.slice(27)],
  ] as const;
  for (const spec of groupSpecs) {
    const group = await db.studentGroup.create({ data: { sessionId: analysis.id, runId: run.id, key: spec[0], label: spec[1], title: spec[2], description: spec[3], color: spec[4] } });
    await db.groupMember.createMany({ data: spec[5].map((student) => ({ groupId: group.id, studentId: student.id, reason: "تصنيف أولي قائم على أدلة الإجابات" })) });
    await db.interventionPlan.create({ data: {
      groupId: group.id, version: 1, objective: spec[2], duration: "٣ حصص × ٢٥ دقيقة",
      teacherSteps: ["عرض دليل من إجابات المجموعة", "نمذجة التفكير بصوت مسموع", "تحقق سريع من الفهم"],
      explanation: "شرح موجز قائم على الدليل مع قرار نهائي للمعلم.", example: "مثال محلول ثم مثال موازٍ.",
      activity: "عمل ثنائي ببطاقات تفسير.", practice: ["تمهيد", "تطبيق موجّه", "تطبيق مستقل"],
      exitTicket: [{ question: "اشرح الفكرة في جملة.", answer: "إجابة تربط المفهوم بالاستراتيجية." }],
      adaptations: { visual: "دعم بصري", language: "تعليمات مختصرة" },
    } });
  }
  await db.analysisEvent.create({ data: { runId: run.id, type: "FIXTURE_SEEDED", payload: { dataset: "gold-v1" } } });
}

main().then(() => console.log("Basira demo data is ready")).finally(() => db.$disconnect());
