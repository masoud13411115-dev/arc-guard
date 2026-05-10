import { useState } from "react";
import {
  Shield, Eye, EyeOff, Lock, Mail, AlertCircle, Info,
  ChevronDown, ChevronUp, Hash, Building2,
} from "lucide-react";
import arcGuardLogo from "/arc-guard-logo.png";
import {
  signIn, signInWithGuardCode, resolveCompanyByInviteCode,
  getUserProfile,
} from "@/lib/auth";
import { isFirebaseReady } from "@/firebase";
import { logger } from "@/lib/logger";
import type { UserProfile } from "@/types";

interface Props {
  onLogin: (profile: UserProfile) => void;
  onRegister: () => void;
}

const FIREBASE_MANAGER_ERRORS: Record<string, string> = {
  "auth/user-not-found":         "ایمیل یا رمز عبور اشتباه است.",
  "auth/wrong-password":         "ایمیل یا رمز عبور اشتباه است.",
  "auth/invalid-credential":     "ایمیل یا رمز عبور اشتباه است.",
  "auth/too-many-requests":      "تعداد تلاش زیاد. چند دقیقه صبر کنید.",
  "auth/network-request-failed": "خطای اتصال به اینترنت. اتصال شبکه را بررسی کنید.",
  "auth/user-disabled":          "حساب شما توسط مدیر غیرفعال شده است.",
  "auth/invalid-email":          "فرمت ایمیل اشتباه است.",
};

type LoginMode = "manager" | "guard";

