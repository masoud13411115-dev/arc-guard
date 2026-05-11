import { useEffect } from "react";
import { useLocation } from "wouter";
import { Shield, Building2, ChevronLeft } from "lucide-react";
import arcGuardLogo from "/arc-guard-logo.png";
import { onAuthChange, getUserProfile } from "@/lib/auth";
import { isFirebaseReady } from "@/firebase";

export default function LandingPage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isFirebaseReady) return;
    const unsub = onAuthChange(async (user) => {
      if (!user) return;
      try {
        const p = await getUserProfile(user.uid);
        if (!p) return;
        if (p.role === "guard") navigate("/guard");
        else navigate("/manager");
      } catch {}
    });
    return unsub;
  }, [navigate]);

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center bg-background arc-grid-bg"
      dir="rtl"
    >
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div
          className="w-[600px] h-[600px] rounded-full opacity-[0.08]"
          style={{ background: "radial-gradient(circle,rgba(14,165,233,1) 0%,transparent 65%)" }}
        />
      </div>

      <div className="relative w-full max-w-sm mx-auto px-6 flex flex-col items-center gap-8"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>

        {/* Logo + title */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full blur-2xl opacity-30"
              style={{ background: "radial-gradient(circle,rgba(14,165,233,.9) 0%,transparent 70%)" }}
            />
            <img
              src={arcGuardLogo}
              alt="ARC Guard"
              className="relative w-28 h-28 object-contain"
              style={{ filter: "drop-shadow(0 0 24px rgba(14,165,233,.6))" }}
            />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-primary tracking-wider">ARC Guard</h1>
            <p className="text-sm text-muted-foreground mt-1.5">سیستم هوشمند گشت امنیتی</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">پلتفرم SaaS چند-سازمانی</p>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground/50">ورود به سیستم</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Two big buttons */}
        <div className="w-full space-y-4">
          {/* Manager button */}
          <button
            onClick={() => navigate("/manager")}
            className="group w-full flex items-center justify-between px-6 py-5 rounded-2xl border-2 border-primary/30 bg-primary/[0.06] hover:bg-primary/[0.12] hover:border-primary/60 transition-all duration-200 active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                <Building2 className="w-7 h-7 text-primary" />
              </div>
              <div className="text-right">
                <p className="text-[18px] font-bold text-foreground">ورود مدیر</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">داشبورد · ایستگاه‌ها · گزارش‌ها</p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-primary/60 group-hover:text-primary transition-colors" />
          </button>

          {/* Guard button */}
          <button
            onClick={() => navigate("/guard")}
            className="group w-full flex items-center justify-between px-6 py-5 rounded-2xl border-2 border-green-500/30 bg-green-500/[0.05] hover:bg-green-500/[0.10] hover:border-green-500/60 transition-all duration-200 active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-green-500/15 border border-green-500/30 flex items-center justify-center group-hover:bg-green-500/25 transition-colors">
                <Shield className="w-7 h-7 text-green-400" />
              </div>
              <div className="text-right">
                <p className="text-[18px] font-bold text-foreground">ورود نگهبان</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">اسکن ایستگاه · SOS · گزارش گشت</p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-green-400/60 group-hover:text-green-400 transition-colors" />
          </button>
        </div>

        {/* Footer */}
        <p className="text-[11px] text-muted-foreground/30 select-none mt-2">
          ARC Guard v3.0 · SaaS Multi-Tenant
        </p>
      </div>
    </div>
  );
}
