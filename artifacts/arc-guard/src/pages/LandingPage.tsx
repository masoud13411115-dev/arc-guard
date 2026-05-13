// __APP_FLAVOR__ is injected at build time via vite.config.ts define block.
// "manager" | "guard" | "" (web / unset)
declare const __APP_FLAVOR__: string;

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Shield, Building2, Copy, Check, ExternalLink, Info } from "lucide-react";
import arcGuardLogo from "/arc-guard-logo.png";
import { onAuthChange, getUserProfile } from "@/lib/auth";
import { isFirebaseReady } from "@/firebase";
import { useI18n } from "@/lib/i18n";
import LanguageSelector from "@/components/LanguageSelector";
import { Capacitor } from "@capacitor/core";

// ── Web-only: build a fully-qualified share link ─────────────────────────────
// Returns "" on native — we never want to display or navigate to
// "http://localhost./manager" inside the Android WebView.
function buildLink(suffix: string): string {
  if (Capacitor.isNativePlatform()) return "";
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${window.location.origin}${base}/${suffix}`;
}

// ── Copy-to-clipboard button (web only) ──────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
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
      title={t("common.copy")}
    >
      {copied
        ? <><Check className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">{t("common.copied")}</span></>
        : <><Copy className="w-3.5 h-3.5" />{t("common.copy")}</>}
    </button>
  );
}

// ── Native tap buttons (no URLs, no external links) ───────────────────────────
function NativeButtons({ navigate, t }: { navigate: (to: string) => void; t: (k: string) => string }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Manager button */}
      <button
        type="button"
        onClick={() => navigate("/manager")}
        className="w-full rounded-2xl border-2 border-primary/40 bg-primary/[0.08] hover:bg-primary/[0.15] active:bg-primary/[0.22] transition-colors overflow-hidden"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <div className="flex items-center gap-4 px-6 py-5">
          <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div className="text-right flex-1">
            <p className="text-[17px] font-bold text-foreground">{t("landing.manager.title")}</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">{t("landing.manager.sub")}</p>
          </div>
        </div>
      </button>

      {/* Guard button */}
      <button
        type="button"
        onClick={() => navigate("/guard")}
        className="w-full rounded-2xl border-2 border-green-500/40 bg-green-500/[0.06] hover:bg-green-500/[0.12] active:bg-green-500/[0.20] transition-colors overflow-hidden"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <div className="flex items-center gap-4 px-6 py-5">
          <div className="w-12 h-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6 text-green-400" />
          </div>
          <div className="text-right flex-1">
            <p className="text-[17px] font-bold text-foreground">{t("landing.guard.title")}</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">{t("landing.guard.sub")}</p>
          </div>
        </div>
      </button>
    </div>
  );
}

// ── Web link cards (with URL display + copy + external open) ──────────────────
function WebCards({
  managerLink, guardLink, t,
}: { managerLink: string; guardLink: string; t: (k: string) => string }) {
  return (
    <>
      {/* Manager link card */}
      <div className="rounded-2xl border-2 border-primary/25 bg-primary/[0.05] overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-primary/15">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-[16px] font-bold text-foreground">{t("landing.manager.title")}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">{t("landing.manager.sub")}</p>
          </div>
        </div>
        <div className="px-5 py-3 space-y-3">
          <p className="text-[12px] text-muted-foreground">{t("landing.manager.desc")}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[12px] font-mono text-primary bg-black/20 border border-primary/15 rounded-lg px-3 py-2 truncate select-all" dir="ltr">
              {managerLink}
            </code>
            <CopyButton text={managerLink} />
          </div>
          <a
            href={managerLink}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/30 text-[14px] font-bold text-primary transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            {t("landing.manager.btn")}
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
            <p className="text-[16px] font-bold text-foreground">{t("landing.guard.title")}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">{t("landing.guard.sub")}</p>
          </div>
        </div>
        <div className="px-5 py-3 space-y-3">
          <p className="text-[12px] text-muted-foreground">{t("landing.guard.desc")}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[12px] font-mono text-green-400 bg-black/20 border border-green-500/15 rounded-lg px-3 py-2 truncate select-all" dir="ltr">
              {guardLink}
            </code>
            <CopyButton text={guardLink} />
          </div>
          <a
            href={guardLink}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-green-500/15 hover:bg-green-500/25 border border-green-500/30 text-[14px] font-bold text-green-400 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            {t("landing.guard.btn")}
          </a>
        </div>
      </div>
    </>
  );
}

// ── Main landing page ─────────────────────────────────────────────────────────
export default function LandingPage() {
  const { t, dir } = useI18n();
  const [, navigate] = useLocation();
  const isNative = Capacitor.isNativePlatform();

  // ── Auto-navigate: APK flavor (native only) ─────────────────────────────────
  // Each APK is built with APP_FLAVOR=manager or APP_FLAVOR=guard baked in.
  // On first render, immediately navigate to the correct app without showing
  // the landing page chooser at all.
  useEffect(() => {
    if (!isNative) return;
    const flavor = __APP_FLAVOR__;
    if (flavor === "manager") { navigate("/manager"); return; }
    if (flavor === "guard")   { navigate("/guard");   return; }
  }, [isNative, navigate]);

  // ── Auto-navigate: already signed-in user ──────────────────────────────────
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

  // While the flavor useEffect fires and navigate runs, show a minimal spinner
  // so the user sees nothing jarring during the instant redirect.
  if (isNative && (__APP_FLAVOR__ === "manager" || __APP_FLAVOR__ === "guard")) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const managerLink = buildLink("manager");
  const guardLink   = buildLink("guard");

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center bg-background arc-grid-bg"
      dir={dir}
    >
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div
          className="w-[500px] h-[500px] rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle,rgba(14,165,233,1) 0%,transparent 65%)" }}
        />
      </div>

      <div
        className="relative w-full max-w-md mx-auto px-6 py-10 flex flex-col gap-8"
        style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* Language selector */}
        <div className="flex justify-end">
          <LanguageSelector variant="full" />
        </div>

        {/* Logo + title */}
        <div className="flex flex-col items-center gap-3">
          <img
            src={arcGuardLogo}
            alt="ARC Guard"
            className="w-20 h-20 object-contain"
            style={{ filter: "drop-shadow(0 0 20px rgba(14,165,233,.5))" }}
          />
          <div className="text-center">
            <h1 className="text-[28px] font-bold text-primary tracking-wider">{t("app.name")}</h1>
            <p className="text-[13px] text-muted-foreground mt-1">{t("app.saas")}</p>
          </div>
        </div>

        {/* Info notice */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-primary/[0.06] border border-primary/20">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[13px] text-muted-foreground leading-relaxed">{t("landing.info")}</p>
        </div>

        {/* Role chooser — tap buttons on native, link cards on web */}
        {isNative
          ? <NativeButtons navigate={navigate} t={t} />
          : <WebCards managerLink={managerLink} guardLink={guardLink} t={t} />
        }

        <p className="text-center text-[11px] text-muted-foreground/30 select-none">{t("app.version")}</p>
      </div>
    </div>
  );
}
