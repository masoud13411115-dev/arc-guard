import { useState } from "react";
import {
  AlertTriangle, CheckCheck, Radio, Clock, MapPin,
  Filter, ChevronDown, ChevronUp, ShieldAlert, RotateCcw
} from "lucide-react";
import type { Alert, AlertKind } from "@/types";
import { resolveAlert } from "@/lib/firestore";
import { isFirebaseReady } from "@/firebase";

interface AlertHistoryProps {
  alerts: Alert[];
  companyId: string;
  onAlertResolved: (id: string) => void;
}

type KindFilter = "all" | AlertKind;
type StatusFilter = "all" | "open" | "resolved";

const KIND_META: Record<AlertKind, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  sos: {
    label: "SOS اضطراری",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    icon: Radio,
  },
  missed: {
    label: "ایستگاه از دست رفت",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    icon: Clock,
  },
  outside: {
    label: "خارج از محدوده",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    icon: MapPin,
  },
};

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return "همین الان";
  if (m < 60) return `${m} دقیقه پیش`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ساعت پیش`;
  return Math.round(h / 24) + " روز پیش";
}

export default function AlertHistory({ alerts, companyId, onAlertResolved }: AlertHistoryProps) {
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  const isDemo = !isFirebaseReady;

  const filtered = alerts.filter((a) => {
    if (kindFilter !== "all" && a.kind !== kindFilter) return false;
    if (statusFilter === "open" && a.resolved) return false;
    if (statusFilter === "resolved" && !a.resolved) return false;
    return true;
  }).sort((a, b) => b.alertedAt - a.alertedAt);

  const openCount = alerts.filter((a) => !a.resolved).length;
  const sosCount = alerts.filter((a) => a.kind === "sos" && !a.resolved).length;

  const handleResolve = async (id: string) => {
    if (isDemo) { onAlertResolved(id); return; }
    setResolving(id);
    await resolveAlert(companyId, id);
    onAlertResolved(id);
    setResolving(null);
  };

  return (
    <div className="space-y-4" dir="rtl">

      {/* ── Summary bar ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "SOS باز", value: sosCount, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
          { label: "هشدار باز", value: openCount, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
          { label: "کل هشدارها", value: alerts.length, color: "text-muted-foreground", bg: "bg-muted/30 border-border" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-xl border ${bg} p-3 flex flex-col items-center gap-1`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-[10px] text-muted-foreground text-center">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-2.5">
        {/* Kind filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {(["all", "sos", "missed", "outside"] as KindFilter[]).map((k) => (
            <button key={k} onClick={() => setKindFilter(k)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                kindFilter === k
                  ? k === "sos" ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : k === "missed" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                  : k === "outside" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                  : "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}>
              {k === "all" ? "همه" : KIND_META[k].label}
            </button>
          ))}
        </div>
        {/* Status filter */}
        <div className="flex items-center gap-1.5">
          {(["all", "open", "resolved"] as StatusFilter[]).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}>
              {s === "all" ? "همه" : s === "open" ? "باز" : "بسته شده"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Alert list ── */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 flex flex-col items-center gap-3">
          <ShieldAlert className="w-10 h-10 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">هیچ هشداری با این فیلتر یافت نشد</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const meta = KIND_META[a.kind];
            const Icon = meta.icon;
            const isExpanded = expanded === a.id;
            const ago = formatRelative(a.alertedAt);

            return (
              <div key={a.id}
                className={`rounded-xl border ${a.resolved ? "border-border bg-card/40 opacity-70" : `${meta.border} ${meta.bg}`} overflow-hidden transition-all`}
              >
                {/* Main row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${a.resolved ? "bg-muted" : meta.bg}`}>
                    <Icon className={`w-4 h-4 ${a.resolved ? "text-muted-foreground" : meta.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs font-bold ${a.resolved ? "text-muted-foreground" : meta.color}`}>
                        {meta.label}
                      </span>
                      {a.kind === "sos" && !a.resolved && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{a.guardName}</p>
                    {a.checkpointName && (
                      <p className="text-xs text-muted-foreground truncate">ایستگاه: {a.checkpointName}</p>
                    )}
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className="text-[10px] text-muted-foreground">{ago}</span>
                    {a.resolved ? (
                      <span className="flex items-center gap-0.5 text-[10px] text-green-400">
                        <CheckCheck className="w-3 h-3" /> بسته شد
                      </span>
                    ) : (
                      <span className="text-[10px] text-red-400 font-medium animate-pulse">باز</span>
                    )}
                  </div>

                  <button onClick={() => setExpanded(isExpanded ? null : a.id ?? null)}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-3 border-t border-border/40 pt-3 space-y-2 animate-fade-in-up">
                    {a.message && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{a.message}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>زمان هشدار: {new Date(a.alertedAt).toLocaleString("fa-IR")}</span>
                      {a.gps && <span>دقت GPS: ±{Math.round(a.gps.accuracy)} متر</span>}
                      {a.distanceMeters != null && <span>فاصله: {a.distanceMeters} متر</span>}
                      {a.resolvedAt && <span>بسته شد: {new Date(a.resolvedAt).toLocaleString("fa-IR")}</span>}
                    </div>
                    {!a.resolved && a.id && (
                      <button
                        onClick={() => handleResolve(a.id!)}
                        disabled={resolving === a.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-medium hover:bg-green-500/25 transition-colors disabled:opacity-50"
                      >
                        {resolving === a.id
                          ? <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                          : <CheckCheck className="w-3.5 h-3.5" />}
                        {resolving === a.id ? "در حال بستن..." : "تأیید و بستن هشدار"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
