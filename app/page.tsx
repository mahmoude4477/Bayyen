import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Layers3,
  Target,
  UsersRound,
} from "lucide-react";
import { LogoMark } from "@/components/logo-mark";

export default function Home() {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link href="/" aria-label="الصفحة الرئيسية"><LogoMark /></Link>
        <nav aria-label="حسابك">
          <Link className="landing-sign-in" href="/ar/login?mode=sign-in">تسجيل الدخول</Link>
          <Link className="landing-sign-up" href="/ar/login?mode=sign-up">إنشاء حساب</Link>
        </nav>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <p className="landing-eyebrow">منصة تشخيص تعليمي للمعلمين</p>
          <h1 id="landing-title">حوّل إجابات الطلاب إلى قرارات تعليمية واضحة</h1>
          <p>أنشئ اختبارك، أرسل رابطًا واحدًا للطلاب، ثم راجع فجوات التعلّم والخطط العلاجية المبنية على الأدلة.</p>
          <div className="landing-actions">
            <Link className="landing-primary" href="/ar/login?mode=sign-up">ابدأ التجربة مجانًا <ArrowLeft size={18} /></Link>
            <Link className="landing-secondary" href="/ar/login?mode=sign-in">لدي حساب بالفعل</Link>
          </div>
          <p className="landing-note"><CheckCircle2 size={16} /> إنشاء الحساب وتسجيل الدخول خلال دقائق</p>
        </div>

        <aside className="landing-preview" aria-label="رحلة الاستخدام">
          <p>رحلة المعلّم</p>
          <ol>
            <li><span><ClipboardCheck size={19} /></span><div><strong>أنشئ الاختبار</strong><small>حدّد المادة والصف ومخطط الأسئلة.</small></div></li>
            <li><span><UsersRound size={19} /></span><div><strong>أرسل رابط الطلاب</strong><small>رابط عام واحد للتسليم الرقمي.</small></div></li>
            <li><span><BarChart3 size={19} /></span><div><strong>راجع القرار</strong><small>نتائج وفجوات وخطة علاجية قابلة للتنفيذ.</small></div></li>
          </ol>
        </aside>
      </section>

      <section className="landing-nafs" aria-labelledby="landing-nafs-title">
        <div className="landing-nafs-heading">
          <div>
            <p className="landing-eyebrow">مرجع القياس الوطني</p>
            <h2 id="landing-nafs-title">مواءمة تربوية تستند إلى المتاح علنًا</h2>
          </div>
          <a
            href="https://media.etec.gov.sa/media/sszdnh2h/%D9%86%D9%88%D8%A7%D8%AA%D8%AC-%D8%A7%D9%84%D8%AA%D8%B9%D9%84%D9%85-2026.pdf"
            target="_blank"
            rel="noreferrer"
          >
            وثيقة نواتج التعلم 2026 <ExternalLink size={16} aria-hidden="true" />
            <span className="sr-only">يفتح في نافذة جديدة</span>
          </a>
        </div>

        <p className="landing-nafs-description">
          يستخدم «بيِن» نواتج التعلم المنشورة رسميًا لتعبئة أهداف الاختبار، ثم يولّد أسئلة جديدة
          متوافقة معها عبر Gemini. ولا يدّعي أن الأسئلة المولدة هي أسئلة نافس الرسمية:
        </p>

        <div className="landing-nafs-grid">
          <article>
            <span><Layers3 size={22} aria-hidden="true" /></span>
            <h3>تحديد الأولويات</h3>
            <p>تحديد المواد والصفوف ذات الأولوية عند بناء التقييمات وتجارب التحليل.</p>
          </article>
          <article>
            <span><Target size={22} aria-hidden="true" /></span>
            <h3>صياغة الأهداف</h3>
            <p>تعبئة نواتج المادة والصف تلقائيًا مع إبقائها قابلة للتعديل والإضافة.</p>
          </article>
          <article>
            <span><BarChart3 size={22} aria-hidden="true" /></span>
            <h3>تقارير الفجوات</h3>
            <p>تصميم بنية تقارير توضّح مستوى الإتقان والفجوات والأدلة الداعمة.</p>
          </article>
          <article>
            <span><BookOpenCheck size={22} aria-hidden="true" /></span>
            <h3>مواءمة التقييم</h3>
            <p>مواءمة نموذج التقييم مع مبادئ القياس الوطني دون ادعاء تكامل رسمي.</p>
          </article>
        </div>

        <p className="landing-nafs-note">
          «بيِن» يستند إلى وثيقة النواتج الرسمية، ولا يستخدم بيانات طلاب خام أو أسئلة اختبار سرية صادرة عن الهيئة.
        </p>
      </section>
    </main>
  );
}
