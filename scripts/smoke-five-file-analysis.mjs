import { chromium } from "@playwright/test";
import path from "node:path";

const baseURL = process.env.BASIRA_BASE_URL ?? "http://127.0.0.1:3000";
const password = process.env.BASIRA_DEMO_PASSWORD;
if (!password) throw new Error("BASIRA_DEMO_PASSWORD is required");
const files = Array.from({ length: 5 }, (_, index) =>
  path.resolve("output", "pdf", `S-${String(index + 1).padStart(3, "0")}.pdf`),
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("console", (message) => {
  if (message.type() === "error") console.error(`browser-console: ${message.text()}`);
});
page.on("pageerror", (error) => console.error(`browser-pageerror: ${error.message}`));

try {
  await page.goto(`${baseURL}/ar/login`);
  await page.getByLabel("كلمة المرور").fill(password);
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
  await page.waitForURL(/\/ar\/dashboard/);

  await page.goto(`${baseURL}/ar/analyses/new`);
  await page.locator("#step-one-title").waitFor();
  await page.waitForTimeout(1_000);
  const stepHeadings = ["#step-two-title", "#step-three-title", "#step-four-title"];
  for (const heading of stepHeadings) {
    await page.locator(".wizard-footer .primary-btn").click();
    await page.locator(heading).waitFor();
  }
  await page.locator('input[type="file"]').setInputFiles(files);
  await page.getByText("تم اختيار ٥ ملفات", { exact: true }).waitFor();
  await page.getByRole("button", { name: /التالي/ }).click();
  await page.getByRole("button", { name: /بدء التحليل/ }).click();
  await page.waitForURL(/\/ar\/analyses\/[^/]+\/results/, { timeout: 90_000 });

  const analysisId = new URL(page.url()).pathname.split("/")[3];
  let latest = null;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    latest = await page.evaluate(async (id) => {
      const response = await fetch(`/api/analyses/${id}/runs/status`, { cache: "no-store" });
      if (!response.ok) throw new Error(`status:${response.status}`);
      return (await response.json()).run;
    }, analysisId);
    if (["COMPLETED", "REVIEW", "PARTIAL", "FAILED"].includes(latest?.status)) break;
    await page.waitForTimeout(2_000);
  }

  if (!latest || !["COMPLETED", "REVIEW", "PARTIAL"].includes(latest.status)) {
    throw new Error(`analysis did not complete: ${JSON.stringify(latest)}`);
  }
  if (latest._count.results !== 25) {
    throw new Error(`expected 25 question results, received ${latest._count.results}`);
  }

  console.log(JSON.stringify({
    analysisId,
    status: latest.status,
    progress: latest.progress,
    resultCount: latest._count.results,
    gapCount: latest._count.gaps,
    groupCount: latest._count.groups,
  }));
} finally {
  await browser.close();
}
