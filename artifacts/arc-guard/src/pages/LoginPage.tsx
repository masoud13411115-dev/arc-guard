import { useState } from "react";
import { Shield, Eye, EyeOff, Lock, Mail, AlertCircle, Info, ChevronDown, ChevronUp, Crown } from "lucide-react";
import arcGuardLogo from "/arc-guard-logo.png";
import { signIn, getUserProfile, demoLogin } from "@/lib/auth";
import { isFirebaseReady } from "@/firebase";
import type { UserProfile } from "@/types";

interface Props {
  onLogin: (profile: UserProfile) => void;
  onRegister: () => void;
}

export default function LoginPage({ onLogin, onRegister }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showGuide, setShowGuide] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isFirebaseReady) { setError("Firebase پیکربندی نشده. از دکمه‌های دمو بالا استفاده کنید."); return; }
    if (!email.trim() || !password) { setError("ایمیل و رمز عبور الزامی است."); return; }
    setLoading(true);
    try {
      const user = await signIn(email.trim(), password);
      const profile = await getUserProfile(user.uid);
      if (!profile) { setError("پروفایل کاربری یافت نشد."); return; }
      if (!profile.active) { setError("حساب شما غیرفعال است. با مدیر تماس بگیرید."); return; }
      onLogin(profile);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (["auth/user-not-found","auth/wrong-password","auth/invalid-credential"].includes(code))
        setError("ایمیل یا رمز عبور اشتباه است.");
      else if (code === "auth/too-many-requests") setError("تعداد تلاش زیاد. چند دقیقه صبر کنید.");
      else if (code === "auth/network-request-failed") setError("خطای اتصال به اینترنت.");
      else setError("خطا در ورود. دوباره تلاش کنید.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background arc-grid-bg" dir="rtl">
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div className="w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle,rgba(14,165,233,.5) 0%,transparent 65%)" }} />
      </div>

      <div className="relative w-full max-w-sm mx-auto px-5 py-8 space-y-4">

        {/* Logo */}
        <div className="flex flex-col items-center mb-1">
          <img src={arcGuardLogo} alt="ARC Guard" className="w-20 h-20 object-contain mb-3"
            style={{ filter: "drop-shadow(0 0 20px rgba(14,165,233,.5))" }} />
          <h1 className="text-2xl font-bold text-primary tracking-wider">ARC Guard</h1>
          <p className="text-xs text-muted-foreground mt-1">سیستم هوشمند گشت امنیتی · پلتفرم SaaS</p>
        </div>

        {/* ── Demo buttons ── */}
        <div className="rounded-2xl border-2 border-sky-500/50 bg-sky-500/10 p-4">
          <p className="text-center text-sm font-bold text-sky-400 mb-3">
            ورود نمونه — بدون نیاز به Firebase
          </p>
          <div className="grid grid-cols-3 gap-2">
            {/* Manager */}
            <button
              type="button"
              onClick={() => onLogin(demoLogin("manager"))}
              style={{
                minHeight: 76, background: "rgba(14,165,233,0.25)",
                border: "2px solid rgba(14,165,233,0.7)", borderRadius: 12,
                color: "#38bdf8", fontWeight: 700, fontSize: 13, cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 4,
                WebkitTapHighlightColor: "rgba(14,165,233,0.4)", userSelect: "none",
              }}
            >
              <span style={{ fontSize: 22 }}>👔</span>
              <span>مدیر</span>
              <span style={{ fontSize: 10, opacity: 0.75, fontWeight: 400 }}>Manager</span>
            </button>

            {/* Guard */}
            <button
              type="button"
              onClick={() => onLogin(demoLogin("guard"))}
              style={{
                minHeight: 76, background: "rgba(255,255,255,0.07)",
                border: "2px solid rgba(255,255,255,0.2)", borderRadius: 12,
                color: "#e2e8f0", fontWeight: 700, fontSize: 13, cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 4,
                WebkitTapHighlightColor: "rgba(255,255,255,0.15)", userSelect: "none",
              }}
            >
              <span style={{ fontSize: 22 }}>🛡️</span>
              <span>نگهبان</span>
              <span style={{ fontSize: 10, opacity: 0.6, fontWeight: 400 }}>Guard</span>
            </button>

            {/* Super Admin */}
            <button
              type="button"
              onClick={() => onLogin(demoLogin("super_admin"))}
              style={{
                minHeight: 76, background: "rgba(234,179,8,0.15)",
                border: "2px solid rgba(234,179,8,0.5)", borderRadius: 12,
                color: "#facc15", fontWeight: 700, fontSize: 13, cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 4,
                WebkitTapHighlightColor: "rgba(234,179,8,0.3)", userSelect: "none",
              }}
            >
              <span style={{ fontSize: 22 }}>👑</span>
              <span>ادمین</span>
              <span style={{ fontSize: 10, opacity: 0.7, fontWeight: 400 }}>Super Admin</span>
            </button>
          </div>
        </div>

        {/* Firebase warning */}
        {!isFirebaseReady && (
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/[0.06]">
            <div className="flex items-start gap-3 px-4 py-3">
              <Info className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-yellow-400">Firebase پیکربندی نشده</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  برای حالت واقعی، کلیدهای <span className="font-mono text-yellow-400/80">VITE_ARC_GUARD_*</span> را در Secrets اضافه کنید.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowGuide(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2 border-t border-yellow-500/20 text-xs text-yellow-400/70 hover:bg-yellow-500/10 transition-colors"
            >
              <span>راهنمای راه‌اندازی Firebase</span>
              {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showGuide && (
              <div className="px-4 pb-4 pt-2 space-y-3 border-t border-yellow-500/20 bg-black/20">
                {[
                  { n:"۱", t:"پروژه Firebase جدید بسازید", b:"console.firebase.google.com → Add project" },
                  { n:"۲", t:"Auth و Firestore را فعال کنید", b:"Authentication → Email/Password → Enable\nFirestore → Create database → Test mode" },
                  { n:"۳", t:"این ۶ Secret را در Replit اضافه کنید", b:"VITE_ARC_GUARD_API_KEY\nVITE_ARC_GUARD_AUTH_DOMAIN\nVITE_ARC_GUARD_PROJECT_ID\nVITE_ARC_GUARD_STORAGE_BUCKET\nVITE_ARC_GUARD_MESSAGING_SENDER_ID\nVITE_ARC_GUARD_APP_ID" },
                ].map(({n,t,b}) => (
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

        {/* Login form */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold">ورود با حساب Firebase</span>
            {!isFirebaseReady && (
              <span className="mr-auto text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">غیرفعال</span>
            )}
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">ایمیل</label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="example@company.com" autoComplete="email" disabled={!isFirebaseReady}
                  className="w-full bg-muted border border-border rounded-lg pr-10 pl-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">رمز عبور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password" disabled={!isFirebaseReady}
                  className="w-full bg-muted border border-border rounded-lg pr-10 pl-10 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed" />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && (
              <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{error}
              </div>
            )}
            <button type="submit" disabled={loading || !isFirebaseReady}
              className="w-full bg-primary text-primary-foreground rounded-lg py-3 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] transition-all">
              {loading
                ? <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>در حال ورود...
                  </span>
                : "ورود"}
            </button>
          </form>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${isFirebaseReady ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`} />
            <span className="text-xs text-muted-foreground">
              {isFirebaseReady ? "Firebase ARC Guard متصل" : "حالت نمونه · Firebase متصل نیست"}
            </span>
          </div>
        </div>

        {isFirebaseReady && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              شرکت ندارید؟{" "}
              <button type="button" onClick={onRegister} className="text-primary hover:underline font-medium">
                ثبت شرکت جدید
              </button>
            </p>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground opacity-40">ARC Guard v3.0 · SaaS Multi-Tenant</p>
      </div>
    </div>
  );
}
