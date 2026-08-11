import type { Metadata } from "next";
import { NewAnalysisWizard } from "@/components/new-analysis-wizard";

export const metadata: Metadata = { title: "إنشاء اختبار جديد" };

export default function NewAnalysisPage() {
  return <NewAnalysisWizard />;
}
