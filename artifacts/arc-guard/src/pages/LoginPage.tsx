import { useState } from "react";
import {
  Shield, Eye, EyeOff, Lock, AlertCircle, Info,
  ChevronDown, ChevronUp, Hash, Building2, AtSign,
} from "lucide-react";
import arcGuardLogo from "/arc-guard-logo.png";
import {
  signInWithUsername, signInWithGuardCode, lookupGuardCompanyId,
  getUserProfile,
} from "@/lib/auth";
import { isFirebaseReady } from "@/firebase";
import { logger } from "@/lib/logger";
import type { UserProfile } from "@/types";

interface Props {
  onLogin: (profile: UserProfile) => void;
  onRegister: () => void;
}

type LoginMode = "manager" | "guard";

// ── Centralised Firebase / Firestore error resolver ───────────────────────────
function resolveAuthError(err: unknown): string {
  const code    = (err as { code?: string })?.code    ?? "";
  const message = (err as Error)?.message              ?? "";
  const online  = navigator.onLine;

  // Log full error details for debugging
  console.error("[login] auth error", { code, message, online, err });

  switch (code) {
    // ── Wrong credentials ──────────────────────────────────────────────────
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "نام کاربری یا رمز عبور اشتباه است.";

    // ── Account state ──────────────────────────────────────────────────────
    case "auth/user-disabled":
      return "حساب شما توسط مدیر غیرفعال شده است.";

    case "auth/too-many-requests":
      return "تعداد تلاش بیش از حد. چند دقیقه صبر کنید.";

    // ── Username / email format ────────────────────────────────────────────
    case "invalid-username":
      return message || "نام کاربری نامعتبر است. فقط حروف انگلیسی و اعداد مجاز است.";

    case "auth/invalid-email":
      return "فرمت نام کاربری نامعتبر است. فقط حروف انگلیسی و اعداد مجاز است.";

    // ── Firebase Auth config ───────────────────────────────────────────────
    case "auth/operation-not-allowed":
      return "ورود با این روش در Firebase فعال نشده. در Firebase Console → Authentication → Sign-in method → Email/Password را فعال کنید.";

    case "auth/requires-recent-login":
      return "نشست منقضی شده. لطفاً دوباره وارد شوید.";

    // ── Network / server ───────────────────────────────────────────────────
    case "auth/network-request-failed":
      // Online but Firebase Auth endpoint unreachable
      return online
        ? "خطای ارتباط با سرور Firebase. ممکن است موقتی باشد — چند ثانیه صبر کنید و دوباره تلاش کنید."
        : "اتصال اینترنت قطع است. اتصال شبکه را بررسی کنید.";

    case "auth/timeout":
    case "auth/web-storage-unsupported":
      return "سرور پاسخ نمی‌دهد. دوباره تلاش کنید.";

    case "auth/internal-error": {
      // Firebase sometimes wraps the real error in the message
      const inner = extractInnerMessage(message);
      return inner ?? "خطای داخلی Firebase. دوباره تلاش کنید.";
    }

    case "auth/app-deleted":
    case "auth/app-not-authorized":
    case "auth/argument-error":
    case "auth/invalid-api-key":
      return "پیکربندی Firebase نادرست است. کلیدهای VITE_ARC_GUARD_* را بررسی کنید.";

    // ── Firestore ──────────────────────────────────────────────────────────
    case "permission-denied":
      return "دسترسی Firebase مجاز نیست. قوانین Firestore را در Firebase Console بررسی کنید.";

    case "unavailable":
      return "سرویس Firebase موقتاً در دسترس نیست. بعد از چند ثانیه دوباره تلاش کنید.";

    case "not-found":
      return "منبع درخواستی در Firestore پیدا نشد.";

    case "unauthenticated":
      return "احراز هویت الزامی است. مجدداً وارد شوید.";

    case "resource-exhausted":
      return "محدودیت درخواست Firebase. بعداً تلاش کنید.";

    default:
      break;
  }

  // Check message text for known patterns (Firebase sometimes embeds error in message)
  if (message.includes("INVALID_LOGIN_CREDENTIALS") || message.includes("INVALID_PASSWORD")) {
    return "نام کاربری یا رمز عبور اشتباه است.";
  }
  if (message.includes("TOO_MANY_ATTEMPTS")) {
    return "تعداد تلاش بیش از حد. چند دقیقه صبر کنید.";
  }
  if (message.includes("USER_DISABLED")) {
    return "حساب شما غیرفعال شده است.";
  }
  if (message.includes("OPERATION_NOT_ALLOWED")) {
    return "ورود با این روش در Firebase فعال نشده است.";
  }
  if (!online) {
    return "اتصال اینترنت قطع است. اتصال شبکه را بررسی کنید.";
  }

  // Absolute fallback — show code + truncated message for debuggability
  const detail = code ? `(${code})` : message ? `(${message.slice(0, 80)})` : "";
  return `خطا در ورود ${detail}. اگر مشکل ادامه داشت با پشتیبانی تماس بگیرید.`;
}

