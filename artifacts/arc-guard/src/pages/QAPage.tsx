import { useState } from "react";
import { useLocation } from "wouter";
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp,
  ArrowLeft, Shield, Wifi, WifiOff, QrCode,
  Globe, Monitor, Smartphone, AlertTriangle,
  Database, Radio,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { isFirebaseReady } from "@/firebase";
import arcGuardLogo from "/arc-guard-logo.png";

interface CheckItem {
  id: string;
  label: string;
  detail: string;
  category: string;
  critical: boolean;
}

const CATEGORIES = [
  { id: "routing",  label: "Routing & Auth",      icon: Monitor },
  { id: "firebase", label: "Firebase",             icon: Database },
  { id: "scan",     label: "QR & SOS",             icon: QrCode },
  { id: "i18n",     label: "All 4 Languages",      icon: Globe },
  { id: "mobile",   label: "Mobile / iPhone UI",   icon: Smartphone },
  { id: "offline",  label: "Offline / Network",    icon: Wifi },
];

const CHECKS: CheckItem[] = [
  // Routing
  { id: "route-manager", label: "Manager route loads (/manager)", detail: "Navigate to /arc-guard/manager — login page should appear with two tabs (Manager/Admin | Guard)", category: "routing", critical: true },
  { id: "route-guard",   label: "Guard route loads (/guard)",     detail: "Navigate to /arc-guard/guard — login page should appear with Guard tab preselected", category: "routing", critical: true },
  { id: "route-qa",      label: "QA page loads (/qa)",            detail: "This page is loading, so routing works ✓", category: "routing", critical: false },

  // Firebase
  { id: "fb-read",   label: "Firebase read — login works",         detail: "Log in as a manager — profile and checkpoints load from Firestore", category: "firebase", critical: true },
  { id: "fb-write",  label: "Firebase write — SOS saves",          detail: "As a guard, hold the SOS button 3s — the alert should appear in manager Dashboard → Alerts tab in real-time", category: "firebase", critical: true },
  { id: "fb-status", label: "Firebase status dot is green",        detail: "The green/yellow dot on the login page footer should be green, indicating Firebase is connected", category: "firebase", critical: true },
  { id: "fb-realtime", label: "Alerts listener — real-time update", detail: "Send SOS as guard and watch manager Dashboard: the alert badge and bell should update without page refresh", category: "firebase", critical: true },

  // QR & SOS
  { id: "qr-camera",  label: "QR camera opens on tap",            detail: "Guard app: tap the large scan button — camera overlay should open with a viewfinder", category: "scan", critical: true },
  { id: "qr-scan",    label: "QR scan processes correctly",        detail: "Scan a valid ARC Guard QR (ARCG|companyId|checkpointId) — green success overlay should appear with distance", category: "scan", critical: true },
  { id: "sos-hold",   label: "SOS hold-to-activate (3s)",          detail: "Hold SOS button 3 seconds — red fill progress should animate, then send", category: "scan", critical: true },
  { id: "sos-result", label: "SOS success confirmation",           detail: "After 3s hold: green 'Emergency sent' state OR red error shown, no silent failure", category: "scan", critical: true },

  // i18n
  { id: "lang-fa",   label: "Persian (فارسی) — RTL layout",       detail: "Select FA: text is right-to-left, Vazirmatn font, all strings in Persian", category: "i18n", critical: true },
  { id: "lang-en",   label: "English — LTR layout",               detail: "Select EN: layout flips to left-to-right, all strings in English", category: "i18n", critical: true },
  { id: "lang-tr",   label: "Turkish (Türkçe) — LTR layout",      detail: "Select TR: layout LTR, all strings in Turkish", category: "i18n", critical: false },
  { id: "lang-zh",   label: "Chinese 中文 — LTR layout",           detail: "Select ZH-CN: layout LTR, all strings in Chinese", category: "i18n", critical: false },
  { id: "lang-persist", label: "Language persists on refresh",     detail: "Select a language, hard-refresh — should still show the selected language", category: "i18n", critical: false },

  // Mobile UI
  { id: "mobile-guard",   label: "Guard screen fits iPhone SE (375px)", detail: "On 375px viewport: scan button visible, SOS button accessible, no horizontal scroll", category: "mobile", critical: true },
  { id: "mobile-manager", label: "Manager tab bar scrollable on mobile", detail: "On mobile: tab bar scrolls horizontally to reveal all tabs, no clipping", category: "mobile", critical: true },
  { id: "mobile-sidebar", label: "Sidebar opens/closes on mobile",       detail: "Tap the menu icon in MobileHeader — sidebar slides in from left, tap backdrop to close", category: "mobile", critical: false },
  { id: "mobile-safearea", label: "No content hidden behind browser chrome", detail: "On iPhone: check that header and bottom content are not under the browser toolbar", category: "mobile", critical: false },

  // Offline
  { id: "offline-banner",  label: "Offline banner appears",         detail: "Disable network (DevTools → Network → Offline) — red banner 'Connection lost' should appear at top", category: "offline", critical: false },
  { id: "offline-queue",   label: "QR scans queue while offline",   detail: "Scan a checkpoint while offline — yellow badge shows pending count, no crash", category: "offline", critical: false },
  { id: "offline-sync",    label: "Queue auto-syncs on reconnect",  detail: "Re-enable network — yellow syncing banner appears, then queued scans are uploaded", category: "offline", critical: false },

  // Console
  { id: "console-clean", label: "No red console errors on load",   detail: "Open DevTools → Console, reload the page — no uncaught errors (warnings OK)", category: "firebase", critical: true },
];

