import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  CheckCircle, AlertTriangle, MapPin, Clock, Download,
  Search, ChevronDown, X, Users, Shield, SlidersHorizontal,
  Loader2, AlertOctagon, Calendar, BarChart2, Layers,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getPatrolLogs } from "@/lib/adapter";
import { getQueue } from "@/lib/offline";
import type { PatrolLog, ScanStatus } from "@/types";

interface PatrolLogsProps {
  companyId: string;
}

const statusColor: Record<ScanStatus, string> = {
  valid:   "bg-green-500/10 text-green-400 border-green-500/20",
  outside: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  failed:  "bg-red-500/10 text-red-400 border-red-500/20",
};
const statusBorderLeft: Record<ScanStatus, string> = {
  valid:   "border-r-2 border-green-500",
  outside: "border-r-2 border-yellow-400",
  failed:  "border-r-2 border-red-500",
};

type StatusFilter  = "all" | ScanStatus | "offline";
type PeriodFilter  = "today" | "week" | "month" | "all";

interface GuardOption      { id: string; name: string }
interface CheckpointOption { id: string; name: string }

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onClose]);
}

interface DropdownProps {
  label: string;
  icon: React.ReactNode;
  options: { id: string; name: string }[];
  selected: string | null;
  allLabel: string;
  emptyLabel: string;
  onSelect: (id: string | null) => void;
  accentColor?: string;
}