/** Extract a human-readable message from Firebase's wrapped internal errors */
function extractInnerMessage(raw: string): string | null {
  try {
    const match = raw.match(/\{.*\}/s);
    if (!match) return null;
    const obj = JSON.parse(match[0]) as { error?: { message?: string } };
    const msg = obj?.error?.message ?? "";
    if (msg === "INVALID_LOGIN_CREDENTIALS" || msg === "INVALID_PASSWORD" || msg === "EMAIL_NOT_FOUND") {
      return "نام کاربری یا رمز عبور اشتباه است.";
    }
    if (msg === "USER_DISABLED") return "حساب شما غیرفعال شده است.";
    if (msg === "TOO_MANY_ATTEMPTS_TRY_LATER") return "تعداد تلاش بیش از حد. چند دقیقه صبر کنید.";
    return null;
  } catch {
    return null;
  }
}

export default function LoginPage({ onLogin, onRegister }: Props) {
  const [mode, setMode] = useState<LoginMode>("manager");

  // Manager fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Guard fields
  const [guardCode, setGuardCode] = useState("");
  const [pin, setPin]             = useState("");

  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [showGuide, setShowGuide] = useState(false);

  // ── Manager / Super Admin login ────────────────────────────────────────────
  const handleManagerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isFirebaseReady) {
      setError("Firebase پیکربندی نشده است. کلیدهای VITE_ARC_GUARD_* را در Secrets اضافه کنید.");
      return;
    }
    if (!username.trim()) { setError("نام کاربری الزامی است."); return; }
    if (!password)        { setError("رمز عبور الزامی است."); return; }

    console.log("[login] manager attempt →", { username: username.trim(), online: navigator.onLine });
    setLoading(true);
    try {
      const user = await signInWithUsername(username.trim(), password);
      console.log("[login] Firebase Auth ✓ uid:", user.uid, "— loading Firestore profile…");

      const profile = await getUserProfile(user.uid);
      console.log("[login] Firestore profile →", profile ? { role: profile.role, active: profile.active } : null);

      if (!profile) {
        setError("پروفایل کاربری یافت نشد. اگر تازه ثبت‌نام کرده‌اید، مجدداً وارد شوید یا با پشتیبانی تماس بگیرید.");
        return;
      }
      if (!profile.active) {
        setError("حساب شما غیرفعال است. با مدیر تماس بگیرید.");
        return;
      }
      if (profile.role === "guard") {
        setError("این حساب نگهبان است. برای ورود از تب «نگهبان» استفاده کنید.");
        return;
      }

      logger.info("login", `Manager success: ${profile.role}`);
      onLogin(profile);
    } catch (err: unknown) {
      setError(resolveAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Guard login ────────────────────────────────────────────────────────────
  const handleGuardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isFirebaseReady) {
      setError("Firebase پیکربندی نشده است. کلیدهای VITE_ARC_GUARD_* را در Secrets اضافه کنید.");
      return;
    }
    if (!guardCode.trim()) { setError("کد نگهبان الزامی است."); return; }
    if (!pin)              { setError("PIN الزامی است."); return; }

    const normalizedCode = guardCode.trim().toUpperCase();
    console.log("[login] guard attempt →", { guardCode: normalizedCode, online: navigator.onLine });
    setLoading(true);
    try {
      // Step 1: look up companyId from Firestore by guardCode (no invite code needed at login)
      console.log("[login] looking up companyId for guard code…");
      const companyId = await lookupGuardCompanyId(normalizedCode);
      console.log("[login] companyId lookup →", companyId ?? "NOT FOUND");

      if (!companyId) {
        setError("کد نگهبان ثبت نشده است. ابتدا با کد دعوت شرکت ثبت‌نام کنید.");
        return;
      }

      // Step 2: Firebase Auth with derived synthetic email
      const user = await signInWithGuardCode(normalizedCode, companyId, pin);
      console.log("[login] Firebase Auth ✓ uid:", user.uid, "— loading guard profile…");

      // Step 3: Load Firestore profile
      const profile = await getUserProfile(user.uid);
      console.log("[login] guard profile →", profile ? { role: profile.role, active: profile.active, companyId: profile.companyId } : null);

      if (!profile) {
        setError("پروفایل نگهبان یافت نشد. ابتدا با کد دعوت شرکت ثبت‌نام کنید.");
        return;
      }
      if (!profile.active) {
        setError("حساب نگهبان غیرفعال است. با مدیر تماس بگیرید.");
        return;
      }

      logger.info("login", `Guard success: ${profile.displayName}`);
      onLogin(profile);
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? "";
      if (msg.includes("کد نگهبان") || msg.includes("PIN")) {
        setError(msg);
      } else {
        setError(resolveAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const spinnerSvg = (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );

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
                  { n: "۱", t: "پروژه Firebase جدید بسازید", b: "console.firebase.google.com → Add project" },
                  { n: "۲", t: "Auth و Firestore را فعال کنید", b: "Authentication → Email/Password → Enable\nFirestore → Create database → Production mode" },
                  { n: "۳", t: "این ۶ Secret را در Replit اضافه کنید", b: "VITE_ARC_GUARD_API_KEY\nVITE_ARC_GUARD_AUTH_DOMAIN\nVITE_ARC_GUARD_PROJECT_ID\nVITE_ARC_GUARD_STORAGE_BUCKET\nVITE_ARC_GUARD_MESSAGING_SENDER_ID\nVITE_ARC_GUARD_APP_ID" },
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

        {/* ── Login card ── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">

          {/* Tab switcher */}
          <div className="flex border-b border-border">
            {(["manager", "guard"] as const).map((m) => (
              <button key={m} type="button"
                onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-[15px] font-bold transition-colors ${
                  mode === m
                    ? "bg-primary/[0.08] text-foreground border-b-[3px] border-primary"
                    : "text-muted-foreground border-b-[3px] border-transparent hover:text-foreground hover:bg-accent/60"
                }`}>
                {m === "manager"
                  ? <><Building2 className="w-4 h-4" />مدیر / ادمین</>
                  : <><Shield   className="w-4 h-4" />نگهبان</>}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* ── Manager form ── */}
            {mode === "manager" && (
              <form onSubmit={handleManagerLogin} className="space-y-3" noValidate>
                <div>
                  <label htmlFor="arc-username" className="text-xs text-muted-foreground block mb-1">نام کاربری</label>
                  <div className="relative">
                    <AtSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      id="arc-username"
                      type="text"
                      inputMode="text"
                      value={username}
                      onChange={e => setUsername(e.target.value.toLowerCase())}
                      placeholder="نام کاربری خود را وارد کنید"
                      autoComplete="username"
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
                    <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && <ErrorBanner msg={error} />}

                <button type="submit" disabled={loading || !isFirebaseReady}
                  className="w-full bg-primary text-primary-foreground rounded-lg py-3 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] transition-all select-none">
                  {loading
                    ? <span className="flex items-center justify-center gap-2">{spinnerSvg}در حال ورود...</span>
                    : "ورود"}
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
                  <p className="text-[10px] text-muted-foreground mt-1">کد اختصاصی نگهبان — از مدیر دریافت کنید</p>
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
                    <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && <ErrorBanner msg={error} />}

                <button type="submit" disabled={loading || !isFirebaseReady}
                  className="w-full bg-primary text-primary-foreground rounded-lg py-3 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] transition-all select-none">
                  {loading
                    ? <span className="flex items-center justify-center gap-2">{spinnerSvg}در حال ورود...</span>
                    : "ورود نگهبان"}
                </button>

                <p className="text-center text-[11px] text-muted-foreground pt-1">
                  اولین بار است؟{" "}
                  <button type="button" onClick={onRegister} className="text-primary hover:underline font-medium">
                    ثبت‌نام با کد دعوت شرکت
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

        {/* Register link */}
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

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5" role="alert">
      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span className="leading-relaxed">{msg}</span>
    </div>
  );
}
