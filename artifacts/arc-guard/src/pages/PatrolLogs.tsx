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
    getPatrolLogs().then((data) => { setLogs(data); setLoading(false); });
  }, []);

  const allLogs: PatrolLog[] = [
    ...offlineLogs.map((l) => ({ ...l, offlineQueued: true })),
    ...logs,
  ];

  const filtered = allLogs.filter((log) => {
    const matchSearch = !search ||
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
    const header = "نگهبان,ایستگاه,زمان,عرض جغرافیایی,طول جغرافیایی,فاصله (متر),در محدوده,آفلاین";
    const rows = filtered.map((l) =>
      [l.guardName, l.checkpointName, l.scannedAtText,
        l.gps?.lat ?? "", l.gps?.lng ?? "",
        l.distanceMeters ?? "", l.withinRadius ? "بله" : "خیر",
        l.offlineQueued ? "بله" : "خیر"].join(",")
    );
    const bom = "\uFEFF";
    const blob = new Blob([bom + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `arc_guard_logs_${Date.now()}.csv`;
    a.click();
  };

  const statOk = allLogs.filter((l) => l.withinRadius).length;
  const statFail = allLogs.filter((l) => !l.withinRadius).length;
  const statOffline = offlineLogs.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">گزارش گشت</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{filtered.length} رکورد</p>
        </div>
        <button onClick={exportCsv}
          className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition-colors font-medium">
          <Download className="w-3 h-3" />
          خروجی Excel
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "موفق", count: statOk, color: "text-green-400", bg: "bg-green-400/10", border: "border-green-500/20", filter: "ok" as const },
          { label: "ناموفق", count: statFail, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", filter: "fail" as const },
          { label: "آفلاین", count: statOffline, color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-500/20", filter: "offline" as const },
        ].map(({ label, count, color, bg, border, filter }) => (
          <button key={label}
            onClick={() => setFilterType(filterType === filter ? "all" : filter)}
            className={`rounded-lg border ${border} ${bg} px-3 py-2.5 text-center transition-all ${filterType === filter ? "ring-1 ring-offset-1 ring-offset-card ring-current" : ""}`}>
            <p className={`text-xl font-bold ${color}`}>{count}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو نام نگهبان یا ایستگاه..."
            className="w-full bg-card border border-border rounded-lg pr-9 pl-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as typeof filterType)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground focus:outline-none focus:border-primary transition-colors">
          <option value="all">همه</option>
          <option value="ok">موفق</option>
          <option value="fail">ناموفق</option>
          <option value="offline">آفلاین</option>
        </select>
      </div>

      {/* Logs */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="px-4 py-12 text-center text-muted-foreground text-sm">در حال بارگذاری...</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">گزارشی یافت نشد</p>
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[520px] overflow-y-auto">
            {filtered.map((log, i) => (
              <div key={log.id ?? i} className={`px-4 py-3 hover:bg-accent/20 transition-colors ${!log.withinRadius ? "border-r-2 border-destructive" : "border-r-2 border-green-500"}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${log.withinRadius ? "bg-green-500/10" : "bg-destructive/10"}`}>
                    {log.withinRadius
                      ? <CheckCircle className="w-4 h-4 text-green-400" />
                      : <AlertTriangle className="w-4 h-4 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-foreground">
                          <span className="font-semibold">{log.guardName}</span>
                          <span className="text-muted-foreground mx-1">←</span>
                          <span className="text-primary font-medium">{log.checkpointName}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {log.offlineQueued && (
                          <span className="text-[10px] text-yellow-400 border border-yellow-500/30 rounded px-1.5 py-0.5 bg-yellow-500/10">آفلاین</span>
                        )}
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${log.withinRadius ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"}`}>
                          {log.withinRadius ? "✓ موفق" : "✗ خارج"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />{log.scannedAtText}
                      </span>
                      {log.gps && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          {log.gps.lat.toFixed(4)}, {log.gps.lng.toFixed(4)}
                          <span className="text-muted-foreground/60">±{Math.round(log.gps.accuracy)}م</span>
                        </span>
                      )}
                      {log.distanceMeters !== null && (
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${log.withinRadius ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"}`}>
                          فاصله: {log.distanceMeters} متر
                          {!log.withinRadius && " (خارج از محدوده)"}
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
