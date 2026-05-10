import { useState } from "react";
import {
  Shield, Eye, EyeOff, Lock, Mail, AlertCircle,
  Info, ChevronDown, ChevronUp, Users, Building2
} from "lucide-react";
import arcGuardLogo from "/arc-guard-logo.png";
import { signIn, getUserProfile, demoLogin } from "@/lib/auth";
import { isFirebaseReady } from "@/firebase";
import type { UserProfile } from "@/types";

interface LoginPageProps {
  onLogin: (profile: UserProfile) => void;
  onRegister: () => void;
}

function DemoButtons({ onLogin }: { onLogin: (p: UserProfile) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 px-4 pb-4 pt-2">
      <button
        onClick={() => onLogin(demoLogin("manager"))}
        className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border border-primary/40 bg-primary/10 hover:bg-primary/20 transition-all group"
      >
        <Building2 className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
        <span className="text-xs font-bold text-primary">مدیر (نمونه)</span>
        <span className="text-[10px] text-muted-foreground">بدون Firebase</span>
      </button>
      <button
        onClick={() => onLogin(demoLogin("guard"))}
        className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border border-border bg-muted/50 hover:bg-muted hover:border-primary/30 transition-all group"
      >
        <Users className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        <span className="text-xs font-bold text-foreground">نگهبان (نمونه)</span>
        <span className="text-[10px] text-muted-foreground">بدون Firebase</span>
      </button>
    </div>
  );
}

const SETUP_STEPS = [
  {
    step: "۱",
    title: "پروژه Firebase جدید بسازید",
    body: "console.firebase.google.com → Add project\n(جدا از پروژه ARCtime — پروژه حضور و غیاب دست نخورد)",
  },
  {
    step: "۲",
    title: "Authentication و Firestore را فعال کنید",
    body: "Authentication → Sign-in method → Email/Password → Enable\nFirestore Database → Create database → Start in test mode",
  },
  {
    step: "۳",
    title: "Secrets اختصاصی ARC Guard را در Replit تنظیم کنید",
    body: "آیکون قفل (Secrets) در Replit → این ۶ کلید را اضافه کنید:\n\nVITE_ARC_GUARD_API_KEY\nVITE_ARC_GUARD_AUTH_DOMAIN\nVITE_ARC_GUARD_PROJECT_ID\nVITE_ARC_GUARD_STORAGE_BUCKET\nVITE_ARC_GUARD_MESSAGING_SENDER_ID\nVITE_ARC_GUARD_APP_ID\n\nمقادیر از: Project Settings → General → Your apps → Web app",
  },
];

