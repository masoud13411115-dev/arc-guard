import { useState, useEffect } from "react";
import {
  Activity, MapPin, Clock, AlertTriangle, CheckCircle,
  Users, Shield, Bell, Wifi, WifiOff
} from "lucide-react";
import { subscribeGuardSessions, subscribeMissedAlerts, subscribePatrolLogs, resolveAlert } from "@/lib/firestore";
import { db } from "@/firebase";
import type { GuardSession, MissedAlert, PatrolLog } from "@/types";

// Demo data shown when Firebase has no real data yet
const DEMO_SESSIONS: GuardSession[] = [
  { guardId: "demo1", guardName: "Ali Mohammadi", lastSeen: Date.now() - 3 * 60000, lastCheckpoint: "Main Gate", lastGps: { lat: 35.6892, lng: 51.3890, accuracy: 8 }, status: "active" },
  { guardId: "demo2", guardName: "Sara Hosseini", lastSeen: Date.now() - 11 * 60000, lastCheckpoint: "Server Room", lastGps: { lat: 35.6901, lng: 51.3912, accuracy: 15 }, status: "active" },
  { guardId: "demo3", guardName: "Reza Ahmadi", lastSeen: Date.now() - 45 * 60000, lastCheckpoint: "Parking B", lastGps: null, status: "idle" },
];

const DEMO_ALERTS: MissedAlert[] = [
  { id: "da1", guardId: "demo3", guardName: "Reza Ahmadi", checkpointId: "cp1", checkpointName: "Parking B", scheduledAt: Date.now() - 35 * 60000, alertedAt: Date.now() - 20 * 60000, resolved: false },
];

const DEMO_LOGS: PatrolLog[] = [
  { id: "dl1", guardId: "demo1", guardName: "Ali Mohammadi", checkpointId: "cp1", checkpointName: "Main Gate", qrScanned: "ARC_CP_MAIN", gps: { lat: 35.6892, lng: 51.3890, accuracy: 8 }, distanceMeters: 6, withinRadius: true, scannedAt: Date.now() - 3 * 60000, scannedAtText: new Date(Date.now() - 3 * 60000).toLocaleString("en-GB"), synced: true },
  { id: "dl2", guardId: "demo2", guardName: "Sara Hosseini", checkpointId: "cp2", checkpointName: "Server Room", qrScanned: "ARC_CP_SERVER", gps: { lat: 35.6901, lng: 51.3912, accuracy: 15 }, distanceMeters: 12, withinRadius: true, scannedAt: Date.now() - 11 * 60000, scannedAtText: new Date(Date.now() - 11 * 60000).toLocaleString("en-GB"), synced: true },
  { id: "dl3", guardId: "demo3", guardName: "Reza Ahmadi", checkpointId: "cp3", checkpointName: "Parking B", qrScanned: "ARC_CP_PARK", gps: { lat: 35.6855, lng: 51.3775, accuracy: 42 }, distanceMeters: 94, withinRadius: false, scannedAt: Date.now() - 48 * 60000, scannedAtText: new Date(Date.now() - 48 * 60000).toLocaleString("en-GB"), synced: true },
  { id: "dl4", guardId: "demo1", guardName: "Ali Mohammadi", checkpointId: "cp4", checkpointName: "Roof Access", qrScanned: "ARC_CP_ROOF", gps: { lat: 35.6893, lng: 51.3891, accuracy: 10 }, distanceMeters: 3, withinRadius: true, scannedAt: Date.now() - 65 * 60000, scannedAtText: new Date(Date.now() - 65 * 60000).toLocaleString("en-GB"), synced: true },
];