function SelectDropdown({ label, icon, options, selected, allLabel, emptyLabel, onSelect, accentColor = "text-primary border-primary/40 bg-primary/10" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref  = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);
  const selectedName = selected ? options.find(o => o.id === selected)?.name ?? label : null;
  const isActive = !!selected;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-[14px] font-semibold transition-colors min-w-0 max-w-[180px] ${
          isActive ? accentColor : "border-border bg-muted text-muted-foreground hover:text-foreground hover:border-primary/30"
        }`}
      >
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{selectedName ?? label}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 min-w-[220px] max-w-[280px] bg-card border border-border rounded-2xl shadow-2xl z-30 overflow-hidden"
          style={{ maxHeight: "60vh", overflowY: "auto" }}>
          <button type="button" onClick={() => { onSelect(null); setOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-[14px] text-right transition-colors ${!selected ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
            <span className="w-2 h-2 rounded-full bg-current shrink-0" />
            {allLabel}
            {!selected && <CheckCircle className="w-3.5 h-3.5 mr-auto text-primary" />}
          </button>
          {options.length > 0 && <div className="h-px bg-border mx-3" />}
          {options.map(opt => (
            <button key={opt.id} type="button" onClick={() => { onSelect(opt.id); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-[14px] text-right transition-colors ${selected === opt.id ? "bg-primary/10 text-primary font-bold" : "text-foreground hover:bg-accent"}`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${selected === opt.id ? "bg-primary" : "bg-border"}`} />
              <span className="truncate">{opt.name}</span>
              {selected === opt.id && <CheckCircle className="w-3.5 h-3.5 mr-auto text-primary" />}
            </button>
          ))}
          {options.length === 0 && <div className="px-4 py-4 text-center text-[13px] text-muted-foreground">{emptyLabel}</div>}
        </div>
      )}
    </div>
  );
}

// ── Date-period helpers ────────────────────────────────────────────────────────
function periodStart(period: PeriodFilter): number {
  const now = new Date();
  if (period === "today") {
    const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime();
  }
  if (period === "week")  return now.getTime() - 7  * 86_400_000;
  if (period === "month") return now.getTime() - 30 * 86_400_000;
  return 0;
}

// ── Fraud flag label ───────────────────────────────────────────────────────────
const FRAUD_LABEL: Record<string, string> = {
  low_accuracy:     "دقت GPS پایین",
  impossible_speed: "سرعت غیرممکن",
  static_position:  "موقعیت ثابت",
};

export default function PatrolLogs({ companyId }: PatrolLogsProps) {
  const { t, dir } = useI18n();
  const [logs, setLogs]           = useState<PatrolLog[]>([]);
  const [offlineLogs, setOfflineLogs] = useState<PatrolLog[]>([]);
  const [loading, setLoading]     = useState(true);

  const statusLabel: Record<ScanStatus, string> = {
    valid:   t("logs.status.valid"),
    outside: t("logs.status.outside"),
    failed:  t("logs.status.failed"),
  };

  const [selectedGuardId, setSelectedGuardId] = useState<string | null>(null);
  const [selectedCpId, setSelectedCpId]       = useState<string | null>(null);
  const [filterStatus, setFilterStatus]        = useState<StatusFilter>("all");
  const [periodFilter, setPeriodFilter]        = useState<PeriodFilter>("all");
  const [search, setSearch]                    = useState("");
  const [showSearch, setShowSearch]            = useState(false);
  const [expandedLog, setExpandedLog]          = useState<string | null>(null);

  useEffect(() => {
    const queue = getQueue();
    setOfflineLogs(queue.map(q => q.payload));
    setLoading(true);
    getPatrolLogs(companyId).then(data => { setLogs(data); setLoading(false); });
  }, [companyId]);

  const allLogs: PatrolLog[] = useMemo(() => [
    ...offlineLogs.map(l => ({ ...l, offlineQueued: true })),
    ...logs,
  ], [logs, offlineLogs]);

  const guardOptions: GuardOption[] = useMemo(() => {
    const map = new Map<string, string>();
    allLogs.forEach(l => { if (l.guardId && l.guardName) map.set(l.guardId, l.guardName); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "fa"));
  }, [allLogs]);

  const checkpointOptions: CheckpointOption[] = useMemo(() => {
    const map = new Map<string, string>();
    allLogs.forEach(l => { if (l.checkpointId && l.checkpointName) map.set(l.checkpointId, l.checkpointName); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "fa"));
  }, [allLogs]);

  // ── Period + other filters ─────────────────────────────────────────────────
  const periodFiltered = useMemo(() => {
    if (periodFilter === "all") return allLogs;
    const start = periodStart(periodFilter);
    return allLogs.filter(l => (l.scanTime ?? l.scannedAt) >= start);
  }, [allLogs, periodFilter]);

  const filtered = useMemo(() => periodFiltered.filter(log => {
    const matchGuard  = !selectedGuardId || log.guardId === selectedGuardId;
    const matchCp     = !selectedCpId    || log.checkpointId === selectedCpId;
    const matchStatus =
      filterStatus === "all" ||
      (filterStatus === "offline" && log.offlineQueued) ||
      log.status === filterStatus;
    const matchSearch = !search ||
      log.guardName?.toLowerCase().includes(search.toLowerCase()) ||
      log.checkpointName?.toLowerCase().includes(search.toLowerCase());
    return matchGuard && matchCp && matchStatus && matchSearch;
  }), [periodFiltered, selectedGuardId, selectedCpId, filterStatus, search]);

  // ── Summary stats (from period-filtered, before other filters) ────────────
  const stats = useMemo(() => {
    const total   = periodFiltered.length;
    const valid   = periodFiltered.filter(l => l.status === "valid").length;
    const outside = periodFiltered.filter(l => l.status === "outside").length;
    const failed  = periodFiltered.filter(l => l.status === "failed").length;
    const flagged = periodFiltered.filter(l => l.fraudFlags && l.fraudFlags.length > 0).length;
    const pct = (n: number) => total > 0 ? Math.round(n / total * 100) : 0;
    return { total, valid, outside, failed, flagged, validPct: pct(valid), outsidePct: pct(outside), failedPct: pct(failed) };
  }, [periodFiltered]);

  const hasActiveFilters = !!selectedGuardId || !!selectedCpId || filterStatus !== "all" || !!search;

  const clearAll = () => {
    setSelectedGuardId(null);
    setSelectedCpId(null);
    setFilterStatus("all");
    setSearch("");
  };

  // ── Enhanced CSV export ────────────────────────────────────────────────────
  const exportCsv = () => {
    const header = "نگهبان,ایستگاه,زمان,عرض,طول,فاصله(م),وضعیت,حالت اسکن,هشدار تقلب";
    const rows = filtered.map(l =>
      [
        l.guardName,
        l.checkpointName,
        l.scannedAtText,
        l.gps?.lat ?? "",
        l.gps?.lng ?? "",
        l.distanceMeters ?? "",
        statusLabel[l.status ?? "failed"],
        l.scanMode ?? "",
        (l.fraudFlags ?? []).join(";"),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
    );
    const blob = new Blob(["\uFEFF" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `patrol_${periodFilter}_${new Date().toLocaleDateString("fa-IR").replace(/\//g, "-")}.csv`;
    a.click();
  };

  const periodButtons: { value: PeriodFilter; label: string }[] = [
    { value: "today", label: "امروز" },
    { value: "week",  label: "۷ روز" },
    { value: "month", label: "۳۰ روز" },
    { value: "all",   label: "همه" },
  ];

  const statusButtons: { value: StatusFilter; label: string; count: number }[] = [
    { value: "all",     label: t("common.all"),     count: periodFiltered.length },
    { value: "valid",   label: t("status.valid"),   count: periodFiltered.filter(l => l.status === "valid").length },
    { value: "outside", label: t("status.outside"), count: periodFiltered.filter(l => l.status === "outside").length },
    { value: "failed",  label: t("status.failed"),  count: periodFiltered.filter(l => l.status === "failed").length },
    ...(offlineLogs.length > 0 ? [{ value: "offline" as StatusFilter, label: t("logs.status.offline"), count: offlineLogs.length }] : []),
  ];

  return (
    <div className="space-y-4" dir={dir}>

      {/* ── Period selector ── */}
      <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border">
        <Calendar className="w-4 h-4 text-muted-foreground shrink-0 mr-1" />
        {periodButtons.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setPeriodFilter(value)}
            className={`flex-1 py-1.5 text-[13px] font-bold rounded-lg transition-colors ${
              periodFilter === value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Summary stats bar ── */}
      {!loading && stats.total > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "کل اسکن", value: stats.total,      color: "text-foreground",   bg: "bg-card",             border: "border-border" },
            { label: "موفق",    value: `${stats.valid} (${stats.validPct}%)`,   color: "text-green-400",  bg: "bg-green-500/8",  border: "border-green-500/20" },
            { label: "خارج",    value: `${stats.outside} (${stats.outsidePct}%)`, color: "text-yellow-400", bg: "bg-yellow-500/8", border: "border-yellow-500/20" },
            { label: "مشکوک",   value: stats.flagged,    color: "text-orange-400", bg: "bg-orange-500/8", border: "border-orange-500/20" },
          ].map(({ label, value, color, bg, border }) => (
            <div key={label} className={`rounded-xl border ${border} ${bg} p-2.5 text-center`}>
              <p className={`text-lg font-bold ${color} leading-tight`}>{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter toolbar ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <SelectDropdown
            label={t("logs.guard.select")}
            icon={<Users className="w-4 h-4" />}
            options={guardOptions}
            selected={selectedGuardId}
            allLabel={t("logs.guard.all")}
            emptyLabel={t("logs.no.data")}
            onSelect={setSelectedGuardId}
            accentColor="text-primary border-primary/40 bg-primary/10"
          />
          <SelectDropdown
            label={t("logs.cp.select")}
            icon={<MapPin className="w-4 h-4" />}
            options={checkpointOptions}
            selected={selectedCpId}
            allLabel={t("logs.cp.all")}
            emptyLabel={t("logs.no.data")}
            onSelect={setSelectedCpId}
            accentColor="text-sky-400 border-sky-400/40 bg-sky-500/10"
          />
          <div className="flex items-center gap-2 mr-auto">
            <button
              type="button"
              onClick={() => setShowSearch(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-[13px] transition-colors ${showSearch || search ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground hover:text-foreground"}`}
              title={t("common.search")}
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border bg-muted text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
              title="دانلود Excel/CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {(showSearch || search) && (
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t("logs.search.placeholder")}
              className="w-full bg-muted border border-border rounded-xl pr-10 pl-10 py-2.5 text-[14px] focus:outline-none focus:border-primary transition-colors"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Status filter tabs */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
          {statusButtons.map(({ value, label, count }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilterStatus(value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] font-semibold shrink-0 transition-colors ${
                filterStatus === value
                  ? value === "valid"   ? "bg-green-500/15 border-green-500/40 text-green-400"
                  : value === "outside" ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-400"
                  : value === "failed"  ? "bg-red-500/15 border-red-500/40 text-red-400"
                  : value === "offline" ? "bg-orange-500/15 border-orange-500/40 text-orange-400"
                  : "bg-primary/15 border-primary/40 text-primary"
                  : "border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:border-primary/30"
              }`}
            >
              {label}
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${filterStatus === value ? "bg-white/15" : "bg-muted"}`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="flex items-center gap-1 text-[12px] text-muted-foreground shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {t("logs.filter.active")}
            </span>
            {selectedGuardId && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/12 border border-primary/30 text-[12px] text-primary font-semibold">
                <Users className="w-3 h-3" />
                {guardOptions.find(g => g.id === selectedGuardId)?.name}
                <button type="button" onClick={() => setSelectedGuardId(null)} className="hover:text-destructive transition-colors ml-0.5"><X className="w-3 h-3" /></button>
              </span>
            )}
            {selectedCpId && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/12 border border-sky-500/30 text-[12px] text-sky-400 font-semibold">
                <MapPin className="w-3 h-3" />
                {checkpointOptions.find(c => c.id === selectedCpId)?.name}
                <button type="button" onClick={() => setSelectedCpId(null)} className="hover:text-destructive transition-colors ml-0.5"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filterStatus !== "all" && (
              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px] font-semibold ${filterStatus === "valid" ? "bg-green-500/12 border-green-500/30 text-green-400" : filterStatus === "outside" ? "bg-yellow-500/12 border-yellow-500/30 text-yellow-400" : filterStatus === "failed" ? "bg-red-500/12 border-red-500/30 text-red-400" : "bg-orange-500/12 border-orange-500/30 text-orange-400"}`}>
                {statusLabel[filterStatus as ScanStatus] ?? t("logs.status.offline")}
                <button type="button" onClick={() => setFilterStatus("all")} className="hover:text-destructive transition-colors ml-0.5"><X className="w-3 h-3" /></button>
              </span>
            )}
            {search && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border border-border text-[12px] text-foreground font-semibold">
                <Search className="w-3 h-3" />
                «{search}»
                <button type="button" onClick={() => setSearch("")} className="hover:text-destructive transition-colors ml-0.5"><X className="w-3 h-3" /></button>
              </span>
            )}
            <button type="button" onClick={clearAll}
              className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-lg hover:bg-destructive/10 mr-auto">
              <X className="w-3.5 h-3.5" />
              {t("logs.filter.clear")}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-[13px] text-muted-foreground">
            {loading ? t("common.loading") : t("logs.records", { n: filtered.length })}
            {filtered.length !== periodFiltered.length && !loading && (
              <span className="text-muted-foreground/60"> {t("logs.of", { total: periodFiltered.length })}</span>
            )}
          </p>
          {filtered.length > 0 && !loading && (
            <button type="button" onClick={exportCsv}
              className="flex items-center gap-1 text-[12px] text-primary hover:underline">
              <Download className="w-3.5 h-3.5" />
              خروجی Excel
            </button>
          )}
        </div>
      </div>

      {/* ── Log list ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">{t("common.loading")}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters || periodFilter !== "all" ? t("logs.empty.filtered") : t("logs.empty")}
          </p>
          {(hasActiveFilters || periodFilter !== "all") && (
            <button type="button" onClick={() => { clearAll(); setPeriodFilter("all"); }}
              className="text-sm text-primary hover:underline mt-1">
              {t("logs.filter.clear")}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log, i) => {
            const s   = log.status ?? (log.withinRadius ? "valid" : "outside");
            const key = log.id ?? `log-${i}`;
            const isExpanded = expandedLog === key;
            const hasFraud = log.fraudFlags && log.fraudFlags.length > 0;

            return (
              <div key={key}
                className={`rounded-xl border border-border bg-card overflow-hidden hover:border-primary/20 transition-colors ${statusBorderLeft[s]} ${hasFraud ? "border-orange-500/30" : ""}`}>
                {/* Main row */}
                <button
                  type="button"
                  className="w-full text-right"
                  onClick={() => setExpandedLog(isExpanded ? null : key)}
                >
                  <div className="p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold text-foreground truncate">{log.guardName}</p>
                        <p className="text-[13px] text-primary mt-0.5 truncate">{log.checkpointName}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        {log.offlineQueued && (
                          <span className="text-[11px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full">
                            {t("logs.offline.tag")}
                          </span>
                        )}
                        {hasFraud && (
                          <span className="flex items-center gap-1 text-[11px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full">
                            <AlertOctagon className="w-3 h-3" />
                            مشکوک
                          </span>
                        )}
                        <span className={`text-[12px] font-bold px-2.5 py-1 rounded-full border ${statusColor[s]}`}>
                          {statusLabel[s]}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        {log.scannedAtText ?? new Date(log.scanTime ?? log.scannedAt).toLocaleString("fa-IR")}
                      </span>
                      {log.gps && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                          <MapPin className="w-3 h-3" />
                          {log.gps.lat.toFixed(4)}, {log.gps.lng.toFixed(4)}
                        </span>
                      )}
                      {log.distanceMeters !== null && log.distanceMeters !== undefined && (
                        <span className={`flex items-center gap-1 text-[12px] font-semibold ${log.withinRadius ? "text-green-400" : "text-yellow-400"}`}>
                          {log.withinRadius ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                          {t("logs.meters", { n: log.distanceMeters })}
                        </span>
                      )}
                      {log.scanMode && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Layers className="w-3 h-3" />
                          {log.scanMode}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-0 border-t border-border/50 space-y-2">
                    {log.gps && (
                      <div className="flex items-center gap-2 pt-2">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-[12px] text-muted-foreground font-mono">
                          {log.gps.lat.toFixed(6)}, {log.gps.lng.toFixed(6)}
                          {log.gps.accuracy !== undefined && (
                            <span className="mr-2 text-muted-foreground/60">دقت: {Math.round(log.gps.accuracy)} م</span>
                          )}
                        </span>
                      </div>
                    )}
                    {hasFraud && (
                      <div className="flex items-start gap-2 rounded-lg bg-orange-500/8 border border-orange-500/20 px-3 py-2">
                        <AlertOctagon className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] font-bold text-orange-400 mb-1">هشدارهای ضد-تقلب</p>
                          <div className="flex flex-wrap gap-1">
                            {(log.fraudFlags ?? []).map(flag => (
                              <span key={flag} className="text-[11px] bg-orange-500/10 text-orange-300 border border-orange-500/20 px-1.5 py-0.5 rounded">
                                {FRAUD_LABEL[flag] ?? flag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {log.scanMode && (
                      <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                        <BarChart2 className="w-3.5 h-3.5" />
                        حالت اسکن: <span className="text-foreground font-medium">{log.scanMode}</span>
                      </p>
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
