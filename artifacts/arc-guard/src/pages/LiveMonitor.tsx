import { useState, useEffect } from "react";
import { Activity, MapPin, Clock, AlertTriangle, CheckCircle, Users, Shield, Bell, RefreshCw } from "lucide-react";
import { subscribeGuardSessions, subscribeMissedAlerts, subscribePatrolLogs, resolveAlert } from "@/lib/firestore";
import { db } from "@/firebase";
import type { GuardSession, MissedAlert, PatrolLog } from "@/types";

export default function LiveMonitor() {
  const [sessions, setSessions] = useState<GuardSession[]>([]);
  const [alerts, setAlerts] = useState<MissedAlert[]>([]);
  const [recentLogs, setRecentLogs] = useState<PatrolLog[]>([]);
  const [tab, setTab] = useState<"guards" | "alerts" | "feed">("guards");

  useEffect(() => {
    if (!db) return;
    const u1 = subscribeGuardSessions(setSessions);
    const u2 = subscribeMissedAlerts(setAlerts);
    const u3 = subscribePatrolLogs(setRecentLogs, 30);
    return () => { u1(); u2(); u3(); };
  }, []);

  const activeGuards = sessions.filter((s) => s.status === "active");
  const idleGuards = sessions.filter((s) => s.status !== "active");

  const timeSince = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  return (
    <div className="space-y-4">
      {/* Summary Strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active Guards", value: activeGuards.length, icon: Users, color: "text-green-400", bg: "bg-green-400/10" },
          { label: "Open Alerts", value: alerts.length, icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-400/10" },
          { label: "Scans Today", value: recentLogs.length, icon: CheckCircle, color: "text-primary", bg: "bg-primary/10" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-3 text-center">
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mx-auto mb-1.5`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg bg-muted p-1 gap-1">
        {([
          { key: "guards", label: "Guards", icon: Shield },
          { key: "alerts", label: `Alerts ${alerts.length > 0 ? `(${alerts.length})` : ""}`, icon: Bell },
          { key: "feed", label: "Live Feed", icon: Activity },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${
              tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Guards Tab */}
      {tab === "guards" && (
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <div className="rounded-xl border border-border bg-card px-4 py-10 text-center">
              <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No guards are currently active.</p>
              <p className="text-xs text-muted-foreground mt-1">Guard status appears here when they log in.</p>
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.guardId}
                className="rounded-xl border border-border bg-card p-4 flex items-start gap-3"
              >
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                    {s.guardName.charAt(0)}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                    s.status === "active" ? "bg-green-400" : "bg-muted-foreground"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{s.guardName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      s.status === "active" ? "bg-green-400/10 text-green-400" : "bg-muted text-muted-foreground"
                    }`}>
                      {s.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Last: <span className="text-foreground">{s.lastCheckpoint || "—"}</span>
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    {s.lastGps && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {s.lastGps.lat.toFixed(4)}, {s.lastGps.lng.toFixed(4)}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {timeSince(s.lastSeen)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Alerts Tab */}
      {tab === "alerts" && (
        <div className="space-y-2">
          {alerts.length === 0 ? (
            <div className="rounded-xl border border-border bg-card px-4 py-10 text-center">
              <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No open alerts.</p>
              <p className="text-xs text-muted-foreground mt-1">Missed checkpoint alerts will appear here.</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-start gap-3"
              >
                <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Missed Checkpoint</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="text-foreground">{alert.guardName}</span> missed{" "}
                    <span className="text-yellow-400">{alert.checkpointName}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Due: {new Date(alert.scheduledAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} ·
                    Alerted: {timeSince(alert.alertedAt)}
                  </p>
                </div>
                {alert.id && (
                  <button
                    onClick={() => resolveAlert(alert.id!)}
                    className="text-xs text-green-400 border border-green-500/30 rounded-lg px-2.5 py-1 hover:bg-green-500/10 transition-colors shrink-0"
                  >
                    Resolve
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Live Feed Tab */}
      {tab === "feed" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-semibold text-foreground">Live Patrol Feed</span>
            </div>
            <span className="text-xs text-muted-foreground">{recentLogs.length} scans</span>
          </div>
          {recentLogs.length === 0 ? (
            <div className="px-4 py-10 text-center text-muted-foreground text-sm">
              No patrol scans yet today.
            </div>
          ) : (
            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {recentLogs.map((log, i) => (
                <div key={log.id ?? i} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${log.withinRadius ? "bg-green-400" : "bg-destructive"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      <span className="font-medium">{log.guardName}</span>
                      {" → "}
                      <span className="text-primary">{log.checkpointName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {log.scannedAtText}
                      {log.distanceMeters !== null && ` · ${log.distanceMeters}m`}
                      {log.offlineQueued && " · (offline)"}
                    </p>
                  </div>
                  {!log.withinRadius && (
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!db && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-400">
          Firebase not configured — live monitoring unavailable. Add Firebase secrets to enable.
        </div>
      )}
    </div>
  );
}