export default function LiveMonitor() {
  const [sessions, setSessions] = useState<GuardSession[]>([]);
  const [alerts, setAlerts] = useState<MissedAlert[]>([]);
  const [recentLogs, setRecentLogs] = useState<PatrolLog[]>([]);
  const [tab, setTab] = useState<"guards" | "alerts" | "feed">("guards");
  const [isDemo, setIsDemo] = useState(false);
  const [online] = useState(navigator.onLine);

  useEffect(() => {
    if (!db) {
      // No Firebase — show demo data
      setSessions(DEMO_SESSIONS);
      setAlerts(DEMO_ALERTS);
      setRecentLogs(DEMO_LOGS);
      setIsDemo(true);
      return;
    }

    let dataReceived = false;
    const demoTimer = setTimeout(() => {
      if (!dataReceived) {
        setSessions(DEMO_SESSIONS);
        setAlerts(DEMO_ALERTS);
        setRecentLogs(DEMO_LOGS);
        setIsDemo(true);
      }
    }, 3000);

    const u1 = subscribeGuardSessions((data) => {
      dataReceived = true;
      clearTimeout(demoTimer);
      if (data.length > 0) { setSessions(data); setIsDemo(false); }
      else { setSessions(DEMO_SESSIONS); setIsDemo(true); }
    });
    const u2 = subscribeMissedAlerts((data) => {
      if (data.length > 0) { setAlerts(data); setIsDemo(false); }
      else if (sessions.length === 0) setAlerts(DEMO_ALERTS);
    });
    const u3 = subscribePatrolLogs((data) => {
      if (data.length > 0) { setRecentLogs(data); setIsDemo(false); }
      else setRecentLogs(DEMO_LOGS);
    }, 30);

    return () => { u1(); u2(); u3(); clearTimeout(demoTimer); };
  }, []);

  const activeGuards = sessions.filter((s) => s.status === "active");

  const timeSince = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  return (
    <div className="space-y-4">
      {/* Demo notice */}
      {isDemo && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-start gap-3">
          <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-primary">نمایش دمو</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              هنوز هیچ گاردی وارد سیستم نشده. داده‌های نمونه نمایش داده می‌شوند.
              وقتی گاردها وارد شوند، اطلاعات واقعی نمایش داده می‌شود.
            </p>
          </div>
        </div>
      )}

      {/* Summary Strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active Guards", value: activeGuards.length, icon: Users, color: "text-green-400", bg: "bg-green-400/10", border: "border-green-500/20" },
          { label: "Open Alerts", value: alerts.length, icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-500/20" },
          { label: "Scans", value: recentLogs.length, icon: CheckCircle, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
        ].map(({ label, value, icon: Icon, color, bg, border }) => (
          <div key={label} className={`rounded-xl border ${border} ${bg} p-3 text-center`}>
            <div className={`w-8 h-8 rounded-lg bg-background/30 flex items-center justify-center mx-auto mb-1.5`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg bg-muted p-1 gap-1">
        {([
          { key: "guards", label: "Guards", icon: Shield },
          { key: "alerts", label: alerts.length > 0 ? `Alerts (${alerts.length})` : "Alerts", icon: Bell },
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
            {key === "alerts" && alerts.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Guards Tab */}
      {tab === "guards" && (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div
              key={s.guardId}
              className="rounded-xl border border-border bg-card p-4 flex items-start gap-3"
            >
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
                    {s.status === "active" ? "● Active" : "Idle"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Last checkpoint:{" "}
                  <span className="text-primary font-medium">{s.lastCheckpoint || "—"}</span>
                </p>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {s.lastGps ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3 text-green-400" />
                      {s.lastGps.lat.toFixed(4)}, {s.lastGps.lng.toFixed(4)}
                      <span className="text-muted-foreground/60">±{Math.round(s.lastGps.accuracy)}m</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      No GPS
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {timeSince(s.lastSeen)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alerts Tab */}
      {tab === "alerts" && (
        <div className="space-y-2">
          {alerts.length === 0 ? (
            <div className="rounded-xl border border-border bg-card px-4 py-10 text-center">
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">هیچ هشداری وجود ندارد</p>
              <p className="text-xs text-muted-foreground mt-1">وقتی یک ایستگاه از قلم بیفتد، اینجا نمایش داده می‌شود.</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-full bg-yellow-400/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Missed Checkpoint</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="text-foreground font-medium">{alert.guardName}</span>
                    {" "}missed{" "}
                    <span className="text-yellow-400 font-medium">{alert.checkpointName}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Due:{" "}
                    {new Date(alert.scheduledAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    {" · "}Alerted {timeSince(alert.alertedAt)}
                  </p>
                </div>
                {alert.id && !isDemo && (
                  <button
                    onClick={() => resolveAlert(alert.id!)}
                    className="text-xs text-green-400 border border-green-500/30 rounded-lg px-2.5 py-1 hover:bg-green-500/10 transition-colors shrink-0 mt-0.5"
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
              <span className="text-sm font-semibold text-foreground">Patrol Feed</span>
            </div>
            <span className="text-xs text-muted-foreground">{recentLogs.length} scans</span>
          </div>
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {recentLogs.map((log, i) => (
              <div key={log.id ?? i} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
                <div className={`w-2 h-2 rounded-full shrink-0 ${log.withinRadius ? "bg-green-400" : "bg-destructive"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">
                    <span className="font-medium">{log.guardName}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span className="text-primary">{log.checkpointName}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {timeSince(log.scannedAt)}
                    {log.distanceMeters !== null && (
                      <span className={`ml-2 ${log.withinRadius ? "text-green-400" : "text-destructive"}`}>
                        {log.distanceMeters}m
                      </span>
                    )}
                    {log.offlineQueued && <span className="ml-2 text-yellow-400">(offline)</span>}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                  log.withinRadius
                    ? "bg-green-400/10 text-green-400"
                    : "bg-destructive/10 text-destructive"
                }`}>
                  {log.withinRadius ? "Valid" : "Outside"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