export default function LoginPage({ onLogin, onRegister }: Props) {
  const [mode, setMode] = useState<LoginMode>("manager");

  // Manager fields
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");

  // Guard fields
  const [guardCode, setGuardCode]   = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [pin, setPin]               = useState("");

  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [showGuide, setShowGuide] = useState(false);

  // ── Manager login ──────────────────────────────────────────────────────────
  const handleManagerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isFirebaseReady) { setError("Firebase پیکربندی نشده است. کلیدهای VITE_ARC_GUARD_* را در Secrets اضافه کنید."); return; }
    if (!email.trim()) { setError("ایمیل الزامی است."); return; }
    if (!password)     { setError("رمز عبور الزامی است."); return; }

    setLoading(true);
    try {
      const user    = await signIn(email.trim().toLowerCase(), password);
      const profile = await getUserProfile(user.uid);
      if (!profile)        { setError("پروفایل کاربری یافت نشد. با پشتیبانی تماس بگیرید."); return; }
      if (!profile.active) { setError("حساب شما غیرفعال است. با مدیر تماس بگیرید."); return; }
      if (profile.role === "guard") { setError("برای ورود نگهبان، تب «نگهبان» را انتخاب کنید."); return; }
      logger.info("login", `Manager success: ${profile.role}`);
      onLogin(profile);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      logger.warn("login", "Manager failed", code);
      setError(FIREBASE_MANAGER_ERRORS[code] ?? "خطا در ورود. دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  };

  // ── Guard login ────────────────────────────────────────────────────────────
  const handleGuardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isFirebaseReady) { setError("Firebase پیکربندی نشده است. کلیدهای VITE_ARC_GUARD_* را در Secrets اضافه کنید."); return; }
    if (!guardCode.trim()) { setError("کد نگهبان الزامی است."); return; }
    if (!inviteCode.trim()) { setError("کد دعوت شرکت الزامی است."); return; }
    if (!pin)               { setError("PIN الزامی است."); return; }

    setLoading(true);
    try {
      const company = await resolveCompanyByInviteCode(inviteCode.trim().toUpperCase());
      const user    = await signInWithGuardCode(guardCode.trim().toUpperCase(), company.id, pin);
      const profile = await getUserProfile(user.uid);
      if (!profile)        { setError("پروفایل نگهبان یافت نشد. ابتدا ثبت‌نام کنید."); return; }
      if (!profile.active) { setError("حساب نگهبان غیرفعال است. با مدیر تماس بگیرید."); return; }
      logger.info("login", `Guard success: ${profile.displayName}`);
      onLogin(profile);
    } catch (err: unknown) {
      const msg = (err as Error).message ?? "";
      const code = (err as { code?: string })?.code ?? "";
      logger.warn("login", "Guard failed", code, msg);
      if (msg.includes("کد دعوت")) setError(msg);
      else if (msg.includes("کد نگهبان") || code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setError("کد نگهبان یا PIN اشتباه است.");
      } else if (code === "auth/too-many-requests") {
        setError("تعداد تلاش زیاد. چند دقیقه صبر کنید.");
      } else if (code === "auth/network-request-failed") {
        setError("خطای اتصال. اتصال اینترنت را بررسی کنید.");
      } else {
        setError("خطا در ورود: " + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background arc-grid-bg" dir="rtl">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div className="w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle,rgba(14,165,233,.5) 0%,transparent 65%)" }} />
      </div>

      <div className="relative w-full max-w-sm mx-auto px-5 py-8 space-y-4"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>

        {/* ── Logo ── */}
        <div className="flex flex-col items-center mb-1">
          <img src={arcGuardLogo} alt="ARC Guard" className="w-20 h-20 object-contain mb-3"
            style={{ filter: "drop-shadow(0 0 20px rgba(14,165,233,.5))" }} />
          <h1 className="text-2xl font-bold text-primary tracking-wider">ARC Guard</h1>
          <p className="text-xs text-muted-foreground mt-1">سیستم هوشمند گشت امنیتی · پلتفرم SaaS</p>
        </div>

        {/* ── Firebase not configured warning ── */}
        {!isFirebaseReady && (
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/[0.06]">
            <div className="flex items-start gap-3 px-4 py-3">
              <Info className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-yellow-400">Firebase پیکربندی نشده</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  برای ورود، کلیدهای{" "}
                  <span className="font-mono text-yellow-400/80">VITE_ARC_GUARD_*</span>{" "}
                  را در Secrets اضافه کنید.
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setShowGuide(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2 border-t border-yellow-500/20 text-xs text-yellow-400/70 hover:bg-yellow-500/10 transition-colors">
              <span>راهنمای راه‌اندازی Firebase</span>
              {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showGuide && (
              <div className="px-4 pb-4 pt-2 space-y-3 border-t border-yellow-500/20 bg-black/20">
                {[
                  { n:"۱", t:"پروژه Firebase جدید بسازید", b:"console.firebase.google.com → Add project" },
                  { n:"۲", t:"Auth و Firestore را فعال کنید", b:"Authentication → Email/Password → Enable\nFirestore → Create database → Production mode" },
                  { n:"۳", t:"این ۶ Secret را در Replit اضافه کنید", b:"VITE_ARC_GUARD_API_KEY\nVITE_ARC_GUARD_AUTH_DOMAIN\nVITE_ARC_GUARD_PROJECT_ID\nVITE_ARC_GUARD_STORAGE_BUCKET\nVITE_ARC_GUARD_MESSAGING_SENDER_ID\nVITE_ARC_GUARD_APP_ID" },
                ].map(({ n, t, b }) => (
                  <div key={n} className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-yellow-400/20 border border-yellow-500/40 flex items-center justify-center text-[10px] font-bold text-yellow-400 shrink-0 mt-0.5">{n}</div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{t}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 whitespace-pre-line font-mono">{b}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Login form ── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">

          {/* Mode tab switcher */}
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => { setMode("manager"); setError(""); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold transition-colors ${
                mode === "manager"
                  ? "bg-primary/10 text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              مدیر / ادمین
            </button>
            <button
              type="button"
              onClick={() => { setMode("guard"); setError(""); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold transition-colors ${
                mode === "guard"
                  ? "bg-primary/10 text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              نگهبان
            </button>
          </div>

          <div className="p-5">
            {/* ── Manager form ── */}
            {mode === "manager" && (
              <form onSubmit={handleManagerLogin} className="space-y-3" noValidate>
                <div>
                  <label htmlFor="arc-email" className="text-xs text-muted-foreground block mb-1">ایمیل مدیر</label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      id="arc-email"
                      type="email"
                      inputMode="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="manager@company.com"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      disabled={!isFirebaseReady}
                      className="w-full bg-muted border border-border rounded-lg pr-10 pl-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="arc-password" className="text-xs text-muted-foreground block mb-1">رمز عبور</label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      id="arc-password"
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      disabled={!isFirebaseReady}
                      className="w-full bg-muted border border-border rounded-lg pr-10 pl-10 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}>
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button type="submit" disabled={loading || !isFirebaseReady}
                  className="w-full bg-primary text-primary-foreground rounded-lg py-3 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] transition-all select-none">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      در حال ورود...
                    </span>
                  ) : "ورود مدیر"}
                </button>
              </form>
            )}

            {/* ── Guard form ── */}
            {mode === "guard" && (
              <form onSubmit={handleGuardLogin} className="space-y-3" noValidate>
                <div>
                  <label htmlFor="arc-guard-code" className="text-xs text-muted-foreground block mb-1">کد نگهبان</label>
                  <div className="relative">
                    <Hash className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      id="arc-guard-code"
                      type="text"
                      value={guardCode}
                      onChange={e => setGuardCode(e.target.value.toUpperCase())}
                      placeholder="مثال: G001"
                      autoComplete="username"
                      autoCapitalize="characters"
                      spellCheck={false}
                      disabled={!isFirebaseReady}
                      className="w-full bg-muted border border-border rounded-lg pr-10 pl-4 py-2.5 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors tracking-wider"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">کد اختصاصی نگهبان (از مدیر دریافت کنید)</p>
                </div>

                <div>
                  <label htmlFor="arc-invite" className="text-xs text-muted-foreground block mb-1">کد دعوت شرکت</label>
                  <div className="relative">
                    <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      id="arc-invite"
                      type="text"
                      value={inviteCode}
                      onChange={e => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="مثال: ARC-X9F2"
                      autoCapitalize="characters"
                      spellCheck={false}
                      disabled={!isFirebaseReady}
                      className="w-full bg-muted border border-border rounded-lg pr-10 pl-4 py-2.5 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors tracking-widest"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="arc-pin" className="text-xs text-muted-foreground block mb-1">PIN / رمز عبور</label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      id="arc-pin"
                      type={showPw ? "text" : "password"}
                      value={pin}
                      onChange={e => setPin(e.target.value)}
                      placeholder="••••••"
                      autoComplete="current-password"
                      disabled={!isFirebaseReady}
                      className="w-full bg-muted border border-border rounded-lg pr-10 pl-10 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}>
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button type="submit" disabled={loading || !isFirebaseReady}
                  className="w-full bg-primary text-primary-foreground rounded-lg py-3 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] transition-all select-none">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      در حال ورود...
                    </span>
                  ) : "ورود نگهبان"}
                </button>

                <p className="text-center text-[11px] text-muted-foreground pt-1">
                  نگهبان جدید؟{" "}
                  <button type="button" onClick={onRegister} className="text-primary hover:underline font-medium">
                    ثبت‌نام با کد دعوت
                  </button>
                </p>
              </form>
            )}
          </div>

          {/* Firebase status indicator */}
          <div className="px-5 pb-4 pt-0 flex items-center justify-center gap-1.5 border-t border-border pt-3">
            <div className={`w-1.5 h-1.5 rounded-full ${isFirebaseReady ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`} />
            <span className="text-xs text-muted-foreground">
              {isFirebaseReady ? "Firebase ARC Guard متصل" : "Firebase متصل نیست"}
            </span>
          </div>
        </div>

        {/* Register link — only for manager */}
        {isFirebaseReady && mode === "manager" && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              شرکت ندارید؟{" "}
              <button type="button" onClick={onRegister} className="text-primary hover:underline font-medium">
                ثبت شرکت جدید
              </button>
            </p>
          </div>
        )}

        <p className="text-center text-[10px] text-muted-foreground opacity-30 select-none">
          ARC Guard v3.0 · SaaS Multi-Tenant
        </p>
      </div>
    </div>
  );
}
