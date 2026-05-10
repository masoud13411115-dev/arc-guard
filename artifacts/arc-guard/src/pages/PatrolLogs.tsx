import { useState, useEffect } from "react";
import { CheckCircle, XCircle, MapPin, Clock, AlertTriangle, Download, Search, Filter } from "lucide-react";
import { getPatrolLogs } from "@/lib/firestore";
import { getQueue } from "@/lib/offline";
import { db } from "@/firebase";
import type { PatrolLog } from "@/types";

export default function PatrolLogs() {
  const [logs, setLogs] = useState<PatrolLog[]>([]);
  const [offlineLogs, setOfflineLogs] = useState<PatrolLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "ok" | "fail" | "offline">("all");

  useEffect(() => {
    const queue = getQueue();
    setOfflineLogs(queue.map((q) => q.payload));

    if (!db) { setLoading(false); return; }
    getPatrolLogs().then((data) => {
      setLogs(data);
      setLoading(false);
    });
  }, []);

  const allLogs: PatrolLog[] = [
    ...offlineLogs.map((l) => ({ ...l, offlineQueued: true })),
    ...logs,
  ];

  const filtered = allLogs.filter((log) => {
    const matchSearch =
      !search ||
      log.guardName.toLowerCase().includes(search.toLowerCase()) ||
      log.checkpointName.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filterType === "all" ||
      (filterType === "ok" && log.withinRadius) ||
      (filterType === "fail" && !log.withinRadius) ||
      (filterType === "offline" && log.offlineQueued);
    return matchSearch && matchFilter;
  });

  const exportCsv = () => {
    const header = "Guard,Checkpoint,Time,GPS Lat,GPS Lng,Distance(m),Within Radius,Offline";
    const rows = filtered.map((l) =>
      [
        l.guardName, l.checkpointName, l.scannedAtText,
        l.gps?.lat ?? "", l.gps?.lng ?? "",
        l.distanceMeters ?? "", l.withinRadius, l.offlineQueued ?? false,
      ].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `arc_guard_patrol_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Patrol Logs</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{filtered.length} records</p>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition-colors"
        >
          <Download className="w-3 h-3" />
          Export CSV
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guard or checkpoint..."
            className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as typeof filterType)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground focus:outline-none focus:border-primary transition-colors"
        >
          <option value="all">All</option>
          <option value="ok">Valid</option>
          <option value="fail">Failed</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Valid", count: allLogs.filter((l) => l.withinRadius).length, color: "text-green-400", bg: "bg-green-400/10" },
          { label: "Failed GPS", count: allLogs.filter((l) => !l.withinRadius).length, color: "text-destructive", bg: "bg-destructive/10" },
          { label: "Offline", count: offlineLogs.length, color: "text-yellow-400", bg: "bg-yellow-400/10" },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={`rounded-lg border border-border ${bg} px-3 py-2 text-center`}>
            <p className={`text-lg font-bold ${color}`}>{count}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Logs list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="px-4 py-10 text-center text-muted-foreground text-sm">Loading logs...</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-muted-foreground text-sm">
            No patrol logs found.
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
            {filtered.map((log, i) => (
              <div key={log.id ?? i} className="px-4 py-3 hover:bg-accent/20 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    log.withinRadius ? "bg-green-400/10" : "bg-destructive/10"
                  }`}>
                    {log.withinRadius
                      ? <CheckCircle className="w-4 h-4 text-green-400" />
                      : <AlertTriangle className="w-4 h-4 text-destructive" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {log.guardName}
                        <span className="text-muted-foreground font-normal"> → </span>
                        <span className="text-primary">{log.checkpointName}</span>
                      </p>
                      {log.offlineQueued && (
                        <span className="text-[10px] text-yellow-400 border border-yellow-500/30 rounded px-1.5 py-0.5 shrink-0">
                          offline
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {log.scannedAtText}
                      </span>
                      {log.gps && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          {log.gps.lat.toFixed(4)}, {log.gps.lng.toFixed(4)}
                          {" "}±{Math.round(log.gps.accuracy)}m
                        </span>
                      )}
                      {log.distanceMeters !== null && (
                        <span className={`text-xs font-medium ${log.withinRadius ? "text-green-400" : "text-destructive"}`}>
                          {log.distanceMeters}m from checkpoint
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
