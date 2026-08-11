"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function RunStatusNotice({ analysisId, initialStatus, initialProgress }: { analysisId: string; initialStatus: string; initialProgress: number }) {
  const router = useRouter();
  const [state, setState] = useState({ status: initialStatus, progress: initialProgress });
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!["QUEUED", "PROCESSING"].includes(state.status)) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/analyses/${analysisId}/runs/status`, { cache: "no-store" });
      if (!response.ok) return;
      const { run } = await response.json();
      if (!run) return;
      setState({ status: run.status, progress: run.progress });
      if (!["QUEUED", "PROCESSING"].includes(run.status)) router.refresh();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [analysisId, router, state.status]);
  if (!["QUEUED", "PROCESSING"].includes(state.status)) return null;
  async function retry() {
    setRetrying(true);
    setError("");
    try {
      const response = await fetch(`/api/analyses/${analysisId}/runs/start`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "تعذر إعادة تشغيل التحليل.");
      setState({ status: result.status, progress: result.progress ?? 0 });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إعادة تشغيل التحليل.");
    } finally {
      setRetrying(false);
    }
  }
  if (state.status === "QUEUED" && state.progress === 0) {
    return <div className="fixture-notice run-queued-notice" role="status"><RefreshCw size={18} /><div><strong>التحليل لم يبدأ بعد</strong><span>{error || "التشغيل في قائمة الانتظار. يمكنك إعادة المحاولة الآن."}</span></div><button className="secondary-btn" type="button" disabled={retrying} onClick={retry}>{retrying ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} إعادة المحاولة</button></div>;
  }
  return <div className="fixture-notice" role="status"><LoaderCircle className="spin" size={18} /><div><strong>المعالجة جارية</strong><span>اكتمل {state.progress}٪، وستتحدث النتائج تلقائيًا.</span></div></div>;
}
