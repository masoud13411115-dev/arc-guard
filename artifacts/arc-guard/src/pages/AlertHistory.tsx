import { useState } from "react";
import {
  AlertTriangle, CheckCheck, Radio, Clock, MapPin,
  Filter, ChevronDown, ChevronUp, ShieldAlert, RotateCcw, Eye
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Alert, AlertKind } from "@/types";
import { resolveAlert } from "@/lib/firestore";

interface AlertHistoryProps {
  alerts: Alert[];
  companyId: string;
  onAlertResolved: (id: string) => void;
  seenIds?: Set<string>;
  onMarkSeen?: (ids: string[]) => void;
}

type KindFilter = "all" | AlertKind;
type StatusFilter = "all" | "open" | "resolved";

export default function AlertHistory({
  alerts,
  companyId,
  onAlertResolved,
  seenIds = new Set(),
  onMarkSeen,
}: AlertHistoryProps) {
  const { t, dir } = useI18n();
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  const KIND_META: Record<AlertKind, {
    label: string; color: string; bg: string; border: string;
    icon: React.ElementType; badgeBg: string;
  }> = {
    sos: {
      label: t("alert.sos.label"),
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      badgeBg: "bg-red-500/20 text-red-400 border-red-500/40",
      icon: Radio,
    },
    missed: {
      label: t("alert.missed.label"),
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
      badgeBg: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
      icon: Clock,
    },
    outside: {
      label: t("alert.outside.label"),
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
      badgeBg: "bg-orange-500/20 text-orange-400 border-orange-500/40",
      icon: MapPin,
    },
  };

  const formatRelative = (ts: number): string => {
    const diff = Date.now() - ts;
    const m = Math.round(diff / 60000);
    if (m < 1) return t("alert.time.now");
    if (m < 60) return t("alert.time.minutes", { n: m });
    const h = Math.round(m / 60);
    if (h < 24) return t("alert.time.hours", { n: h });
    return t("alert.time.days", { n: Math.round(h / 24) });
  };

  const filtered = alerts
    .filter((a) => {
      if (kindFilter !== "all" && a.kind !== kindFilter) return false;
      if (statusFilter === "open" && a.resolved) return false;
      if (statusFilter === "resolved" && !a.resolved) return false;
      return true;
    })
    .sort((a, b) => b.alertedAt - a.alertedAt);

  const openCount = alerts.filter((a) => !a.resolved).length;
  const sosCount = alerts.filter((a) => a.kind === "sos" && !a.resolved).length;
  const unseenCount = alerts.filter((a) => a.id && !seenIds.has(a.id) && !a.resolved).length;

  const handleResolve = async (id: string) => {
    setResolving(id);
    await resolveAlert(companyId, id);
    onAlertResolved(id);
    setResolving(null);
  };

  const handleMarkAllSeen = () => {
    const ids = alerts
      .filter((a) => a.id && !seenIds.has(a.id))
      .map((a) => a.id!);
    if (ids.length > 0) onMarkSeen?.(ids);
  };

  const handleMarkOneSeen = (id: string) => {
    if (!seenIds.has(id)) onMarkSeen?.([id]);
  };

  return (
    <div className="space-y-4" dir={dir}>

      {/* ── Summary bar ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: t("alert.summary.sos"),
            value: sosCount,
            color: "text-red-400",
            bg: "bg-red-500/10 border-red-500/20",
            animate: sosCount > 0,
          },
          {
            label: t("alert.summary.open"),
            value: openCount,
            color: openCount > 0 ? "text-yellow-400" : "text-muted-foreground",
            bg: openCount > 0 ? "bg-yellow-500/10 border-yellow-500/20" : "bg-muted/20 border-border",
            animate: false,
          },
          {
            label: t("alert.summary.unseen"),
            value: unseenCount,
            color: unseenCount > 0 ? "text-primary" : "text-muted-foreground",
            bg: unseenCount > 0 ? "bg-primary/10 border-primary/20" : "bg-muted/20 border-border",
            animate: false,
          },
        ].map(({ label, value, color, bg, animate }) => (
          <div key={label} className={`rounded-xl border ${bg} p-3 flex flex-col items-center gap-1`}>
            <p className={`text-2xl font-bold ${color} ${animate ? "animate-pulse" : ""}`}>{value}</p>
            <p className="text-[10px] text-muted-foreground text-center">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap flex-1">
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
                {k === "all" ? t("common.all") : KIND_META[k].label}
              </button>
            ))}
          </div>
          {unseenCount > 0 && (
            <button
              onClick={handleMarkAllSeen}
              className="flex items-center gap-1 text-[10px] text-primary hover:underline shrink-0"
            >
              <Eye className="w-3 h-3" />
              {t("alert.filter.markSeen")}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {(["all", "open", "resolved"] as StatusFilter[]).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}>
              {s === "all" ? t("common.all") : s === "open" ? t("alert.filter.open") : t("alert.filter.resolved")}
            </button>
          ))}
        </div>
      </div>

      {/* ── Alert list ── */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 flex flex-col items-center gap-3">
          <ShieldAlert className="w-10 h-10 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">{t("alert.empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const meta = KIND_META[a.kind];
            const Icon = meta.icon;
            const isExpanded = expanded === a.id;
            const ago = formatRelative(a.alertedAt);
            const isSeen = !a.id || seenIds.has(a.id) || a.resolved;

            return (
              <div key={a.id}
                className={`rounded-xl border overflow-hidden transition-all ${
                  a.resolved
                    ? "border-border bg-card/40 opacity-60"
                    : `${meta.border} ${meta.bg}`
                }`}
              >
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => {
                    setExpanded(isExpanded ? null : a.id ?? null);
                    if (a.id) handleMarkOneSeen(a.id);
                  }}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    a.resolved ? "bg-muted" : meta.bg
                  }`}>
                    <Icon className={`w-4 h-4 ${a.resolved ? "text-muted-foreground" : meta.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs font-bold ${a.resolved ? "text-muted-foreground" : meta.color}`}>
                        {meta.label}
                      </span>
                      {!isSeen && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${meta.badgeBg} animate-pulse`}>
                          {t("alert.badge.new")}
                        </span>
                      )}
                      {a.kind === "sos" && !a.resolved && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{a.guardName}</p>
                    {a.checkpointName && (
                      <p className="text-xs text-muted-foreground truncate">{t("alert.checkpoint", { name: a.checkpointName })}</p>
                    )}
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className="text-[10px] text-muted-foreground">{ago}</span>
                    {a.resolved ? (
                      <span className="flex items-center gap-0.5 text-[10px] text-green-400">
                        <CheckCheck className="w-3 h-3" /> {t("alert.resolved")}
                      </span>
                    ) : (
                      <span className="text-[10px] text-red-400 font-medium animate-pulse">{t("alert.open")}</span>
                    )}
                  </div>

                  <div className="text-muted-foreground shrink-0 mr-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setExpanded(isExpanded ? null : a.id ?? null)}
                      className="p-1 hover:text-foreground transition-colors">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border/40 pt-3 space-y-3 animate-fade-in-up">
                    {a.message && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{a.message}</p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{t("alert.alertedAt")} {new Date(a.alertedAt).toLocaleString("fa-IR")}</span>
                      {a.gps && <span>{t("alert.gpsAccuracy", { n: Math.round(a.gps.accuracy) })}</span>}
                      {a.distanceMeters != null && <span>{t("alert.distance", { n: a.distanceMeters })}</span>}
                      {a.resolvedAt && <span>{t("alert.resolvedAt")} {new Date(a.resolvedAt).toLocaleString("fa-IR")}</span>}
                    </div>

                    <div className="flex items-center gap-2">
                      {!a.resolved && a.id && (
                        <button
                          onClick={() => handleResolve(a.id!)}
                          disabled={resolving === a.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-medium hover:bg-green-500/25 transition-colors disabled:opacity-50"
                        >
                          {resolving === a.id
                            ? <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                            : <CheckCheck className="w-3.5 h-3.5" />}
                          {resolving === a.id ? t("alert.resolve.loading") : t("alert.resolve.btn")}
                        </button>
                      )}
                      {a.id && !seenIds.has(a.id) && !a.resolved && (
                        <button
                          onClick={() => handleMarkOneSeen(a.id!)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted border border-border text-muted-foreground text-xs hover:bg-accent transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {t("alert.markSeen.btn")}
                        </button>
                      )}
                    </div>
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
