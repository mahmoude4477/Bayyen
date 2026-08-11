import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import "./globals.css";
import "./features.css";
import "./workflow.css";
import "./forms.css";
import "./responsive.css";

export const metadata: Metadata = {
  title: {
    default: "بيِن | قرارات تعليمية مبنية على الدليل",
    template: "%s | بيِن",
  },
  description:
    "منصة عربية تساعد المعلم على تحويل أوراق الاختبارات إلى فجوات تعلم ومجموعات وخطط علاجية قابلة للمراجعة.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f7f2",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
