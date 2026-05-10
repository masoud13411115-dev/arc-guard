import { useState, useEffect } from "react";
import { CheckCircle, AlertTriangle, MapPin, Clock, Download, Search } from "lucide-react";
import { getPatrolLogs } from "@/lib/firestore";
import { getQueue } from "@/lib/offline";
import type { PatrolLog, ScanStatus } from "@/types";

interface PatrolLogsProps {
  companyId: string;
}

const statusLabel: Record<ScanStatus, string> = { valid: "✓ معتبر", outside: "⚠ خارج", failed: "✗ ناموفق" };
const statusColor: Record<ScanStatus, string> = { valid: "bg-green-500/10 text-green-400", outside: "bg-yellow-500/10 text-yellow-400", failed: "bg-destructive/10 text-destructive" };
const statusBorder: Record<ScanStatus, string> = { valid: "border-r-2 border-green-500", outside: "border-r-2 border-yellow-400", failed: "border-r-2 border-destructive" };

export default function PatrolLogs({ companyId }: PatrolLogsProps) {
  const [logs, setLogs] = useState<PatrolLog[]>([]);
  const [offlineLogs, setOfflineLogs] = useState<PatrolLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | ScanStatus | "offline">("all");

  useEffect(() => {
    const queue = getQueue();
    setOfflineLogs(queue.map((q) => q.payload));

    setLoading(true);
    getPatrolLogs(companyId).then((data) => { setLogs(data); setLoading(false); });
  }, [companyId]);

  const allLogs: PatrolLog[] = [
    ...offlineLogs.map((l) => ({ ...l, offlineQueued: true })),
    ...logs,
  ];

  const filtered = allLogs.filter((log) => {
    const matchSearch = !search ||
      log.guardName.toLowerCase().includes(search.toLowerCase()) ||
      log.checkpointName.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filterStatus === "all" ||
      (filterStatus === "offline" && log.offlineQueued) ||
      log.status === filterStatus;
    return matchSearch && matchFilter;
  });

  const exportCsv = () => {
    const header = "نگهبان,ایستگاه,زمان,عرض,طول,فاصله(متر),وضعیت";
    const rows = filtered.map((l) =>
      [l.guardName, l.checkpointName, l.scannedAtText,
        l.gps?.lat ?? "", l.gps?.lng ?? "",
        l.distanceMeters ?? "", statusLabel[l.status ?? "failed"]].join(",")
    );
    const blob = new Blob(["\uFEFF" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `patrol_logs_${new Date().toLocaleDateString("fa-IR").replace(/\//g, "-")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4" dir="rtl">

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو نگهبان یا ایستگاه..."
            className="w-full bg-muted border border-border rounded-lg pr-9 pl-3 py-2 text-xs focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
        >
          <option value="all">همه ({allLogs.length})</option>
          <option value="valid">معتبر ({allLogs.filter(l => l.status === "valid").length})</option>
          <option value="outside">خارج ({allLogs.filter(l => l.status === "outside").length})</option>
          <option value="failed">ناموفق ({allLogs.filter(l => l.status === "failed").length})</option>
          {offlineLogs.length > 0 && <option value="offline">آفلاین ({offlineLogs.length})</option>}
        </select>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 bg-muted border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5" />CSV
        </button>
      </div>

      {/* Log list */}
      {loading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">در حال بارگذاری...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          {search ? "نتیجه‌ای یافت نشد." : "هنوز هیچ اسکنی ثبت نشده است."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log, i) => {
            const s = log.status ?? (log.withinRadius ? "valid" : "outside");
            return (
              <div key={log.id ?? i}
                className={`rounded-xl border border-border bg-card overflow-hidden hover:border-primary/20 transition-colors ${statusBorder[s]}`}>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{log.guardName}</p>
                      <p className="text-xs text-primary mt-0.5">{log.checkpointName}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {log.offlineQueued && (
                        <span className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded-full">آفلاین</span>
                      )}
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusColor[s]}`}>
                        {statusLabel[s]}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {log.scannedAtText ?? new Date(log.scanTime ?? log.scannedAt).toLocaleString("fa-IR")}
                    </span>
                    {log.gps && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                        <MapPin className="w-3 h-3" />
                        {log.gps.lat.toFixed(4)}, {log.gps.lng.toFixed(4)}
                      </span>
                    )}
                    {log.distanceMeters !== null && log.distanceMeters !== undefined && (
                      <span className={`flex items-center gap-1 text-[11px] font-medium ${log.withinRadius ? "text-green-400" : "text-yellow-400"}`}>
                        {log.withinRadius ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {log.distanceMeters} متر
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
