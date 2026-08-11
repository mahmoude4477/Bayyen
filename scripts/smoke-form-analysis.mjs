import { chromium } from "@playwright/test";

const baseURL = process.env.BASIRA_BASE_URL ?? "http://127.0.0.1:3000";
const email = process.env.BASIRA_DEMO_EMAIL;
const password = process.env.BASIRA_DEMO_PASSWORD;
if (!email || !password) {
  throw new Error("BASIRA_DEMO_EMAIL and BASIRA_DEMO_PASSWORD are required");
}
const browser = await chromium.launch({ headless: true });
const teacher = await browser.newPage();

teacher.on("pageerror", (error) => console.error(`teacher-pageerror: ${error.message}`));
teacher.on("console", (message) => {
  if (message.type() === "error") console.error(`teacher-console: ${message.text()}`);
});

try {
  const login = await teacher.request.post(`${baseURL}/api/auth/sign-in/email`, {
    data: { email, password },
  });
  if (!login.ok()) throw new Error(`login failed: ${login.status()}`);
  await teacher.goto(`${baseURL}/ar/dashboard`);
  await teacher.goto(`${baseURL}/ar/analyses/new`);
  await teacher.locator("#step-one-title").waitFor();
  await teacher.waitForTimeout(800);
  for (const heading of ["#step-two-title", "#step-three-title", "#step-four-title", "#step-five-title"]) {
    await teacher.locator(".wizard-footer .primary-btn").click();
    await teacher.locator(heading).waitFor();
  }
  await teacher.getByRole("button", { name: "نشر رابط الاختبار" }).click();
  await teacher.waitForURL(/\/ar\/analyses\/[^/]+\/forms/);
  const analysisId = new URL(teacher.url()).pathname.split("/")[3];
  const publicLink = await teacher.locator('.public-form-link-row a[target="_blank"]').getAttribute("href");
  if (!publicLink) throw new Error("expected one public student link");
  const studentNames = ["أحمد محمد", "سارة علي", "ليان خالد", "يوسف حسن", "نورة سعد", "ريم عبدالله", "عمر فهد"];

  for (const [index, studentName] of studentNames.entries()) {
    const student = await browser.newPage();
    await student.goto(publicLink);
    await student.getByLabel("اسم الطالب").fill(studentName);
    const textareas = student.locator(".student-question textarea");
    const answers = [
      index === 3 ? "البسط ٥ والمقام ٣" : "البسط ٣ والمقام ٥",
      "المقام يمثل عدد الأجزاء المتساوية في الكل",
      index === 2 ? "٣/٥" : "٢/٣",
      index === 4 ? "الإجابة غير واضحة" : "٣/٥ أصغر من ٥/٨",
    ];
    for (let answerIndex = 0; answerIndex < answers.length; answerIndex += 1) {
      await textareas.nth(answerIndex).fill(answers[answerIndex]);
    }
    const surface = student.locator(".ink-surface");
    await surface.scrollIntoViewIfNeeded();
    const bounds = await surface.boundingBox();
    if (!bounds) throw new Error("ink surface is not visible");
    const startX = bounds.x + bounds.width * 0.12;
    const lineY = bounds.y + bounds.height * 0.7;
    await student.mouse.move(startX, lineY);
    await student.mouse.down();
    await student.waitForTimeout(20);
    for (let step = 1; step <= 12; step += 1) {
      await student.mouse.move(startX + bounds.width * 0.06 * step, lineY + (step % 2 ? 2 : -2));
    }
    await student.waitForTimeout(20);
    await student.mouse.up();
    const markX = bounds.x + bounds.width * 0.66;
    await student.mouse.move(markX, lineY - 28);
    await student.mouse.down();
    await student.waitForTimeout(20);
    await student.mouse.move(markX + 1, lineY + 12);
    await student.waitForTimeout(20);
    await student.mouse.up();
    if (await student.getByRole("button", { name: "تراجع" }).isDisabled()) {
      throw new Error(`student ${index + 1}: ink stroke was not captured`);
    }
    await student.getByRole("button", { name: "تسليم الاختبار" }).click();
    try {
      await student.getByRole("heading", { name: "تم تسليم إجاباتك" }).waitFor({ timeout: 60_000 });
    } catch (error) {
      console.error(`student-${index + 1}-body: ${await student.locator("body").innerText()}`);
      throw error;
    }
    await student.close();
  }

  await teacher.reload();
  await teacher.getByText("يمكنك استقبال مزيد من الطلاب أو بدء التحليل الآن بقرارك.").waitFor();
  for (const studentName of studentNames) await teacher.getByText(studentName, { exact: true }).waitFor();
  await teacher.getByRole("button", { name: "بدء تحليل الإجابات الآن" }).click();
  await teacher.waitForURL(/\/results/, { timeout: 90_000 });
  let latest = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    latest = await teacher.evaluate(async (id) => {
      const response = await fetch(`/api/analyses/${id}/runs/status`, { cache: "no-store" });
      return (await response.json()).run;
    }, analysisId);
    if (["COMPLETED", "REVIEW", "PARTIAL", "FAILED"].includes(latest?.status)) break;
    await teacher.waitForTimeout(2_000);
  }
  if (!latest || !["COMPLETED", "REVIEW", "PARTIAL"].includes(latest.status)) throw new Error(`analysis failed: ${JSON.stringify(latest)}`);
  const expectedResults = studentNames.length * 5;
  if (latest._count.results !== expectedResults) throw new Error(`expected ${expectedResults} results, received ${latest._count.results}`);
  console.log(JSON.stringify({ analysisId, publicLinks: 1, namedStudents: studentNames.length, status: latest.status, resultCount: latest._count.results, gapCount: latest._count.gaps, groupCount: latest._count.groups }));
} finally {
  await browser.close();
}