export default function QAPage() {
  useI18n();
  const [, navigate] = useLocation();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openCat, setOpenCat] = useState<string | null>(null);

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleDetail = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const total    = CHECKS.length;
  const done     = checked.size;
  const critical = CHECKS.filter((c) => c.critical);
  const critDone = critical.filter((c) => checked.has(c.id)).length;
  const pct      = Math.round((done / total) * 100);

  return (
    <div className="min-h-screen bg-background" dir="ltr" style={{ fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-muted hover:bg-accent transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <img src={arcGuardLogo} alt="ARC Guard" className="w-7 h-7 object-contain shrink-0"
          style={{ filter: "drop-shadow(0 0 8px rgba(14,165,233,0.5))" }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-primary tracking-wider">ARC Guard — QA Checklist</p>
          <p className="text-[10px] text-muted-foreground">v3.0 Stable Release · {new Date().toLocaleDateString("en-US")}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-bold text-foreground">{done}/{total}</p>
          <p className="text-[10px] text-muted-foreground">{pct}%</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

        {/* Progress bar */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-foreground">Overall Progress</p>
            <p className="text-sm font-bold text-primary">{pct}%</p>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-lg font-bold text-foreground">{done}</p>
              <p className="text-muted-foreground">Checked</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-lg font-bold text-foreground">{total - done}</p>
              <p className="text-muted-foreground">Remaining</p>
            </div>
            <div className={`rounded-lg p-2 ${critDone === critical.length ? "bg-green-500/10" : "bg-red-500/10"}`}>
              <p className={`text-lg font-bold ${critDone === critical.length ? "text-green-400" : "text-red-400"}`}>{critDone}/{critical.length}</p>
              <p className="text-muted-foreground">Critical</p>
            </div>
          </div>
        </div>

        {/* Firebase status */}
        <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
          isFirebaseReady
            ? "border-green-500/30 bg-green-500/8"
            : "border-yellow-500/30 bg-yellow-500/8"
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full ${isFirebaseReady ? "bg-green-400" : "bg-yellow-400 animate-pulse"}`} />
          <Database className={`w-4 h-4 ${isFirebaseReady ? "text-green-400" : "text-yellow-400"}`} />
          <p className={`text-sm font-semibold ${isFirebaseReady ? "text-green-400" : "text-yellow-400"}`}>
            Firebase: {isFirebaseReady ? "Connected ✓" : "Not configured — add VITE_ARC_GUARD_* secrets"}
          </p>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={`${import.meta.env.BASE_URL}manager`}
            className="rounded-xl border border-primary/30 bg-primary/8 px-4 py-3 flex items-center gap-2 hover:bg-primary/15 transition-colors"
          >
            <Shield className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-xs font-bold text-primary">Manager Panel</p>
              <p className="text-[10px] text-muted-foreground">/manager</p>
            </div>
          </a>
          <a
            href={`${import.meta.env.BASE_URL}guard`}
            className="rounded-xl border border-green-500/30 bg-green-500/8 px-4 py-3 flex items-center gap-2 hover:bg-green-500/15 transition-colors"
          >
            <Radio className="w-4 h-4 text-green-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-green-400">Guard App</p>
              <p className="text-[10px] text-muted-foreground">/guard</p>
            </div>
          </a>
        </div>

        {/* Categories */}
        {CATEGORIES.map(({ id: catId, label: catLabel, icon: CatIcon }) => {
          const catChecks = CHECKS.filter((c) => c.category === catId);
          const catDone   = catChecks.filter((c) => checked.has(c.id)).length;
          const allDone   = catDone === catChecks.length;
          const isOpen    = openCat === catId;

          return (
            <div key={catId} className="rounded-2xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setOpenCat(isOpen ? null : catId)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-accent/50 transition-colors"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${allDone ? "bg-green-500/15" : "bg-muted"}`}>
                  <CatIcon className={`w-4 h-4 ${allDone ? "text-green-400" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-foreground">{catLabel}</p>
                  <p className="text-[11px] text-muted-foreground">{catDone}/{catChecks.length} checked</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {allDone && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border divide-y divide-border/50">
                  {catChecks.map((item) => {
                    const isDone    = checked.has(item.id);
                    const isExpanded = expanded.has(item.id);
                    return (
                      <div key={item.id} className={`px-4 py-3 transition-colors ${isDone ? "bg-green-500/[0.04]" : ""}`}>
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggle(item.id)}
                            className="mt-0.5 shrink-0"
                          >
                            {isDone
                              ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                              : <Circle className="w-5 h-5 text-muted-foreground/40" />
                            }
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-medium leading-snug ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                {item.label}
                              </p>
                              {item.critical && !isDone && (
                                <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                                  CRITICAL
                                </span>
                              )}
                            </div>
                            {isExpanded && (
                              <p className="mt-1.5 text-[12px] text-muted-foreground leading-relaxed">{item.detail}</p>
                            )}
                          </div>
                          <button
                            onClick={() => toggleDetail(item.id)}
                            className="shrink-0 mt-0.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                          >
                            {isExpanded
                              ? <ChevronUp className="w-4 h-4" />
                              : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* All done banner */}
        {done === total && (
          <div className="rounded-2xl border-2 border-green-500 bg-green-500/10 p-6 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-400" />
            <p className="text-xl font-bold text-green-400">All checks passed!</p>
            <p className="text-sm text-green-300/70">ARC Guard v3.0 is ready for stable release.</p>
          </div>
        )}

        {/* Critical warning */}
        {critDone < critical.length && done > 0 && (
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/8 p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
            <p className="text-sm text-orange-300">
              {critical.length - critDone} critical check{critical.length - critDone !== 1 ? "s" : ""} remaining before release.
            </p>
          </div>
        )}

        {/* Reset */}
        {done > 0 && (
          <button
            onClick={() => setChecked(new Set())}
            className="w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Reset all checks
          </button>
        )}

        <p className="text-center text-[11px] text-muted-foreground/30 pb-4">ARC Guard v3.0 · QA Checklist</p>
      </div>
    </div>
  );
}
