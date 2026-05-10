import { useState } from "react";
import {
  Shield, Eye, EyeOff, Lock, Mail, AlertCircle,
  Info, ChevronDown, ChevronUp, Building2, Users, Zap
} from "lucide-react";
import arcGuardLogo from "/arc-guard-logo.png";
import { signIn, getUserProfile, demoLogin } from "@/lib/auth";
import { isFirebaseReady } from "@/firebase";
import type { UserProfile } from "@/types";

interface LoginPageProps {
  onLogin: (profile: UserProfile) => void;
  onRegister: () => void;
}

export default function LoginPage({ onLogin, onRegister }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  const handleDemoManager = () => {
    onLogin(demoLogin("manager"));
  };

  const handleDemoGuard = () => {
    onLogin(demoLogin("guard"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isFirebaseReady) {
      setError("Firebase پیکربندی نشده. از دکمه‌های دمو بالا استفاده کنید.");
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
        setError("Firebase Authentication فعال نیست.");
        setShowFallback(true);
      } else {
        setError("خطا در ورود. دوباره تلاش کنید.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center bg-background arc-grid-bg"
      dir="rtl"
    >
      {/* background glow — pointer-events-none so it never blocks taps */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div
          className="w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, rgba(14,165,233,0.5) 0%, transparent 65%)" }}
        />
      </div>
      {/* corner brackets */}
      <div className="pointer-events-none fixed top-5 left-5 w-7 h-7 border-l-2 border-t-2 border-primary opacity-30" />
      <div className="pointer-events-none fixed top-5 right-5 w-7 h-7 border-r-2 border-t-2 border-primary opacity-30" />
      <div className="pointer-events-none fixed bottom-5 left-5 w-7 h-7 border-l-2 border-b-2 border-primary opacity-30" />
      <div className="pointer-events-none fixed bottom-5 right-5 w-7 h-7 border-r-2 border-b-2 border-primary opacity-30" />

      <div className="relative w-full max-w-sm mx-auto px-5 py-8 space-y-4 animate-fade-in-up">

        {/* ── Logo ── */}
        <div className="flex flex-col items-center mb-1">
          <img
            src={arcGuardLogo} alt="ARC Guard"
            className="w-20 h-20 object-contain mb-3"
            style={{ filter: "drop-shadow(0 0 20px rgba(14,165,233,0.5))" }}
          />
          <h1 className="text-2xl font-bold text-primary arc-glow-text tracking-wider">ARC Guard</h1>
          <p className="text-xs text-muted-foreground tracking-wide mt-1">سیستم هوشمند گشت امنیتی</p>
        </div>

        {/* ══════════════════════════════════════════════════════
            DEMO SECTION — always rendered outside overflow-hidden
            ══════════════════════════════════════════════════════ */}
        <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
          {/* header */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-primary leading-tight">ورود نمونه (بدون Firebase)</p>
              <p className="text-[11px] text-muted-foreground">همین الان امتحان کنید</p>
            </div>
          </div>

          {/* ── BIG DEMO BUTTONS ── */}
          <div className="grid grid-cols-2 gap-3">
            {/* Manager demo */}
            <button
              type="button"
              onPointerDown={handleDemoManager}
              className="
                flex flex-col items-center justify-center gap-2
                min-h-[88px] rounded-xl
                border-2 border-primary/50 bg-primary/15
                active:scale-95 active:bg-primary/30
                transition-all duration-100
                cursor-pointer select-none
              "
              style={{ WebkitTapHighlightColor: "rgba(14,165,233,0.3)" }}
            >
              <Building2 className="w-7 h-7 text-primary" />
              <div className="text-center leading-tight">
                <p className="text-sm font-bold text-primary">مدیر</p>
                <p className="text-[10px] text-primary/70">Manager</p>
              </div>
            </button>

            {/* Guard demo */}
            <button
              type="button"
              onPointerDown={handleDemoGuard}
              className="
                flex flex-col items-center justify-center gap-2
                min-h-[88px] rounded-xl
                border-2 border-border bg-muted/60
                active:scale-95 active:bg-muted
                transition-all duration-100
                cursor-pointer select-none
              "
              style={{ WebkitTapHighlightColor: "rgba(255,255,255,0.15)" }}
            >
              <Users className="w-7 h-7 text-muted-foreground" />
              <div className="text-center leading-tight">
                <p className="text-sm font-bold text-foreground">نگهبان</p>
                <p className="text-[10px] text-muted-foreground">Guard</p>
              </div>
            </button>
          </div>
        </div>

        {/* ── Firebase not configured notice ── */}
        {!isFirebaseReady && (
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/[0.06] overflow-visible">
            <div className="flex items-start gap-3 px-4 py-3">
              <Info className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-yellow-400">Firebase ARC Guard پیکربندی نشده</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  برای حالت واقعی، ۶ کلید <span className="font-mono text-yellow-400/80">VITE_ARC_GUARD_*</span> را در Secrets تنظیم کنید.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowGuide(g => !g)}
              className="w-full flex items-center justify-between px-4 py-2.5 border-t border-yellow-500/20 text-xs text-yellow-400/80 hover:bg-yellow-500/10 active:bg-yellow-500/20 transition-colors"
            >
              <span>راهنمای اتصال Firebase (کلیک کنید)</span>
              {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showGuide && (
              <div className="px-4 pb-4 pt-1 border-t border-yellow-500/20 bg-black/20 space-y-3">
                {[
                  { n: "۱", t: "پروژه Firebase جدید بسازید", b: "console.firebase.google.com → Add project\n(جدا از ARCtime)" },
                  { n: "۲", t: "Auth و Firestore را فعال کنید", b: "Authentication → Email/Password → Enable\nFirestore → Create database → Test mode" },
                  { n: "۳", t: "Secrets را در Replit وارد کنید", b: "VITE_ARC_GUARD_API_KEY\nVITE_ARC_GUARD_AUTH_DOMAIN\nVITE_ARC_GUARD_PROJECT_ID\nVITE_ARC_GUARD_STORAGE_BUCKET\nVITE_ARC_GUARD_MESSAGING_SENDER_ID\nVITE_ARC_GUARD_APP_ID" },
                ].map(({ n, t, b }) => (
                  <div key={n} className="flex gap-3 pt-2">
                    <div className="w-5 h-5 rounded-full bg-yellow-400/20 border border-yellow-500/40 flex items-center justify-center text-[10px] font-bold text-yellow-400 shrink-0">{n}</div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{t}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 whitespace-pre-line leading-relaxed font-mono">{b}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Login form (only active when Firebase is ready) ── */}
        <div
          className="rounded-xl border border-border bg-card p-5"
          style={{ boxShadow: "0 0 40px rgba(14,165,233,0.06)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">ورود با حساب Firebase</span>
            {!isFirebaseReady && (
              <span className="mr-auto text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                غیرفعال
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">ایمیل</label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="example@company.com" autoComplete="email"
                  disabled={!isFirebaseReady}
                  className="w-full bg-muted border border-border rounded-lg pr-10 pl-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">رمز عبور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password"
                  disabled={!isFirebaseReady}
                  className="w-full bg-muted border border-border rounded-lg pr-10 pl-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
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

            <button
              type="submit"
              disabled={loading || !isFirebaseReady}
              className="w-full bg-primary text-primary-foreground rounded-lg py-3 text-sm font-bold tracking-wide transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ boxShadow: isFirebaseReady ? "0 0 20px rgba(14,165,233,0.25)" : "none" }}
            >
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

          {/* Firebase status + fallback demo toggle */}
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <div className="flex items-center justify-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isFirebaseReady ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`} />
              <span className="text-xs text-muted-foreground">
                {isFirebaseReady ? "Firebase ARC Guard متصل است" : "حالت نمونه · Firebase متصل نیست"}
              </span>
            </div>

            {isFirebaseReady && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowFallback(v => !v)}
                  className="w-full flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  <Info className="w-3 h-3" />
                  مشکل در ورود؟ از نمونه استفاده کنید
                  {showFallback ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {showFallback && (
                  <p className="text-[11px] text-muted-foreground text-center mt-1 leading-relaxed">
                    از دکمه‌های <span className="text-primary font-semibold">مدیر / نگهبان</span> در بالای صفحه استفاده کنید.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Register link */}
        {isFirebaseReady && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              حساب کاربری ندارید؟{" "}
              <button
                type="button"
                onClick={onRegister}
                className="text-primary hover:underline font-medium"
              >
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
