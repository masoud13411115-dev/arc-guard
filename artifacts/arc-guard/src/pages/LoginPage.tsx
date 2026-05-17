import { useState, useEffect } from "react";
import {
  Shield, Eye, EyeOff, Lock, AlertCircle, Info, CheckCircle, WifiOff,
  ChevronDown, ChevronUp, Hash, Building2, AtSign,
} from "lucide-react";
import arcGuardLogo from "/arc-guard-logo.png";
import {
  signInWithUsername, signInWithGuardCode, lookupGuardCompanyId,
  getUserProfile,
} from "@/lib/auth";
import {
  saveOfflineManagerCred, verifyOfflineManagerCred, hasOfflineManagerCred,
  saveProfileCache, loadProfileCache,
  saveLastManagerProfile, saveLastGuardProfile,
  saveGuardOfflineCred, verifyGuardOfflineCred, hasGuardOfflineCred,
} from "@/lib/offlineAuth";
import { isFirebaseReady } from "@/firebase";
import { logger } from "@/lib/logger";
import type { UserProfile } from "@/types";
import { useI18n } from "@/lib/i18n";
import LanguageSelector from "@/components/LanguageSelector";

interface Props {
  onLogin: (profile: UserProfile) => void;
  onRegister: () => void;
  lockedMode?: "manager" | "guard";
}

type LoginMode = "manager" | "guard";

// ── Error resolver — returns Persian text always (auth errors are backend) ────
function resolveAuthError(err: unknown): string {
  const code    = (err as { code?: string })?.code    ?? "";
  const message = (err as Error)?.message              ?? "";
  const online  = navigator.onLine;
  console.error("[login] auth error", { code, message, online, err });
  switch (code) {
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "نام کاربری یا رمز عبور اشتباه است.";
    case "auth/user-disabled":
      return "حساب شما توسط مدیر غیرفعال شده است.";
    case "auth/too-many-requests":
      return "تعداد تلاش بیش از حد. چند دقیقه صبر کنید.";
    case "invalid-username":
      return message || "نام کاربری نامعتبر است.";
    case "auth/invalid-email":
      return "فرمت نام کاربری نامعتبر است.";
    case "auth/operation-not-allowed":
      return "ورود با این روش در Firebase فعال نشده.";
    case "auth/requires-recent-login":
      return "نشست منقضی شده. لطفاً دوباره وارد شوید.";
    case "auth/network-request-failed":
      return online
        ? "خطای ارتباط با سرور Firebase. چند ثانیه صبر کنید و دوباره تلاش کنید."
        : "اتصال اینترنت قطع است.";
    case "auth/timeout":
    case "auth/web-storage-unsupported":
      return "سرور پاسخ نمی‌دهد. دوباره تلاش کنید.";
    case "auth/internal-error": {
      const inner = extractInnerMessage(message);
      return inner ?? "خطای داخلی Firebase. دوباره تلاش کنید.";
    }
    case "auth/app-deleted":
    case "auth/app-not-authorized":
    case "auth/argument-error":
    case "auth/invalid-api-key":
      return "پیکربندی Firebase نادرست است. کلیدهای VITE_ARC_GUARD_* را بررسی کنید.";
    case "permission-denied":
      return "دسترسی Firebase مجاز نیست. قوانین Firestore را بررسی کنید.";
    case "unavailable":
      return "سرویس Firebase موقتاً در دسترس نیست.";
    case "not-found":
      return "منبع درخواستی در Firestore پیدا نشد.";
    case "unauthenticated":
      return "احراز هویت الزامی است. مجدداً وارد شوید.";
    case "resource-exhausted":
      return "محدودیت درخواست Firebase. بعداً تلاش کنید.";
    default: break;
  }
  if (message.includes("INVALID_LOGIN_CREDENTIALS") || message.includes("INVALID_PASSWORD"))
    return "نام کاربری یا رمز عبور اشتباه است.";
  if (message.includes("TOO_MANY_ATTEMPTS"))
    return "تعداد تلاش بیش از حد. چند دقیقه صبر کنید.";
  if (message.includes("USER_DISABLED"))
    return "حساب شما غیرفعال شده است.";
  if (message.includes("OPERATION_NOT_ALLOWED"))
    return "ورود با این روش در Firebase فعال نشده است.";
  if (!online) return "اتصال اینترنت قطع است.";
  const detail = code ? `(${code})` : message ? `(${message.slice(0, 80)})` : "";
  return `خطا در ورود ${detail}. اگر مشکل ادامه داشت با پشتیبانی تماس بگیرید.`;
}

