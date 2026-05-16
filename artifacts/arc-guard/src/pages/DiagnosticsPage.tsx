import { useState, useEffect, useCallback, type ReactNode } from "react";
import {
  Database, Cloud, Server, CheckCircle, XCircle, Clock,
  RefreshCw, Wifi, WifiOff, Terminal, Info, Bell, Activity,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getAdapterMode } from "@/lib/adapter";
import { isFirebaseReady } from "@/firebase";
import {
  getDBQueueCount, getDeadLetterCount, estimateLocalDBSize,
} from "@/lib/localDB";
import {
  getLastSyncAt, getTransitionLog, type TransitionEntry,
} from "@/lib/syncManager";
import {
  getLocalServerUrl, testLocalServerConnection, getCachedLocalServerHealth,
} from "@/lib/adapter/localAdapter";
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

function fmtAgo(ts: number | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - ts;
  const m    = Math.floor(diff / 60_000);
  const h    = Math.floor(m / 60);
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

function eventColor(e: TransitionEntry["event"]): string {
  if (e === "item_ok"   || e === "sync_ok")   return "text-green-400";
  if (e === "item_dead" || e === "sync_failed") return "text-red-400";
  if (e === "item_failed")                    return "text-orange-400";
  if (e === "online")                         return "text-green-400";
  if (e === "offline")                        return "text-red-400";
  return "text-muted-foreground";
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface DiagnosticsPageProps {
  companyId?: string;
  fcm?: FcmDiagState;
}

export default function DiagnosticsPage({ companyId, fcm }: DiagnosticsPageProps) {
  const { t } = useI18n();
  const [mode]   = useState(getAdapterMode);
  const [fbReady]= useState(() => isFirebaseReady);
  const [tick, setTick] = useState(0);

  // Sync diagnostics state
  const [pendingCount,    setPendingCount]    = useState(0);
  const [deadCount,       setDeadCount]       = useState(0);
  const [dbSize,          setDbSize]          = useState("—");
  const [lastSync,        setLastSync]        = useState<number | null>(null);
  const [transitionLog,   setTransitionLog]   = useState<TransitionEntry[]>([]);
  const [localServerOk,   setLocalServerOk]   = useState<boolean | null>(null);
  const [localServerUrl,  setLocalServerUrl]  = useState("");
  const [testingServer,   setTestingServer]   = useState(false);

  const isCloud   = mode === "firebase";
  const isLocal   = mode === "local";

  const refreshSyncState = useCallback(async () => {
    const cid = companyId;
    const [pCount, dCount, size] = await Promise.all([
      getDBQueueCount(cid),
      getDeadLetterCount(cid),
      estimateLocalDBSize(),
    ]);
    setPendingCount(pCount);
    setDeadCount(dCount);
    setDbSize(size.formatted);
    setLastSync(cid ? getLastSyncAt(cid) : null);
    setTransitionLog(getTransitionLog().slice(0, 10));
    setLocalServerUrl(getLocalServerUrl());
    setLocalServerOk(getCachedLocalServerHealth());
  }, [companyId]);

  // Auto-refresh every 10s
  useEffect(() => {
    const id = setInterval(() => {
      setTick((n) => n + 1);
      refreshSyncState().catch(console.error);
    }, 10_000);
    return () => clearInterval(id);
  }, [refreshSyncState]);

  // Load on mount
  useEffect(() => {
    refreshSyncState().catch(console.error);
  }, [refreshSyncState]);

  const handleTestLocalServer = async () => {
    setTestingServer(true);
    try {
      const ok = await testLocalServerConnection();
      setLocalServerOk(ok);
    } finally {
      setTestingServer(false);
    }
  };

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

      {/* ── Sync diagnostics ── */}
      <Section title={t("diag.sync.section")} icon={Activity}>
        <DiagRow
          label={t("diag.sync.pending")}
          value={String(pendingCount)}
          ok={pendingCount === 0 ? true : "warn"}
        />
        <DiagRow
          label={t("diag.sync.dead")}
          value={String(deadCount)}
          ok={deadCount === 0 ? true : false}
        />
        <DiagRow
          label={t("diag.sync.last")}
          value={fmtAgo(lastSync)}
          ok={lastSync ? true : null}
        />
        <DiagRow
          label={t("diag.sync.db.size")}
          value={dbSize}
          mono
        />
        <DiagRow
          label="Retry policy"
          value="2s → 4s → 8s → 16s → 32s → 64s (6 max)"
          mono
        />
        <DiagRow label="Idempotency" value="30s bucket keyed" mono ok={true} />

        {/* Transition log */}
        {transitionLog.length > 0 && (
          <div className="mt-2 rounded-lg border border-border bg-muted/10 overflow-hidden">
            <p className="text-[10px] text-muted-foreground px-3 py-1.5 border-b border-border font-semibold">
              {t("diag.sync.log")} (last {transitionLog.length})
            </p>
            <div className="divide-y divide-border max-h-40 overflow-y-auto" dir="ltr">
              {transitionLog.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1 text-[10px]">
                  <span className="text-muted-foreground/40 font-mono w-12 shrink-0 text-right">
                    {Math.floor((Date.now() - entry.ts) / 60_000)}m
                  </span>
                  <span className={`font-mono font-semibold w-24 shrink-0 ${eventColor(entry.event)}`}>
                    {entry.event}
                  </span>
                  <span className="text-muted-foreground/60 truncate">{entry.detail ?? ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ── Adapter ── */}
      <Section title={t("diag.adapter.section")} icon={Database}>
        <DiagRow
          label={t("adapter.status.mode")}
          value={mode}
          mono
        />
        <DiagRow
          label={t("adapter.status.adapter")}
          value={isCloud ? "firebaseAdapter" : isLocal ? "localAdapter" : "indexeddbAdapter"}
          mono
        />
        <DiagRow
          label={t("diag.adapter.phase")}
          value={isCloud ? "Cloud / Production" : isLocal ? "Local Server" : "Offline / IndexedDB"}
          ok={isCloud ? true : "warn"}
        />
        <DiagRow label="localStorage key" value="arc_guard_adapter_mode" mono />
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
        <DiagRow
          label={t("push.fcm.browser.support")}
          value={
            !fcm ? "—"
            : fcm.fcmSupported ? t("push.fcm.browser.yes")
            : t("push.fcm.browser.no")
          }
          ok={!fcm ? null : fcm.fcmSupported ? true : false}
        />
        {fcm && !fcm.fcmSupported && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/8 border border-red-500/20">
            <Info className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-300/80 leading-relaxed">{t("push.bg.unsupported.msg")}</p>
          </div>
        )}
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
            {fcm?.iosDevice && !fcm.pwaInstalled && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/20">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-300/80 leading-relaxed">{t("push.ios.bg.unsupported")}</p>
              </div>
            )}
            <DiagRow label={t("push.permission")} value={permLabel} ok={permOk} />
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
          value={
            localServerOk === true  ? t("diag.local.connected")    :
            localServerOk === false ? t("diag.local.unreachable")  :
            t("diag.local.available")
          }
          ok={localServerOk === true ? true : localServerOk === false ? false : "warn"}
        />
        <DiagRow
          label={t("diag.adapter.active")}
          value={isLocal ? t("common.yes") : t("common.no")}
          ok={isLocal}
        />
        <DiagRow
          label="Server URL"
          value={localServerUrl || "(not configured)"}
          mono
        />
        <DiagRow label="Protocol" value="HTTP REST (polling 5s)" mono />
        <DiagRow label="Timeout"  value="10s per request"        mono ok={true} />

        {isLocal && (
          <button
            onClick={handleTestLocalServer}
            disabled={testingServer || !localServerUrl}
            className="mt-1 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            {testingServer ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Cloud className="w-3 h-3" />}
            {testingServer ? "Testing..." : t("diag.local.test")}
          </button>
        )}
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
            ["pendingCount",      String(pendingCount)],
            ["deadCount",         String(deadCount)],
            ["localServerUrl",    localServerUrl || "(empty)"],
            ["localServerOk",     String(localServerOk)],
            ["tick",              String(tick)],
            ["fcm.fcmSupported",  String(fcm?.fcmSupported ?? "—")],
            ["fcm.pwaInstalled",  String(fcm?.pwaInstalled ?? "—")],
            ["fcm.bgPushActive",  String(fcm?.bgPushActive ?? "—")],
            ["fcm.swActive",      String(fcm?.swActive     ?? "—")],
            ["fcm.tokenSaved",    String(fcm?.tokenSaved   ?? "—")],
            ["fcm.vapidSet",      String(fcm?.vapidSet     ?? "—")],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <span className="text-white/30 w-32 shrink-0">{k}</span>
              <span className="text-primary/80 break-all">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
