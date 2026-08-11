import { expect, test } from "@playwright/test";

test("teacher signs in and sees the live dashboard", async ({ page }) => {
  const email = process.env.BASIRA_DEMO_EMAIL;
  const password = process.env.BASIRA_DEMO_PASSWORD;
  if (!email || !password) {
    throw new Error("BASIRA_DEMO_EMAIL and BASIRA_DEMO_PASSWORD are required");
  }
  await page.goto("/ar/login");
  await page.getByLabel("نوع الدخول").getByRole("button", { name: "تسجيل الدخول" }).click();
  await expect(page.getByLabel("الاسم")).toBeHidden();
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/ar\/dashboard/);
  await expect(page.getByRole("heading", { name: /مرحبًا/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /إنشاء اختبار جديد/ })).toBeVisible();
  await expect(page.getByText("بانتظار قرارك")).toBeVisible();
});

test("unauthenticated analysis route redirects to login", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/ar/analyses/private-session/results");
  await expect(page).toHaveURL(/\/ar\/login/);
});