export default function LoginPage({ onLogin, onRegister }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isFirebaseReady) {
      setError("Firebase پیکربندی نشده. از دکمه‌های دمو زیر استفاده کنید.");
      return;
    }
    if (!email.trim() || !password) {
      setError("ایمیل و رمز عبور الزامی است.");
      return;
    }
    setLoading(true);
    try {
      const user = await signIn(email.trim(), password);
      const profile = await getUserProfile(user.uid);
      if (!profile) { setError("پروفایل کاربری یافت نشد. با مدیر تماس بگیرید."); return; }
      if (!profile.active) { setError("حساب شما غیرفعال است. با مدیر تماس بگیرید."); return; }
      onLogin(profile);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError("ایمیل یا رمز عبور اشتباه است.");
      } else if (code === "auth/too-many-requests") {
        setError("تعداد تلاش زیاد. چند دقیقه صبر کنید.");
      } else if (code === "auth/network-request-failed") {
        setError("خطای اتصال به اینترنت.");
      } else if (code === "auth/configuration-not-found") {
        setError("Firebase Authentication فعال نیست — Console → Authentication → Sign-in method → Email/Password را فعال کنید.");
        setShowFallback(true);
      } else {
        setError("خطا در ورود. دوباره تلاش کنید.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-background arc-grid-bg">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, rgba(14,165,233,0.5) 0%, transparent 65%)" }} />
      </div>
      <div className="absolute top-5 left-5 w-7 h-7 border-l-2 border-t-2 border-primary opacity-30" />
      <div className="absolute top-5 right-5 w-7 h-7 border-r-2 border-t-2 border-primary opacity-30" />
      <div className="absolute bottom-5 left-5 w-7 h-7 border-l-2 border-b-2 border-primary opacity-30" />
      <div className="absolute bottom-5 right-5 w-7 h-7 border-r-2 border-b-2 border-primary opacity-30" />

      <div className="relative z-10 w-full max-w-sm mx-auto px-6 animate-fade-in-up space-y-4">

        {/* Logo */}
        <div className="flex flex-col items-center mb-2">
          <img src={arcGuardLogo} alt="ARC Guard" className="w-24 h-24 object-contain mb-3"
            style={{ filter: "drop-shadow(0 0 20px rgba(14,165,233,0.5))" }} />
          <h1 className="text-2xl font-bold text-primary arc-glow-text tracking-wider">ARC Guard</h1>
          <p className="text-xs text-muted-foreground tracking-wide mt-1">سیستم هوشمند گشت امنیتی</p>
        </div>

        {/* ── Firebase NOT configured: full yellow banner with setup guide ── */}
        {!isFirebaseReady && (
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/[0.06] overflow-hidden">
            <div className="flex items-start gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-yellow-400/15 border border-yellow-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <Info className="w-4 h-4 text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-yellow-400">Firebase ARC Guard پیکربندی نشده</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  پروژه Firebase اختصاصی ARC Guard را راه‌اندازی کنید (جدا از ARCtime).
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowGuide(!showGuide)}
              className="w-full flex items-center justify-between px-4 py-2.5 border-t border-yellow-500/20 text-xs text-yellow-400/80 hover:bg-yellow-500/10 transition-colors"
            >
              <span>راهنمای راه‌اندازی</span>
              {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showGuide && (
              <div className="px-4 pb-4 pt-1 space-y-3 border-t border-yellow-500/20 bg-black/20" dir="rtl">
                {SETUP_STEPS.map(({ step, title, body }) => (
                  <div key={step} className="flex gap-3 pt-2">
                    <div className="w-5 h-5 rounded-full bg-yellow-400/20 border border-yellow-500/40 flex items-center justify-center text-[10px] font-bold text-yellow-400 shrink-0 mt-0.5">{step}</div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 whitespace-pre-line leading-relaxed font-mono">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-yellow-500/20">
              <p className="text-[11px] text-muted-foreground px-4 pt-2 pb-1">تا زمان راه‌اندازی، با حالت نمونه وارد شوید:</p>
              <DemoButtons onLogin={onLogin} />
            </div>
          </div>
        )}

        {/* ── Firebase IS configured: login form ── */}
        <div className="rounded-xl border border-border bg-card p-6"
          style={{ boxShadow: "0 0 40px rgba(14,165,233,0.06), inset 0 1px 0 rgba(14,165,233,0.06)" }}>
          <div className="flex items-center gap-2 mb-5">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">ورود به سیستم</span>
            {!isFirebaseReady && (
              <span className="mr-auto text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">غیرفعال</span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">ایمیل</label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@company.com" autoComplete="email"
                  disabled={!isFirebaseReady}
                  className="w-full bg-muted border border-border rounded-lg pr-10 pl-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">رمز عبور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type={showPassword ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password"
                  disabled={!isFirebaseReady}
                  className="w-full bg-muted border border-border rounded-lg pr-10 pl-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !isFirebaseReady}
              className="w-full bg-primary text-primary-foreground rounded-lg py-3 text-sm font-bold tracking-wide transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ boxShadow: isFirebaseReady ? "0 0 20px rgba(14,165,233,0.25)" : "none" }}>
              {loading
                ? <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    در حال ورود...
                  </span>
                : "ورود"}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-border flex items-center justify-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${isFirebaseReady ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`} />
            <span className="text-xs text-muted-foreground">
              {isFirebaseReady ? "Firebase ARC Guard متصل است" : "حالت نمونه · Firebase متصل نیست"}
            </span>
          </div>
        </div>

        {/* ── When Firebase IS configured but auth fails: collapsible demo fallback ── */}
        {isFirebaseReady && (
          <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
            <button
              onClick={() => setShowFallback(!showFallback)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground hover:bg-accent/30 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-primary/50" />
                مشکل در ورود؟ از حالت نمونه استفاده کنید
              </span>
              {showFallback ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showFallback && (
              <div className="border-t border-border">
                <p className="text-[11px] text-muted-foreground px-4 pt-2 pb-1 leading-relaxed">
                  اگر خطای <span className="text-destructive font-mono">auth/configuration-not-found</span> می‌گیرید،
                  در Firebase Console → Authentication → Sign-in method →
                  <strong className="text-foreground"> Email/Password</strong> را فعال کنید.
                  یا همین حالا با نمونه وارد شوید:
                </p>
                <DemoButtons onLogin={onLogin} />
              </div>
            )}
          </div>
        )}

        {/* Register link */}
        {isFirebaseReady && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              حساب کاربری ندارید؟{" "}
              <button onClick={onRegister} className="text-primary hover:underline font-medium">
                ثبت شرکت جدید
              </button>
            </p>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground opacity-40">ARC Guard v2.0</p>
      </div>
    </div>
  );
}
