import { useState } from "react";
import { Shield, Building2, User, Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle, AlertCircle } from "lucide-react";
import arcGuardLogo from "/arc-guard-logo.png";
import { registerManager, registerGuard, getUserProfile } from "@/lib/auth";
import { signIn } from "@/lib/auth";
import { db } from "@/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
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
  const [mEmail, setMEmail] = useState("");
  const [mPass, setMPass] = useState("");
  const [mName, setMName] = useState("");
  const [mCompany, setMCompany] = useState("");

  // Guard form
  const [gEmail, setGEmail] = useState("");
  const [gPass, setGPass] = useState("");
  const [gName, setGName] = useState("");
  const [gCode, setGCode] = useState(""); // company invitation code

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
    if (!gEmail || !gPass || !gName || !gCode) { setError("همه فیلدها الزامی است."); return; }
    if (gPass.length < 6) { setError("رمز عبور باید حداقل ۶ کاراکتر باشد."); return; }
    setLoading(true);
    try {
      if (!db) throw new Error("Firebase پیکربندی نشده");

      // Find company by invitation code
      const snap = await getDocs(query(collection(db, 'companies'), where('inviteCode', '==', gCode.trim().toUpperCase())));
      if (snap.empty) {
        setError("کد دعوت نامعتبر است. این کد را از مدیر شرکت بگیرید.");
        return;
      }
      const companyDoc = snap.docs[0];
      const companyData = companyDoc.data();

      const profile = await registerGuard(
        gEmail.trim(), gPass, gName.trim(),
        companyDoc.id, companyData.name, gCode.trim().toUpperCase()
      );
      onComplete(profile);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/email-already-in-use") setError("این ایمیل قبلاً ثبت شده است.");
      else if (code === "auth/weak-password") setError("رمز عبور بسیار ضعیف است.");
      else setError("خطا: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const commonInput = "w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors";
  const labelClass = "text-xs text-muted-foreground tracking-wide";

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-background arc-grid-bg">
      <div className="absolute top-5 left-5 w-7 h-7 border-l-2 border-t-2 border-primary opacity-30" />
      <div className="absolute top-5 right-5 w-7 h-7 border-r-2 border-t-2 border-primary opacity-30" />
      <div className="absolute bottom-5 left-5 w-7 h-7 border-l-2 border-b-2 border-primary opacity-30" />
      <div className="absolute bottom-5 right-5 w-7 h-7 border-r-2 border-b-2 border-primary opacity-30" />

      <div className="relative z-10 w-full max-w-sm mx-auto px-6 animate-fade-in-up">
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
                <p className="text-xs text-muted-foreground mt-0.5">پیوستن به شرکت با کد دعوت</p>
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
                <input type="email" value={mEmail} onChange={(e) => setMEmail(e.target.value)} placeholder="manager@company.com" className={commonInput} />
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

        {/* Guard registration */}
        {mode === "guard" && (
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <User className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-foreground">ثبت‌نام نگهبان</span>
            </div>
            <form onSubmit={handleGuardRegister} className="space-y-3" dir="rtl">
              <div className="space-y-1">
                <label className={labelClass}>نام کامل</label>
                <input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="نام و نام خانوادگی" className={commonInput} />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>ایمیل</label>
                <input type="email" value={gEmail} onChange={(e) => setGEmail(e.target.value)} placeholder="guard@company.com" className={commonInput} />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>رمز عبور</label>
                <div className="relative">
                  <input type={showPass ? "text" : "password"} value={gPass} onChange={(e) => setGPass(e.target.value)} placeholder="••••••••" className={commonInput + " pl-10"} />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>کد دعوت شرکت</label>
                <input value={gCode} onChange={(e) => setGCode(e.target.value.toUpperCase())}
                  placeholder="مثال: ARC-X9F2" className={commonInput + " font-mono tracking-widest"} />
                <p className="text-[10px] text-muted-foreground">این کد را از مدیر امنیت شرکت خود دریافت کنید.</p>
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