function extractInnerMessage(raw: string): string | null {
  try {
    const match = raw.match(/\{.*\}/s);
    if (!match) return null;
    const obj = JSON.parse(match[0]) as { error?: { message?: string } };
    const msg = obj?.error?.message ?? "";
    if (msg === "INVALID_LOGIN_CREDENTIALS" || msg === "INVALID_PASSWORD" || msg === "EMAIL_NOT_FOUND")
      return "نام کاربری یا رمز عبور اشتباه است.";
    if (msg === "USER_DISABLED") return "حساب شما غیرفعال شده است.";
    if (msg === "TOO_MANY_ATTEMPTS_TRY_LATER") return "تعداد تلاش بیش از حد. چند دقیقه صبر کنید.";
    return null;
  } catch { return null; }
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-2.5">
      <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
      <p className="text-[13px] text-destructive leading-relaxed">{msg}</p>
    </div>
  );
}

export default function LoginPage({ onLogin, onRegister, lockedMode }: Props) {
  const { t, dir, isRTL } = useI18n();
  const [mode, setMode] = useState<LoginMode>(lockedMode ?? "manager");

  const [username, setUsername]         = useState("");
  const [password, setPassword]         = useState("");
  const [guardCode, setGuardCode]       = useState("");
  const [pin, setPin]                   = useState("");
  const [showPw, setShowPw]             = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [showGuide, setShowGuide]       = useState(false);
  const [offlineSuccess, setOfflineSuccess] = useState(false);
  const [online, setOnline]             = useState(navigator.onLine);

  // Track network state so form enables/disables dynamically
  useEffect(() => {
    const onOnline  = () => { setOnline(true);  setError(""); setOfflineSuccess(false); };
    const onOffline = () => { setOnline(false); setError(""); setOfflineSuccess(false); };
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // ── Manager login ─────────────────────────────────────────────────────────
  const handleManagerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOfflineSuccess(false);
    if (!username.trim()) { setError("نام کاربری الزامی است."); return; }
    if (!password)        { setError("رمز عبور الزامی است."); return; }

    // ── Offline / no-Firebase path ──────────────────────────────────────────
    // Triggered when: (a) no internet, OR (b) Firebase not configured.
    // In either case we verify the locally cached credential hash and restore
    // the profile from localStorage — no network required.
    if (!online || !isFirebaseReady) {
      setLoading(true);
      try {
        const uid = await verifyOfflineManagerCred(username.trim(), password);
        if (uid === null) {
          // Distinguish: no cached session vs wrong password
          setError(
            hasOfflineManagerCred(username.trim())
              ? "نام کاربری یا رمز عبور اشتباه است."
              : t("login.offline.firstTime"),
          );
          return;
        }
        const profile = loadProfileCache(uid);
        if (!profile) {
          setError(t("login.offline.firstTime"));
          return;
        }
        logger.info("login", "Offline manager login success");
        setOfflineSuccess(true);
        // Brief delay so user sees the success banner before navigating
        setTimeout(() => onLogin(profile), 900);
      } catch {
        setError("خطا در تأیید هویت آفلاین. دوباره تلاش کنید.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Online path (Firebase) ─────────────────────────────────────────────
    console.log("[login] manager attempt →", { username: username.trim(), online });
    setLoading(true);
    try {
      const user    = await signInWithUsername(username.trim(), password);
      const profile = await getUserProfile(user.uid);
      if (!profile) { setError("پروفایل کاربری یافت نشد."); return; }
      if (!profile.active) { setError("حساب شما غیرفعال است. با مدیر تماس بگیرید."); return; }
      if (profile.role === "guard") { setError("این حساب نگهبان است. برای ورود از تب «نگهبان» استفاده کنید."); return; }

      // Persist credentials + profile for future offline / IndexedDB-only logins
      saveProfileCache(profile);
      saveLastManagerProfile(profile);
      saveOfflineManagerCred(username.trim(), password, user.uid).catch(() => {});

      logger.info("login", `Manager success: ${profile.role}`);
      onLogin(profile);
    } catch (err: unknown) { setError(resolveAuthError(err)); }
    finally { setLoading(false); }
  };

  // ── Guard login ────────────────────────────────────────────────────────────
  // Supports three paths:
  //  1. Offline (no internet) → verify cached PIN hash → restore cached profile
  //  2. Firebase not configured + online → same offline path (IndexedDB-only setup)
  //  3. Online + Firebase ready → full Firebase Auth → save creds for future offline use
  const handleGuardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOfflineSuccess(false);
    if (!guardCode.trim()) { setError("کد نگهبان الزامی است."); return; }
    if (!pin)              { setError("PIN الزامی است."); return; }
    const normalizedCode = guardCode.trim().toUpperCase();
    setLoading(true);

    // ── Offline / no-Firebase path ─────────────────────────────────────────
    if (!online || !isFirebaseReady) {
      try {
        const creds = await verifyGuardOfflineCred(normalizedCode, pin);
        if (!creds) {
          setError(
            hasGuardOfflineCred(normalizedCode)
              ? "کد نگهبان یا PIN اشتباه است."
              : "برای اولین ورود، اتصال اینترنت لازم است.",
          );
          return;
        }
        const profile = loadProfileCache(creds.uid);
        if (!profile) {
          setError("برای اولین ورود، اتصال اینترنت لازم است.");
          return;
        }
        logger.info("login", "Guard offline login success");
        setOfflineSuccess(true);
        setTimeout(() => onLogin(profile), 900);
      } catch {
        setError("خطا در تأیید هویت آفلاین. دوباره تلاش کنید.");
      } finally { setLoading(false); }
      return;
    }

    // ── Online path (Firebase) ─────────────────────────────────────────────
    try {
      const companyId = await lookupGuardCompanyId(normalizedCode);
      if (!companyId) { setError("کد نگهبان ثبت نشده است. ابتدا با کد دعوت شرکت ثبت‌نام کنید."); return; }
      const user    = await signInWithGuardCode(normalizedCode, companyId, pin);
      const profile = await getUserProfile(user.uid);
      if (!profile) { setError("پروفایل نگهبان یافت نشد."); return; }
      if (!profile.active) { setError("حساب نگهبان غیرفعال است. با مدیر تماس بگیرید."); return; }

      // Cache credentials + profile for future offline / IndexedDB-only sessions
      saveProfileCache(profile);
      saveLastGuardProfile(profile);
      saveGuardOfflineCred(normalizedCode, pin, user.uid, companyId).catch(() => {});

      logger.info("login", `Guard success: ${profile.displayName}`);
      onLogin(profile);
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? "";
      setError(msg.includes("کد نگهبان") || msg.includes("PIN") ? msg : resolveAuthError(err));
    } finally { setLoading(false); }
  };

  const spinnerSvg = (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );

  // Form inputs for manager are disabled only when Firebase isn't ready AND we're online
  // (i.e. demo mode). When offline, inputs are always enabled so offline login works.
  const managerInputsDisabled = !isFirebaseReady && online;

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background arc-grid-bg" dir={dir}>
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div className="w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle,rgba(14,165,233,.5) 0%,transparent 65%)" }} />
      </div>

      <div className="relative w-full max-w-sm mx-auto px-5 py-8 space-y-4"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>

        {/* Language selector */}
        <div className={`flex ${isRTL ? "justify-start" : "justify-end"}`}>
          <LanguageSelector variant="full" />
        </div>

        {/* Logo */}
        <div className="flex flex-col items-center mb-1">
          <img src={arcGuardLogo} alt="ARC Guard" className="w-20 h-20 object-contain mb-3"
            style={{ filter: "drop-shadow(0 0 20px rgba(14,165,233,.5))" }} />
          <h1 className="text-2xl font-bold text-primary tracking-wider">{t("app.name")}</h1>
          <p className="text-xs text-muted-foreground mt-1">{t("app.saas")}</p>
        </div>

        {/* Offline mode indicator */}
        {!online && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-yellow-500/35 bg-yellow-500/10">
            <WifiOff className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <p className="text-[12px] text-yellow-300 font-medium">{t("login.offline.badge")}</p>
          </div>
        )}

        {/* Firebase not configured warning (only when online — offline we rely on cache) */}
        {!isFirebaseReady && online && (
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/[0.06]">
            <div className="flex items-start gap-3 px-4 py-3">
              <Info className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-yellow-400">{t("login.firebase.notReady")}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t("login.firebase.notReady.desc")}</p>
              </div>
            </div>
            <button type="button" onClick={() => setShowGuide(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2 border-t border-yellow-500/20 text-xs text-yellow-400/70 hover:bg-yellow-500/10 transition-colors">
              <span>{t("login.firebase.guide")}</span>
              {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showGuide && (
              <div className="px-4 pb-4 pt-2 space-y-3 border-t border-yellow-500/20 bg-black/20">
                {[
                  { n: "1", t: "Create Firebase project", b: "console.firebase.google.com → Add project" },
                  { n: "2", t: "Enable Auth & Firestore", b: "Authentication → Email/Password → Enable\nFirestore → Create database → Production mode" },
                  { n: "3", t: "Add 6 secrets in Replit", b: "VITE_ARC_GUARD_API_KEY\nVITE_ARC_GUARD_AUTH_DOMAIN\nVITE_ARC_GUARD_PROJECT_ID\nVITE_ARC_GUARD_STORAGE_BUCKET\nVITE_ARC_GUARD_MESSAGING_SENDER_ID\nVITE_ARC_GUARD_APP_ID" },
                ].map(({ n, t: title, b }) => (
                  <div key={n} className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-yellow-400/20 border border-yellow-500/40 flex items-center justify-center text-[10px] font-bold text-yellow-400 shrink-0 mt-0.5">{n}</div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 whitespace-pre-line font-mono">{b}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Login card */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">

          {/* Tab switcher — hidden when lockedMode is set */}
          {!lockedMode && (
            <div className="flex border-b border-border">
              {(["manager", "guard"] as const).map((m) => (
                <button key={m} type="button"
                  onClick={() => { setMode(m); setError(""); setOfflineSuccess(false); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 text-[16px] font-bold transition-colors border-b-[3px] ${
                    mode === m
                      ? "bg-primary/15 text-white border-primary [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]"
                      : "text-gray-400 border-transparent hover:text-gray-200 hover:bg-white/[0.04]"
                  }`}
                  style={mode === m ? { color: '#ffffff' } : {}}>
                  {m === "manager"
                    ? <><Building2 className="w-[18px] h-[18px]" />{t("login.tab.manager")}</>
                    : <><Shield   className="w-[18px] h-[18px]" />{t("login.tab.guard")}</>}
                </button>
              ))}
            </div>
          )}

          {/* Locked mode header */}
          {lockedMode && (
            <div className={`flex items-center justify-center gap-2.5 py-4 border-b border-border ${
              lockedMode === "guard" ? "bg-green-500/[0.06]" : "bg-primary/[0.06]"
            }`}>
              {lockedMode === "guard"
                ? <Shield className="w-5 h-5 text-green-400" />
                : <Building2 className="w-5 h-5 text-primary" />}
              <span className={`text-[17px] font-bold ${lockedMode === "guard" ? "text-green-400" : "text-primary"}`}>
                {lockedMode === "guard" ? t("login.guard.title") : t("login.manager.title")}
              </span>
            </div>
          )}

          <div className="p-5">
            {/* Manager form */}
            {mode === "manager" && (
              <form onSubmit={handleManagerLogin} className="space-y-3" noValidate>
                <div>
                  <label htmlFor="arc-username" className="text-xs text-muted-foreground block mb-1">{t("login.username")}</label>
                  <div className="relative">
                    <AtSign className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none`} />
                    <input
                      id="arc-username"
                      type="text"
                      inputMode="text"
                      value={username}
                      onChange={e => setUsername(e.target.value.toLowerCase())}
                      placeholder={t("login.username.placeholder")}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      disabled={managerInputsDisabled || offlineSuccess}
                      dir="ltr"
                      className={`w-full bg-muted border border-border rounded-lg ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="arc-password" className="text-xs text-muted-foreground block mb-1">{t("login.password")}</label>
                  <div className="relative">
                    <Lock className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none`} />
                    <input
                      id="arc-password"
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={t("login.password.placeholder")}
                      autoComplete="current-password"
                      disabled={managerInputsDisabled || offlineSuccess}
                      dir="ltr"
                      className={`w-full bg-muted border border-border rounded-lg ${isRTL ? "pr-10 pl-10" : "pl-10 pr-10"} py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                      className={`absolute ${isRTL ? "left-3" : "right-3"} top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors`}>
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Offline success banner */}
                {offlineSuccess && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-green-500/40 bg-green-500/10 px-3.5 py-2.5">
                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                    <p className="text-[13px] text-green-400 leading-relaxed">{t("login.offline.success")}</p>
                  </div>
                )}

                {error && !offlineSuccess && <ErrorBanner msg={error} />}

                <button type="submit" disabled={loading || managerInputsDisabled || offlineSuccess}
                  className="w-full bg-primary text-primary-foreground rounded-lg py-3 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] transition-all select-none">
                  {loading
                    ? <span className="flex items-center justify-center gap-2">{spinnerSvg}{t("login.btn.loading")}</span>
                    : !online
                    ? <span className="flex items-center justify-center gap-2"><WifiOff className="w-4 h-4" />{t("login.btn.login")}</span>
                    : t("login.btn.login")}
                </button>
              </form>
            )}

            {/* Guard form */}
            {mode === "guard" && (
              <form onSubmit={handleGuardLogin} className="space-y-3" noValidate>
                <div>
                  <label htmlFor="arc-guard-code" className="text-xs text-muted-foreground block mb-1">{t("login.guardCode")}</label>
                  <div className="relative">
                    <Hash className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none`} />
                    <input
                      id="arc-guard-code"
                      type="text"
                      value={guardCode}
                      onChange={e => setGuardCode(e.target.value.toUpperCase())}
                      placeholder={t("login.guardCode.placeholder")}
                      autoComplete="username"
                      autoCapitalize="characters"
                      spellCheck={false}
                      disabled={!isFirebaseReady}
                      dir="ltr"
                      className={`w-full bg-muted border border-border rounded-lg ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors tracking-wider`}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{t("login.guardCode.hint")}</p>
                </div>
                <div>
                  <label htmlFor="arc-pin" className="text-xs text-muted-foreground block mb-1">{t("login.pin")}</label>
                  <div className="relative">
                    <Lock className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none`} />
                    <input
                      id="arc-pin"
                      type={showPw ? "text" : "password"}
                      value={pin}
                      onChange={e => setPin(e.target.value)}
                      placeholder={t("login.pin.placeholder")}
                      autoComplete="current-password"
                      disabled={!isFirebaseReady}
                      dir="ltr"
                      className={`w-full bg-muted border border-border rounded-lg ${isRTL ? "pr-10 pl-10" : "pl-10 pr-10"} py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                      className={`absolute ${isRTL ? "left-3" : "right-3"} top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors`}>
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {error && <ErrorBanner msg={error} />}
                <button type="submit" disabled={loading || !isFirebaseReady}
                  className="w-full bg-green-500 text-white rounded-lg py-3 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] transition-all select-none">
                  {loading
                    ? <span className="flex items-center justify-center gap-2">{spinnerSvg}{t("login.btn.loading")}</span>
                    : t("login.btn.login")}
                </button>
              </form>
            )}
          </div>

          {/* Footer links */}
          <div className="px-5 pb-4 space-y-2 border-t border-border pt-4">
            {/* Firebase / network status */}
            <p className="text-[11px] text-center text-muted-foreground/60 flex items-center justify-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${
                !online ? "bg-yellow-400 animate-pulse" : isFirebaseReady ? "bg-green-400" : "bg-yellow-400"
              }`} />
              {!online
                ? t("login.offline.badge")
                : isFirebaseReady
                ? t("login.firebase.connected", { name: t("app.name") })
                : t("login.firebase.disconnected")}
            </p>

            {/* Register link — guard mode */}
            {mode === "guard" && (
              <button type="button" onClick={onRegister}
                className="w-full text-center text-[13px] text-primary hover:underline">
                {t("login.register.link")}
              </button>
            )}

            {/* Register company — manager mode (only if not locked) */}
            {mode === "manager" && !lockedMode && (
              <button type="button" onClick={onRegister}
                className="w-full text-center text-[13px] text-primary hover:underline">
                {t("login.noCompany")}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/30">{t("app.version")}</p>
      </div>
    </div>
  );
}
