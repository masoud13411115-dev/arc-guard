import { useState, useEffect } from "react";
import { Activity, MapPin, Clock, AlertTriangle, CheckCircle, Users, Shield, Bell } from "lucide-react";
import { subscribeGuardSessions, subscribeMissedAlerts, subscribePatrolLogs, resolveAlert } from "@/lib/firestore";
import { db } from "@/firebase";
import type { GuardSession, MissedAlert, PatrolLog, ScanStatus } from "@/types";

interface LiveMonitorProps {
  companyId: string;
}

const statusLabel: Record<ScanStatus, string> = { valid: "معتبر", outside: "خارج", failed: "ناموفق" };
const statusColor: Record<ScanStatus, string> = { valid: "text-green-400", outside: "text-yellow-400", failed: "text-destructive" };

export default function LiveMonitor({ companyId }: LiveMonitorProps) {
  const [sessions, setSessions] = useState<GuardSession[]>([]);
  const [alerts, setAlerts] = useState<MissedAlert[]>([]);
  const [recentLogs, setRecentLogs] = useState<PatrolLog[]>([]);
  const [tab, setTab] = useState<"guards" | "alerts" | "feed">("guards");

  useEffect(() => {
    if (!db) return;
    const u1 = subscribeGuardSessions(companyId, setSessions);
    const u2 = subscribeMissedAlerts(companyId, setAlerts);
    const u3 = subscribePatrolLogs(companyId, setRecentLogs, 30);
    return () => { u1(); u2(); u3(); };
  }, [companyId]);

  const activeGuards = sessions.filter((s) => s.status === "active");

  const timeSince = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return `${Math.floor(diff / 1000)} ثانیه پیش`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)} دقیقه پیش`;
    return `${Math.floor(diff / 3600000)} ساعت پیش`;
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "نگهبان فعال", value: activeGuards.length, icon: Users, color: "text-green-400", bg: "bg-green-400/10", border: "border-green-500/20" },
          { label: "هشدارهای باز", value: alerts.length, icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-500/20" },
          { label: "اسکن‌های امروز", value: recentLogs.length, icon: CheckCircle, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
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

      {/* Tabs */}
      <div className="flex rounded-lg bg-muted p-1 gap-1">
        {([
          { key: "guards", label: "نگهبانان", icon: Shield },
          { key: "alerts", label: alerts.length > 0 ? `هشدارها (${alerts.length})` : "هشدارها", icon: Bell },
          { key: "feed", label: "فید زنده", icon: Activity },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className="w-3.5 h-3.5" />{label}
            {key === "alerts" && alerts.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />}
          </button>
        ))}
      </div>

      {/* Guards */}
      {tab === "guards" && (
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <div className="rounded-xl border border-border bg-card px-4 py-10 text-center">
              <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">هنوز هیچ نگهبانی وارد نشده</p>
              <p className="text-xs text-muted-foreground/60 mt-1">وقتی نگهبانان وارد شوند، موقعیت آن‌ها اینجا نشان داده می‌شود.</p>
            </div>
          ) : sessions.map((s) => (
            <div key={s.guardId} className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
              <div className="relative shrink-0">
                <div className="w-11 h-11 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                  {s.guardName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${s.status === "active" ? "bg-green-400 animate-pulse" : "bg-muted-foreground"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{s.guardName}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${s.status === "active" ? "bg-green-400/10 text-green-400 border border-green-500/20" : "bg-muted text-muted-foreground border border-border"}`}>
                    {s.status === "active" ? "● فعال" : "غیرفعال"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">آخرین ایستگاه: <span className="text-primary font-medium">{s.lastCheckpoint || "—"}</span></p>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {s.lastGps ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3 text-green-400" />{s.lastGps.lat.toFixed(4)}, {s.lastGps.lng.toFixed(4)}
                    </span>
                  ) : <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="w-3 h-3" />بدون GPS</span>}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" />{timeSince(s.lastSeen)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alerts */}
      {tab === "alerts" && (
        <div className="space-y-2">
          {alerts.length === 0 ? (
            <div className="rounded-xl border border-border bg-card px-4 py-10 text-center">
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">هیچ هشداری وجود ندارد</p>
              <p className="text-xs text-muted-foreground mt-1">وقتی ایستگاهی از قلم بیفتد اینجا نمایش داده می‌شود.</p>
            </div>
          ) : alerts.map((alert) => (
            <div key={alert.id} className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-yellow-400/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">ایستگاه از دست رفت</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="text-foreground font-medium">{alert.guardName}</span> ایستگاه <span className="text-yellow-400 font-medium">{alert.checkpointName}</span> را بازدید نکرد
                </p>
                <p className="text-xs text-muted-foreground mt-1">{timeSince(alert.alertedAt)}</p>
              </div>
              {alert.id && (
                <button onClick={() => resolveAlert(companyId, alert.id!)}
                  className="text-xs text-green-400 border border-green-500/30 rounded-lg px-2.5 py-1 hover:bg-green-500/10 transition-colors shrink-0 mt-0.5">
                  حل شد
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Feed */}
      {tab === "feed" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-semibold text-foreground">فید زنده گشت</span>
            </div>
            <span className="text-xs text-muted-foreground">{recentLogs.length} اسکن</span>
          </div>
          {recentLogs.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Activity className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">هنوز اسکنی انجام نشده</p>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {recentLogs.map((log, i) => {
                const s = log.status ?? (log.withinRadius ? "valid" : "outside");
                return (
                  <div key={log.id ?? i} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${s === "valid" ? "bg-green-400" : s === "outside" ? "bg-yellow-400" : "bg-destructive"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        <span className="font-medium">{log.guardName}</span>
                        <span className="text-muted-foreground"> ← </span>
                        <span className="text-primary">{log.checkpointName}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {timeSince(log.scanTime ?? log.scannedAt)}
                        {log.distanceMeters !== null && <span className={`mr-2 ${statusColor[s]}`}>{log.distanceMeters} متر</span>}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${s === "valid" ? "bg-green-400/10 text-green-400" : s === "outside" ? "bg-yellow-400/10 text-yellow-400" : "bg-destructive/10 text-destructive"}`}>
                      {statusLabel[s]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
