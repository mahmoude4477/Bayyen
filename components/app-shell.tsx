"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpenCheck,
  ChartNoAxesCombined,
  CircleHelp,
  ClipboardCheck,
  FilePlus2,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Search,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { LogoMark } from "@/components/logo-mark";
import { authClient } from "@/lib/auth-client";

export function AppShell({ children, userName = "المعلم" }: { children: React.ReactNode; userName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: authData } = authClient.useSession();
  const pathAnalysisId = pathname.match(/^\/ar\/analyses\/([^/]+)/)?.[1];
  const currentAnalysisId = pathAnalysisId === "new" ? undefined : pathAnalysisId;
  const analysisHref = (suffix: string) => currentAnalysisId ? `/ar/analyses/${currentAnalysisId}/${suffix}` : "/ar/dashboard";
  const globalNavItems = [
    { label: "كل الاختبارات", href: "/ar/dashboard", icon: LayoutDashboard },
    { label: "إنشاء اختبار جديد", href: "/ar/analyses/new", icon: FilePlus2 },
  ];
  const analysisNavItems = currentAnalysisId ? [
    { label: "نظرة الاختبار", href: `/ar/analyses/${currentAnalysisId}`, icon: GraduationCap },
    { label: "إجابات الطلاب", href: analysisHref("submissions"), icon: ListChecks },
    { label: "نتائج التحليل", href: analysisHref("results"), icon: ChartNoAxesCombined },
    { label: "قائمة المراجعة", href: analysisHref("review"), icon: ClipboardCheck },
    { label: "مجموعات الطلاب", href: analysisHref("groups"), icon: UsersRound },
    { label: "الخطط العلاجية", href: analysisHref("plans"), icon: BookOpenCheck },
  ] : [];
  const renderNavItem = (item: { label: string; href: string; icon: typeof LayoutDashboard }) => {
    const Icon = item.icon;
    const active = pathname === item.href || (item.href.includes("/results") && pathname.includes("/gaps/")) || (item.href.includes("/plans") && pathname.includes("/plans/"));
    return (
      <Link key={item.label} href={item.href} className={`nav-link ${active ? "active" : ""}`} onClick={() => setOpen(false)}>
        <Icon size={19} strokeWidth={1.8} />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`} aria-label="التنقل الرئيسي">
        <div className="sidebar-brand-row">
          <Link href="/ar/dashboard" onClick={() => setOpen(false)} aria-label="بيِن · لوحة المتابعة"><LogoMark /></Link>
          <button className="icon-btn sidebar-close" onClick={() => setOpen(false)} aria-label="إغلاق القائمة"><X size={20} /></button>
        </div>
        <nav className="main-nav">
          <p className="nav-eyebrow">مساحة المعلم</p>
          {globalNavItems.map(renderNavItem)}
          {currentAnalysisId && <p className="nav-eyebrow nav-eyebrow-analysis">الاختبار المفتوح</p>}
          {analysisNavItems.map(renderNavItem)}
        </nav>
        <div className="sidebar-session-card">
          <div className="session-card-icon"><Sparkles size={18} /></div>
          <p className="micro-label">{currentAnalysisId ? "جلسة نشطة" : "ابدأ من هنا"}</p>
          <strong>{currentAnalysisId ? "الاختبار الحالي" : "اختبار رقمي جديد"}</strong>
          <div className="session-mini-status"><span /> {currentAnalysisId ? "بيانات محفوظة" : "لا توجد جلسة حالية"}</div>
          <Link href={currentAnalysisId ? `/ar/analyses/${currentAnalysisId}` : "/ar/analyses/new"}>{currentAnalysisId ? "فتح لوحة الاختبار" : "إنشاء اختبار"}</Link>
        </div>
        <button className="teacher-card" type="button" onClick={async () => { await authClient.signOut(); router.push("/ar/login"); router.refresh(); }} aria-label="تسجيل الخروج">
          <div className="avatar">م</div>
          <div><strong>{authData?.user.name ?? userName}</strong><span>معلم · جلسة آمنة</span></div>
          <LogOut size={16} aria-hidden="true" />
        </button>
      </aside>

      {open && <button className="sidebar-backdrop" aria-label="إغلاق القائمة" onClick={() => setOpen(false)} />}

      <div className="workspace">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setOpen(true)} aria-label="فتح القائمة"><Menu size={22} /></button>
          <div className="mobile-brand"><LogoMark /></div>
          <label className="global-search">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">البحث</span>
            <input type="search" placeholder="ابحث في الجلسات والطلاب" />
            <kbd>⌘ K</kbd>
          </label>
          <div className="top-actions">
            <Link href="/ar/analyses/new" className="top-create"><FilePlus2 size={17} /> إنشاء اختبار</Link>
            <button className="icon-btn" aria-label="المساعدة"><CircleHelp size={20} /></button>
            <button className="icon-btn notification-btn" aria-label="الإشعارات"><Bell size={20} /><span /></button>
          </div>
        </header>
        <main id="main-content" className="main-content">{children}</main>
        <nav className={`mobile-bottom-nav ${currentAnalysisId ? "" : "is-global"}`} aria-label="التنقل السريع">
          <Link href="/ar/dashboard"><LayoutDashboard size={20} /><span>الاختبارات</span></Link>
          {currentAnalysisId && <Link href={analysisHref("results")}><ChartNoAxesCombined size={20} /><span>النتائج</span></Link>}
          <Link className="mobile-new" href="/ar/analyses/new"><FilePlus2 size={22} /><span>جديد</span></Link>
          {currentAnalysisId && <Link href={analysisHref("groups")}><GraduationCap size={20} /><span>المجموعات</span></Link>}
          {currentAnalysisId && <Link href={analysisHref("review")}><ClipboardCheck size={20} /><span>المراجعة</span></Link>}
        </nav>
      </div>
    </div>
  );
}
