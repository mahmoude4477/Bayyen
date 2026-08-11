import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { LogoMark } from "@/components/logo-mark";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand"><LogoMark /></div>
        <p className="eyebrow">مساحة المعلم الآمنة</p>
        <h1 id="login-title">ابدأ تجربة بيِن</h1>
        <p>أنشئ حسابًا تجريبيًا خلال ثوانٍ، أو سجّل الدخول لمتابعة جلساتك وقرارات المراجعة والخطط المحفوظة.</p>
        <Suspense fallback={<div className="login-form">جارٍ تجهيز تسجيل الدخول...</div>}><LoginForm /></Suspense>
      </section>
    </main>
  );
}
