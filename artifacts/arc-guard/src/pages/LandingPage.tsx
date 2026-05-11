import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Shield, Building2, Copy, Check, ExternalLink, Info } from "lucide-react";
import arcGuardLogo from "/arc-guard-logo.png";
import { onAuthChange, getUserProfile } from "@/lib/auth";
import { isFirebaseReady } from "@/firebase";

function buildLink(suffix: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${window.location.origin}${base}/${suffix}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-[12px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
      title="کپی لینک"
    >
      {copied
        ? <><Check className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">کپی شد</span></>
        : <><Copy className="w-3.5 h-3.5" />کپی</>}
    </button>
  );
}

export default function LandingPage() {
  const [, navigate] = useLocation();

  // Auto-redirect if already logged in
  useEffect(() => {
    if (!isFirebaseReady) return;
    const unsub = onAuthChange(async (user) => {
      if (!user) return;
      try {
        const p = await getUserProfile(user.uid);
        if (!p) return;
        navigate(p.role === "guard" ? "/guard" : "/manager");
      } catch {}
    });
    return unsub;
  }, [navigate]);

  const managerLink = buildLink("manager");
  const guardLink   = buildLink("guard");

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background arc-grid-bg" dir="rtl">

      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div className="w-[500px] h-[500px] rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle,rgba(14,165,233,1) 0%,transparent 65%)" }} />
      </div>

      <div className="relative w-full max-w-md mx-auto px-6 py-10 flex flex-col gap-8"
        style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}>

        {/* Logo + title */}
        <div className="flex flex-col items-center gap-3">
          <img src={arcGuardLogo} alt="ARC Guard"
            className="w-20 h-20 object-contain"
            style={{ filter: "drop-shadow(0 0 20px rgba(14,165,233,.5))" }} />
          <div className="text-center">
            <h1 className="text-[28px] font-bold text-primary tracking-wider">ARC Guard</h1>
            <p className="text-[13px] text-muted-foreground mt-1">سیستم هوشمند گشت امنیتی · پلتفرم SaaS</p>
          </div>
        </div>

        {/* Info notice */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-primary/[0.06] border border-primary/20">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            این سیستم دارای دو اپلیکیشن جداگانه است.
            هر کدام را به‌عنوان لینک مستقل ذخیره یا با کارکنان به اشتراک بگذارید.
          </p>
        </div>

        {/* Manager link card */}
        <div className="rounded-2xl border-2 border-primary/25 bg-primary/[0.05] overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-primary/15">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[16px] font-bold text-foreground">پنل مدیر</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">داشبورد · ایستگاه‌ها · گزارش‌ها · هشدارها</p>
            </div>
          </div>

          <div className="px-5 py-3 space-y-3">
            <p className="text-[12px] text-muted-foreground">
              برای ورود مدیر به آدرس زیر بروید:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[12px] font-mono text-primary bg-black/20 border border-primary/15 rounded-lg px-3 py-2 truncate select-all">
                {managerLink}
              </code>
              <CopyButton text={managerLink} />
            </div>
            <a
              href={managerLink}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/30 text-[14px] font-bold text-primary transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              ورود به پنل مدیر
            </a>
          </div>
        </div>

        {/* Guard link card */}
        <div className="rounded-2xl border-2 border-green-500/25 bg-green-500/[0.04] overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-green-500/15">
            <div className="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-[16px] font-bold text-foreground">اپ نگهبان</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">اسکن ایستگاه · SOS · گزارش گشت</p>
            </div>
          </div>

          <div className="px-5 py-3 space-y-3">
            <p className="text-[12px] text-muted-foreground">
              برای ورود نگهبان به آدرس زیر بروید:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[12px] font-mono text-green-400 bg-black/20 border border-green-500/15 rounded-lg px-3 py-2 truncate select-all">
                {guardLink}
              </code>
              <CopyButton text={guardLink} />
            </div>
            <a
              href={guardLink}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-green-500/15 hover:bg-green-500/25 border border-green-500/30 text-[14px] font-bold text-green-400 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              ورود به اپ نگهبان
            </a>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/30 select-none">
          ARC Guard v3.0 · SaaS Multi-Tenant
        </p>
      </div>
    </div>
  );
}
