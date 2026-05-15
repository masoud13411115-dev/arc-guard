import { Activity, MapPin, Clock, AlertTriangle, CheckCircle, Users, Shield, Bell, AlertOctagon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { resolveAlert } from "@/lib/adapter";
import { isFirebaseReady } from "@/firebase";
import type { GuardSession, Alert, PatrolLog, ScanStatus } from "@/types";

interface LiveMonitorProps {
  companyId: string;
  /** Passed from Dashboard — no duplicate subscriptions */
  sessions:    GuardSession[];
  alerts:      Alert[];
  recentLogs:  PatrolLog[];
}

export default function LiveMonitor({ companyId, sessions, alerts, recentLogs }: LiveMonitorProps) {
  const { t, dir } = useI18n();

  // Only unresolved alerts visible in the monitor feed
  const openAlerts = alerts.filter((a) => !a.resolved);

  const statusLabel: Record<ScanStatus, string> = {
    valid:   t("status.valid"),
    outside: t("status.outside"),
    failed:  t("status.failed"),
  };
  const statusColor: Record<ScanStatus, string> = {
    valid:   "text-green-400",
    outside: "text-yellow-400",
    failed:  "text-destructive",
  };

  const activeGuards = sessions.filter((s) => s.status === "active");

  const timeSince = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60_000)   return t("monitor.seconds.ago", { n: Math.floor(diff / 1_000) });
    if (diff < 3_600_000) return t("monitor.minutes.ago", { n: Math.floor(diff / 60_000) });
    return t("monitor.hours.ago", { n: Math.floor(diff / 3_600_000) });
  };

  return (
    <div className="space-y-4" dir={dir}>
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t("monitor.active.guards"), value: activeGuards.length,  icon: Users,         color: "text-green-400",  bg: "bg-green-400/10",  border: "border-green-500/20" },
          { label: t("monitor.open.alerts"),   value: openAlerts.length,    icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-500/20" },
          { label: t("monitor.recent.scans"),  value: recentLogs.length,    icon: CheckCircle,   color: "text-primary",    bg: "bg-primary/10",    border: "border-primary/20" },
        ].map(({ label, value, icon: Icon, color, bg, border }) => (
          <div key={label} className={`rounded-xl border ${border} ${bg} p-3 text-center`}>
            <div className="w-8 h-8 rounded-lg bg-background/30 flex items-center justify-center mx-auto mb-1.5">
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Content sections (always visible, no internal tab state needed) ── */}

      {/* Guards */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{t("monitor.tab.guards")}</span>
        </div>
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center gap-3">
            <Shield className="w-10 h-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">{t("monitor.guards.empty")}</p>
          </div>
        ) : sessions.map((s) => (
          <div key={s.guardId} className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                {s.guardName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${
                s.status === "active" ? "bg-green-400 animate-pulse" : "bg-muted-foreground"
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{s.guardName}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                  s.status === "active"
                    ? "bg-green-400/10 text-green-400 border border-green-500/20"
                    : "bg-muted text-muted-foreground border border-border"
                }`}>
                  {s.status === "active" ? t("monitor.guard.active") : t("monitor.guard.inactive")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("monitor.guard.last.checkpoint")} <span className="text-primary font-medium">{s.lastCheckpoint || "—"}</span>
              </p>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {s.lastGps
                  ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="w-3 h-3 text-green-400" />{s.lastGps.lat.toFixed(4)}, {s.lastGps.lng.toFixed(4)}</span>
                  : <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="w-3 h-3" />{t("monitor.guard.no.gps")}</span>}
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" />{timeSince(s.lastSeen)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {openAlerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Bell className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-foreground">
              {t("monitor.tab.alerts.count", { n: openAlerts.length })}
            </span>
          </div>
          {openAlerts.map((alert) => (
            <div key={alert.id} className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-yellow-400/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{t("monitor.missed.checkpoint")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="text-foreground font-medium">{alert.guardName}</span>{" "}
                  <span className="text-yellow-400 font-medium">{alert.checkpointName}</span>{" "}
                  {t("monitor.missed.not.visited")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{timeSince(alert.alertedAt)}</p>
              </div>
              {alert.id && (isFirebaseReady || true) && (
                <button
                  onClick={() => resolveAlert(companyId, alert.id!)}
                  className="text-xs text-green-400 border border-green-500/30 rounded-lg px-2.5 py-1 hover:bg-green-500/10 transition-colors shrink-0 mt-0.5"
                >
                  {t("monitor.resolve.btn")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Live Feed */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-semibold text-foreground">{t("monitor.feed.title")}</span>
          </div>
          <span className="text-xs text-muted-foreground">{t("monitor.feed.scans", { n: recentLogs.length })}</span>
        </div>
        {recentLogs.length === 0 ? (
          <div className="px-4 py-10 text-center text-muted-foreground text-sm">{t("monitor.feed.empty")}</div>
        ) : (
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {recentLogs.map((log, i) => {
              const s = log.status ?? (log.withinRadius ? "valid" : "outside");
              return (
                <div key={log.id ?? i} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    s === "valid" ? "bg-green-400" : s === "outside" ? "bg-yellow-400" : "bg-destructive"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      <span className="font-medium">{log.guardName}</span>
                      <span className="text-muted-foreground"> ← </span>
                      <span className="text-primary">{log.checkpointName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {timeSince(log.scanTime ?? log.scannedAt)}
                      {log.distanceMeters !== null && (
                        <span className={`mr-2 ${statusColor[s]}`}>{t("monitor.meters", { n: log.distanceMeters })}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {log.fraudFlags && log.fraudFlags.length > 0 && (
                      <span className="flex items-center gap-1 text-[11px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded-full"
                        title={log.fraudFlags.join(", ")}>
                        <AlertOctagon className="w-3 h-3" />
                        مشکوک
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      s === "valid"   ? "bg-green-400/10 text-green-400"   :
                      s === "outside" ? "bg-yellow-400/10 text-yellow-400" :
                      "bg-destructive/10 text-destructive"
                    }`}>
                      {statusLabel[s]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
