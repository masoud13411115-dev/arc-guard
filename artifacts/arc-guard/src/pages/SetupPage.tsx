import { useState } from "react";
import {
  Shield, Building2, User, Mail, Lock, Eye, EyeOff,
  ArrowRight, CheckCircle, AlertCircle, Hash, KeyRound,
} from "lucide-react";
import arcGuardLogo from "/arc-guard-logo.png";
import { registerManager, registerGuardWithCode, resolveCompanyByInviteCode, getUserProfile } from "@/lib/auth";
import { signIn } from "@/lib/auth";
import type { UserProfile } from "@/types";

type Mode = "choose" | "manager" | "guard";

interface SetupPageProps {
  onComplete: (profile: UserProfile) => void;
  onBack: () => void;
}

export default function SetupPage({ onComplete, onBack }: SetupPageProps) {
  const [mode, setMode] = useState<Mode>("choose");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Manager form
  const [mEmail, setMEmail]     = useState("");
  const [mPass, setMPass]       = useState("");
  const [mName, setMName]       = useState("");
  const [mCompany, setMCompany] = useState("");

  // Guard form — no email needed
  const [gName, setGName]           = useState("");
  const [gGuardCode, setGGuardCode] = useState("");
  const [gInviteCode, setGInviteCode] = useState("");
  const [gPin, setGPin]             = useState("");
  const [gPinConfirm, setGPinConfirm] = useState("");

  const handleManagerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!mEmail || !mPass || !mName || !mCompany) { setError("همه فیلدها الزامی است."); return; }
    if (mPass.length < 6) { setError("رمز عبور باید حداقل ۶ کاراکتر باشد."); return; }
    setLoading(true);
    try {
      const profile = await registerManager(mEmail.trim(), mPass, mName.trim(), mCompany.trim());
      onComplete(profile);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/email-already-in-use") setError("این ایمیل قبلاً ثبت شده است.");
      else if (code === "auth/weak-password") setError("رمز عبور بسیار ضعیف است.");
      else setError("خطا در ثبت‌نام: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuardRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!gName.trim())        { setError("نام کامل الزامی است."); return; }
    if (!gGuardCode.trim())   { setError("کد نگهبان الزامی است."); return; }
    if (!gInviteCode.trim())  { setError("کد دعوت شرکت الزامی است."); return; }
    if (!gPin)                { setError("PIN الزامی است."); return; }
    if (gPin.length < 6)      { setError("PIN باید حداقل ۶ کاراکتر باشد."); return; }
    if (gPin !== gPinConfirm) { setError("PIN و تکرار آن مطابقت ندارند."); return; }

    setLoading(true);
    try {
      // 1. Resolve company from invite code
      const company = await resolveCompanyByInviteCode(gInviteCode.trim().toUpperCase());

      // 2. Register guard with synthetic email (no real email required)
      const profile = await registerGuardWithCode(
        gName.trim(),
        gGuardCode.trim().toUpperCase(),
        company.id,
        company.name,
        gPin,
      );
      onComplete(profile);
    } catch (err: unknown) {
      const code  = (err as { code?: string })?.code ?? "";
      const msg   = (err as Error).message ?? "";
      if (msg.includes("کد دعوت")) setError(msg);
      else if (code === "auth/email-already-in-use") setError("این کد نگهبان قبلاً در این شرکت ثبت شده است.");
      else if (code === "auth/weak-password") setError("PIN بسیار ضعیف است. از ۶ رقم یا بیشتر استفاده کنید.");
      else setError("خطا: " + msg);
    } finally {
      setLoading(false);
    }
  };

  const commonInput = "w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors";
  const labelClass = "text-xs text-muted-foreground tracking-wide";

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-background arc-grid-bg" dir="rtl">
      <div className="absolute top-5 left-5 w-7 h-7 border-l-2 border-t-2 border-primary opacity-30" />
      <div className="absolute top-5 right-5 w-7 h-7 border-r-2 border-t-2 border-primary opacity-30" />
      <div className="absolute bottom-5 left-5 w-7 h-7 border-l-2 border-b-2 border-primary opacity-30" />
      <div className="absolute bottom-5 right-5 w-7 h-7 border-r-2 border-b-2 border-primary opacity-30" />

      <div className="relative z-10 w-full max-w-sm mx-auto px-6 py-8 animate-fade-in-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <img src={arcGuardLogo} alt="ARC Guard" className="w-20 h-20 object-contain mb-3"
            style={{ filter: "drop-shadow(0 0 16px rgba(14,165,233,0.5))" }} />
          <h1 className="text-xl font-bold text-primary arc-glow-text">ARC Guard</h1>
          <p className="text-xs text-muted-foreground mt-1">ایجاد حساب کاربری</p>
        </div>

        {/* Mode chooser */}
        {mode === "choose" && (
          <div className="space-y-3">
            <p className="text-sm text-center text-muted-foreground mb-4">نوع حساب کاربری خود را انتخاب کنید:</p>

            <button onClick={() => setMode("manager")}
              className="w-full rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-4 hover:bg-primary/10 hover:border-primary/50 transition-all group text-right">
              <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 group-hover:bg-primary/25 transition-colors">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">مدیر امنیت</p>
                <p className="text-xs text-muted-foreground mt-0.5">ایجاد شرکت جدید و مدیریت نگهبانان</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>

            <button onClick={() => setMode("guard")}
              className="w-full rounded-xl border border-border bg-card p-4 flex items-center gap-4 hover:bg-accent hover:border-primary/30 transition-all group text-right">
              <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">نگهبان</p>
                <p className="text-xs text-muted-foreground mt-0.5">پیوستن به شرکت با کد دعوت — بدون نیاز به ایمیل</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>

            <button onClick={onBack} className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors">
              بازگشت به ورود
            </button>
          </div>
        )}

        {/* Manager registration */}
        {mode === "manager" && (
          <div className="rounded-xl border border-primary/30 bg-card p-6"
            style={{ boxShadow: "0 0 30px rgba(14,165,233,0.06)" }}>
            <div className="flex items-center gap-2 mb-5">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-foreground">ثبت شرکت جدید</span>
            </div>
            <form onSubmit={handleManagerRegister} className="space-y-3" dir="rtl">
              <div className="space-y-1">
                <label className={labelClass}>نام مدیر</label>
                <input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="نام و نام خانوادگی" className={commonInput} />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>نام شرکت / سازمان</label>
                <input value={mCompany} onChange={(e) => setMCompany(e.target.value)} placeholder="شرکت امنیتی آرک" className={commonInput} />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>ایمیل</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="email" value={mEmail} onChange={(e) => setMEmail(e.target.value)} placeholder="manager@company.com" className={commonInput + " pr-10"} />
                </div>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>رمز عبور (حداقل ۶ کاراکتر)</label>
                <div className="relative">
                  <input type={showPass ? "text" : "password"} value={mPass} onChange={(e) => setMPass(e.target.value)} placeholder="••••••••" className={commonInput + " pl-10"} />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setMode("choose"); setError(""); }}
                  className="px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">
                  بازگشت
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-60 transition-opacity">
                  {loading ? "در حال ثبت‌نام..." : "ایجاد حساب"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Guard registration — no email required */}
        {mode === "guard" && (
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-foreground">ثبت‌نام نگهبان</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-4">
              نیازی به ایمیل ندارید — فقط کد نگهبان، کد دعوت شرکت و یک PIN.
            </p>
            <form onSubmit={handleGuardRegister} className="space-y-3" dir="rtl">

              {/* Full name */}
              <div className="space-y-1">
                <label className={labelClass}>نام کامل</label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={gName}
                    onChange={(e) => setGName(e.target.value)}
                    placeholder="نام و نام خانوادگی"
                    className={commonInput + " pr-10"}
                  />
                </div>
              </div>

              {/* Guard code (employee number) */}
              <div className="space-y-1">
                <label className={labelClass}>کد نگهبان / شماره پرسنلی</label>
                <div className="relative">
                  <Hash className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={gGuardCode}
                    onChange={(e) => setGGuardCode(e.target.value.toUpperCase())}
                    placeholder="مثال: G001 یا پ-۱۲۳"
                    className={commonInput + " pr-10 font-mono tracking-wider"}
                    autoCapitalize="characters"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">این کد را از مدیر امنیت دریافت کنید. یکتا برای هر نگهبان.</p>
              </div>

              {/* Company invite code */}
              <div className="space-y-1">
                <label className={labelClass}>کد دعوت شرکت</label>
                <div className="relative">
                  <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={gInviteCode}
                    onChange={(e) => setGInviteCode(e.target.value.toUpperCase())}
                    placeholder="مثال: ARC-X9F2"
                    className={commonInput + " pr-10 font-mono tracking-widest"}
                    autoCapitalize="characters"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">این کد را از مدیر شرکت بگیرید.</p>
              </div>

              {/* PIN */}
              <div className="space-y-1">
                <label className={labelClass}>PIN (حداقل ۶ کاراکتر)</label>
                <div className="relative">
                  <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPass ? "text" : "password"}
                    value={gPin}
                    onChange={(e) => setGPin(e.target.value)}
                    placeholder="••••••"
                    autoComplete="new-password"
                    className={commonInput + " pr-10 pl-10"}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* PIN confirm */}
              <div className="space-y-1">
                <label className={labelClass}>تکرار PIN</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPass ? "text" : "password"}
                    value={gPinConfirm}
                    onChange={(e) => setGPinConfirm(e.target.value)}
                    placeholder="••••••"
                    autoComplete="new-password"
                    className={commonInput + " pr-10"}
                  />
                </div>
                {gPin && gPinConfirm && gPin === gPinConfirm && (
                  <p className="text-[10px] text-green-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />PIN مطابقت دارد
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setMode("choose"); setError(""); }}
                  className="px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">
                  بازگشت
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-60 transition-opacity">
                  {loading ? "در حال ثبت‌نام..." : "پیوستن به شرکت"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
