import { useState, useEffect, type ReactNode } from "react";
import {
  Database, Cloud, Server, CheckCircle, XCircle, Clock,
  RefreshCw, Wifi, WifiOff, Terminal, Info,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getAdapterMode } from "@/lib/adapter";
import { isFirebaseReady } from "@/firebase";

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

export default function DiagnosticsPage() {
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
            ["mode",         mode],
            ["firebaseReady",String(fbReady)],
            ["isCloud",      String(isCloud)],
            ["tick",         String(tick)],
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
