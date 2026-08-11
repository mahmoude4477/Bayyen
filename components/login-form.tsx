"use client";

import { LoaderCircle, LogIn } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">(params.get("mode") === "sign-in" ? "sign-in" : "sign-up");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));
    const result = mode === "sign-up"
      ? await authClient.signUp.email({ name: String(data.get("name")).trim(), email, password })
      : await authClient.signIn.email({ email, password, rememberMe: true });
    if (result.error) {
      setError(mode === "sign-up" ? "تعذر إنشاء الحساب. قد يكون البريد مستخدمًا بالفعل." : "البريد أو كلمة المرور غير صحيحة.");
      setPending(false);
      return;
    }
    const requested = params.get("callback");
    router.push(requested?.startsWith("/ar/") ? requested : "/ar/dashboard");
    router.refresh();
  }

  return (
    <form className="login-form" method="post" onSubmit={submit}>
      <div className="auth-mode" aria-label="نوع الدخول">
        <button className={mode === "sign-up" ? "active" : ""} type="button" onClick={() => { setMode("sign-up"); setError(""); }}>إنشاء حساب</button>
        <button className={mode === "sign-in" ? "active" : ""} type="button" onClick={() => { setMode("sign-in"); setError(""); }}>تسجيل الدخول</button>
      </div>
      {mode === "sign-up" ? <>
        <label htmlFor="name">الاسم</label>
        <input id="name" name="name" type="text" autoComplete="name" required maxLength={80} placeholder="مثال: محمد أحمد" />
      </> : null}
      <label htmlFor="email">البريد الإلكتروني</label>
      <input id="email" name="email" type="email" autoComplete="email" spellCheck={false} required dir="ltr" placeholder="name@example.com" />
      <label htmlFor="password">كلمة المرور</label>
      <input id="password" name="password" type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} required minLength={10} dir="ltr" />
      {mode === "sign-up" ? <p className="password-hint">استخدم 10 أحرف على الأقل. سيُسجَّل دخولك تلقائيًا بعد إنشاء الحساب.</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button className="primary-btn full-btn" disabled={pending} type="submit">
        {pending ? <LoaderCircle className="spin" size={18} /> : <LogIn size={18} />}
        {pending ? (mode === "sign-up" ? "جارٍ إنشاء الحساب…" : "جارٍ التحقق…") : (mode === "sign-up" ? "أنشئ حساب التجربة" : "تسجيل الدخول")}
      </button>
    </form>
  );
}
