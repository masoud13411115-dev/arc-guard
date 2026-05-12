import { useState, useEffect, type ReactNode } from "react";
import {
  Database, Cloud, Server, CheckCircle, XCircle, Clock,
  RefreshCw, Wifi, WifiOff, Terminal, Info, Bell,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getAdapterMode } from "@/lib/adapter";
import { isFirebaseReady } from "@/firebase";
import type { FcmDiagState } from "@/lib/fcm";

// ── Sub-components defined at module level to avoid reconciliation issues ──────

function Section({
  title, icon: Icon, children,
}: { title: string; icon: React.ElementType; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
        <Icon className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm font-bold text-foreground">{title}</span>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

type RowOk = true | false | "warn" | null;

function DiagRow({
  label, value, ok, mono = false,
}: { label: string; value: string; ok?: RowOk; mono?: boolean }) {
  const icon =
    ok === true  ? <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />  :
    ok === false ? <XCircle     className="w-3.5 h-3.5 text-red-400   shrink-0" />  :
    ok === "warn"? <Clock       className="w-3.5 h-3.5 text-amber-400 shrink-0" />  :
    null;

  const valCls =
    ok === true  ? "text-green-400"  :
    ok === false ? "text-red-400"    :
    ok === "warn"? "text-amber-400"  :
    "text-foreground";

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground flex-1 truncate">{label}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        {icon}
        <span className={`text-xs font-semibold ${mono ? "font-mono" : ""} ${valCls}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface DiagnosticsPageProps {
  fcm?: FcmDiagState;
}

export default function DiagnosticsPage({ fcm }: DiagnosticsPageProps) {
  const { t } = useI18n();
  const [mode]   = useState(getAdapterMode);
  const [fbReady]= useState(() => isFirebaseReady);
  const [tick, setTick] = useState(0);

  // Auto-refresh label every 10 s
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const isCloud   = mode === "firebase";
  const localStub = !isCloud;

  // FCM permission label
  const permLabel =
    !fcm ? "—" :
    fcm.permission === "granted" ? t("notif.granted") :
    fcm.permission === "denied"  ? t("notif.denied")  :
    fcm.permission === "default" ? t("notif.default") :
    "unsupported";

  const permOk: RowOk =
    !fcm ? null :
    fcm.permission === "granted" ? true :
    fcm.permission === "denied"  ? false :
    "warn";

  return (
    <div className="max-w-2xl animate-fade-in-up space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h2 className="text-lg font-bold text-foreground">{t("diag.title")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t("diag.sub")}</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40 font-mono select-none" title="auto-refreshes every 10s">
          <RefreshCw className={`w-3 h-3 ${tick > 0 ? "animate-spin" : ""}`} style={{ animationDuration: "0.6s", animationIterationCount: 1 }} />
          {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* ── Adapter ── */}
      <Section title={t("diag.adapter.section")} icon={Database}>
        <DiagRow
          label={t("adapter.status.mode")}
          value={isCloud ? t("diag.mode.cloud") : t("diag.mode.local")}
        />
        <DiagRow
          label={t("adapter.status.adapter")}
          value={isCloud ? "firebaseAdapter" : "localAdapter (Phase 1 stub)"}
          mono
        />
        <DiagRow
          label={t("diag.adapter.phase")}
          value={isCloud ? "Production" : t("adapter.phase1")}
          ok={isCloud ? true : "warn"}
        />
        <DiagRow
          label="localStorage key"
          value="arc_guard_adapter_mode"
          mono
        />
      </Section>

      {/* ── Firebase ── */}
      <Section
        title={t("diag.firebase.section")}
        icon={isCloud && fbReady ? Wifi : WifiOff}
      >
        <DiagRow
          label={t("diag.firebase.status")}
          value={fbReady ? t("diag.firebase.connected") : t("diag.firebase.disconnected")}
          ok={fbReady}
        />
        <DiagRow
          label={t("diag.adapter.active")}
          value={isCloud ? t("common.yes") : t("common.no")}
          ok={isCloud}
        />
        <DiagRow label="SDK"   value="firebase/firestore v10" mono />
        <DiagRow label="Cache" value="multi-tab persistent"   mono />
        <DiagRow label="Auth"  value="Firebase Auth (always)" mono ok={true} />
      </Section>

      {/* ── FCM Push Notifications ── */}
      <Section title={t("push.fcm.section")} icon={Bell}>
        {/* Browser support row — most important, shown first */}
        <DiagRow
          label={t("push.fcm.browser.support")}
          value={
            !fcm ? "—"
            : fcm.fcmSupported ? t("push.fcm.browser.yes")
            : t("push.fcm.browser.no")
          }
          ok={!fcm ? null : fcm.fcmSupported ? true : false}
        />

        {/* When unsupported, show a helpful callout and skip the rest */}
        {fcm && !fcm.fcmSupported && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/8 border border-red-500/20">
            <Info className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-300/80 leading-relaxed">{t("push.fcm.browser.fallback")}</p>
          </div>
        )}

        {/* PWA + background push rows — always shown when FCM is supported */}
        {(!fcm || fcm.fcmSupported) && (
          <>
            <DiagRow
              label={t("push.pwa.status")}
              value={
                !fcm ? "—"
                : fcm.pwaInstalled ? t("push.pwa.installed")
                : t("push.pwa.not.installed")
              }
              ok={!fcm ? null : fcm.pwaInstalled ? true : "warn"}
            />
            <DiagRow
              label={t("push.bg.handler")}
              value={
                !fcm ? "—"
                : fcm.bgPushActive ? t("push.bg.active")
                : t("push.bg.inactive")
              }
              ok={!fcm ? null : fcm.bgPushActive ? true : false}
            />

            {/* iOS not installed warning */}
            {fcm?.iosDevice && !fcm.pwaInstalled && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/20">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-300/80 leading-relaxed">{t("push.ios.bg.unsupported")}</p>
              </div>
            )}

            <DiagRow
              label={t("push.permission")}
              value={permLabel}
              ok={permOk}
            />
            <DiagRow
              label={t("push.sw.status")}
              value={!fcm ? "—" : fcm.swActive ? t("push.sw.active") : t("push.sw.inactive")}
              ok={!fcm ? null : fcm.swActive ? true : false}
            />
            <DiagRow
              label={t("push.vapid.key")}
              value={!fcm ? "—" : fcm.vapidSet ? t("push.vapid.set") : t("push.vapid.missing")}
              ok={!fcm ? null : fcm.vapidSet ? true : "warn"}
            />
            <DiagRow
              label={t("push.token.status")}
              value={!fcm ? "—" : fcm.tokenSaved ? t("push.token.saved") : t("push.token.missing")}
              ok={!fcm ? null : fcm.tokenSaved ? true : fcm.vapidSet ? false : "warn"}
            />
            {fcm?.tokenHint && (
              <DiagRow label={t("push.token.hint")} value={fcm.tokenHint} mono />
            )}
            {fcm && !fcm.vapidSet && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/20">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-300/80 leading-relaxed">{t("push.fcm.info")}</p>
              </div>
            )}
          </>
        )}

        <DiagRow label="SW path"       value="/arc-guard/firebase-messaging-sw.js" mono />
        <DiagRow label="Firestore path" value="companies/{id}/fcmTokens/{uid}"     mono />
      </Section>

      {/* ── Local server ── */}
      <Section title={t("diag.local.section")} icon={Server}>
        <DiagRow
          label={t("diag.local.status")}
          value={t("diag.local.available")}
          ok="warn"
        />
        <DiagRow
          label={t("diag.adapter.active")}
          value={localStub ? t("common.yes") : t("common.no")}
          ok={localStub}
        />
        <DiagRow label="Phase"    value="Phase 2 — not implemented" mono ok="warn" />
        <DiagRow label="Protocol" value="REST + WebSocket (planned)" mono />
      </Section>

      {/* ── Info note ── */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl border border-primary/20 bg-primary/5">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-semibold text-primary">{t("diag.note.title")}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{t("diag.note.body")}</p>
        </div>
      </div>

      {/* ── DEV only: raw adapter mode value ── */}
      {import.meta.env.DEV && (
        <div className="rounded-xl border border-white/10 bg-black/60 p-3 font-mono text-[11px] space-y-1" dir="ltr">
          <div className="text-white/30 mb-1 flex items-center gap-2">
            <Terminal className="w-3 h-3" /> DEV only
          </div>
          {[
            ["mode",              mode],
            ["firebaseReady",     String(fbReady)],
            ["isCloud",           String(isCloud)],
            ["tick",              String(tick)],
            ["fcm.fcmSupported",  String(fcm?.fcmSupported ?? "—")],
            ["fcm.pwaInstalled",  String(fcm?.pwaInstalled ?? "—")],
            ["fcm.bgPushActive",  String(fcm?.bgPushActive ?? "—")],
            ["fcm.iosDevice",     String(fcm?.iosDevice    ?? "—")],
            ["fcm.swActive",      String(fcm?.swActive     ?? "—")],
            ["fcm.tokenSaved",    String(fcm?.tokenSaved   ?? "—")],
            ["fcm.vapidSet",      String(fcm?.vapidSet     ?? "—")],
            ["fcm.permission",    fcm?.permission          ?? "—"],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <span className="text-white/30 w-28 shrink-0">{k}</span>
              <span className="text-primary/80 break-all">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
