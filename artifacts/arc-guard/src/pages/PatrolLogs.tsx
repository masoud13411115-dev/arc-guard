import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  CheckCircle, AlertTriangle, MapPin, Clock, Download,
  Search, ChevronDown, X, Users, Shield, SlidersHorizontal,
  Loader2,
} from "lucide-react";
import { getPatrolLogs } from "@/lib/firestore";
import { getQueue } from "@/lib/offline";
import type { PatrolLog, ScanStatus } from "@/types";

interface PatrolLogsProps {
  companyId: string;
}

const statusLabel: Record<ScanStatus, string> = {
  valid: "✓ معتبر",
  outside: "⚠ خارج",
  failed: "✗ ناموفق",
};
const statusColor: Record<ScanStatus, string> = {
  valid: "bg-green-500/10 text-green-400 border-green-500/20",
  outside: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
};
const statusBorderLeft: Record<ScanStatus, string> = {
  valid: "border-r-2 border-green-500",
  outside: "border-r-2 border-yellow-400",
  failed: "border-r-2 border-red-500",
};

type StatusFilter = "all" | ScanStatus | "offline";

interface GuardOption { id: string; name: string }
interface CheckpointOption { id: string; name: string }

// ── Click-outside hook ────────────────────────────────────────────────────────
function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onClose]);
}

// ── Dropdown component ────────────────────────────────────────────────────────
interface DropdownProps {
  label: string;
  icon: React.ReactNode;
  options: { id: string; name: string }[];
  selected: string | null;
  allLabel: string;
  onSelect: (id: string | null) => void;
  accentColor?: string;
}

function SelectDropdown({ label, icon, options, selected, allLabel, onSelect, accentColor = "text-primary border-primary/40 bg-primary/10" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
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
          isActive
            ? accentColor
            : "border-border bg-muted text-muted-foreground hover:text-foreground hover:border-primary/30"
        }`}
      >
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{selectedName ?? label}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 min-w-[220px] max-w-[280px] bg-card border border-border rounded-2xl shadow-2xl z-30 overflow-hidden"
          style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {/* All option */}
          <button
            type="button"
            onClick={() => { onSelect(null); setOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-[14px] text-right transition-colors ${
              !selected
                ? "bg-primary/10 text-primary font-bold"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current shrink-0" />
            {allLabel}
            {!selected && <CheckCircle className="w-3.5 h-3.5 mr-auto text-primary" />}
          </button>

          {options.length > 0 && <div className="h-px bg-border mx-3" />}

          {options.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { onSelect(opt.id); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-[14px] text-right transition-colors ${
                selected === opt.id
                  ? "bg-primary/10 text-primary font-bold"
                  : "text-foreground hover:bg-accent"
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${selected === opt.id ? "bg-primary" : "bg-border"}`} />
              <span className="truncate">{opt.name}</span>
              {selected === opt.id && <CheckCircle className="w-3.5 h-3.5 mr-auto text-primary" />}
            </button>
          ))}

          {options.length === 0 && (
            <div className="px-4 py-4 text-center text-[13px] text-muted-foreground">
              هنوز داده‌ای موجود نیست
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PatrolLogs({ companyId }: PatrolLogsProps) {
  const [logs, setLogs] = useState<PatrolLog[]>([]);
  const [offlineLogs, setOfflineLogs] = useState<PatrolLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedGuardId, setSelectedGuardId] = useState<string | null>(null);
  const [selectedCpId, setSelectedCpId]       = useState<string | null>(null);
  const [filterStatus, setFilterStatus]        = useState<StatusFilter>("all");
  const [search, setSearch]                    = useState("");
  const [showSearch, setShowSearch]            = useState(false);

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

  // Derive unique guards from logs
  const guardOptions: GuardOption[] = useMemo(() => {
    const map = new Map<string, string>();
    allLogs.forEach(l => { if (l.guardId && l.guardName) map.set(l.guardId, l.guardName); });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "fa"));
  }, [allLogs]);

  // Derive unique checkpoints from logs
  const checkpointOptions: CheckpointOption[] = useMemo(() => {
    const map = new Map<string, string>();
    allLogs.forEach(l => { if (l.checkpointId && l.checkpointName) map.set(l.checkpointId, l.checkpointName); });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "fa"));
  }, [allLogs]);

  // Filtered logs
  const filtered = useMemo(() => allLogs.filter(log => {
    const matchGuard = !selectedGuardId || log.guardId === selectedGuardId;
    const matchCp    = !selectedCpId    || log.checkpointId === selectedCpId;
    const matchStatus =
      filterStatus === "all" ||
      (filterStatus === "offline" && log.offlineQueued) ||
      log.status === filterStatus;
    const matchSearch = !search ||
      log.guardName?.toLowerCase().includes(search.toLowerCase()) ||
      log.checkpointName?.toLowerCase().includes(search.toLowerCase());
    return matchGuard && matchCp && matchStatus && matchSearch;
  }), [allLogs, selectedGuardId, selectedCpId, filterStatus, search]);

  const hasActiveFilters = !!selectedGuardId || !!selectedCpId || filterStatus !== "all" || !!search;

  const clearAll = () => {
    setSelectedGuardId(null);
    setSelectedCpId(null);
    setFilterStatus("all");
    setSearch("");
  };

  const exportCsv = () => {
    const header = "نگهبان,ایستگاه,زمان,عرض,طول,فاصله(متر),وضعیت";
    const rows = filtered.map(l =>
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

  const statusButtons: { value: StatusFilter; label: string; count: number }[] = [
    { value: "all",     label: "همه",    count: allLogs.length },
    { value: "valid",   label: "معتبر",  count: allLogs.filter(l => l.status === "valid").length },
    { value: "outside", label: "خارج",   count: allLogs.filter(l => l.status === "outside").length },
    { value: "failed",  label: "ناموفق", count: allLogs.filter(l => l.status === "failed").length },
    ...(offlineLogs.length > 0
      ? [{ value: "offline" as StatusFilter, label: "آفلاین", count: offlineLogs.length }]
      : []),
  ];

  return (
    <div className="space-y-4" dir="rtl">

      {/* ── Filter toolbar ── */}
      <div className="space-y-3">
        {/* Row 1: dropdowns + search toggle + export */}
        <div className="flex items-center gap-2 flex-wrap">
          <SelectDropdown
            label="انتخاب نگهبان"
            icon={<Users className="w-4 h-4" />}
            options={guardOptions}
            selected={selectedGuardId}
            allLabel="همه نگهبانان"
            onSelect={setSelectedGuardId}
            accentColor="text-primary border-primary/40 bg-primary/10"
          />
          <SelectDropdown
            label="انتخاب ایستگاه"
            icon={<MapPin className="w-4 h-4" />}
            options={checkpointOptions}
            selected={selectedCpId}
            allLabel="همه ایستگاه‌ها"
            onSelect={setSelectedCpId}
            accentColor="text-sky-400 border-sky-400/40 bg-sky-500/10"
          />
          <div className="flex items-center gap-2 mr-auto">
            <button
              type="button"
              onClick={() => setShowSearch(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-[13px] transition-colors ${
                showSearch || search
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-muted text-muted-foreground hover:text-foreground"
              }`}
              title="جستجو"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border bg-muted text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
              title="دریافت CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search field — conditional */}
        {(showSearch || search) && (
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="جستجو در نام نگهبان یا ایستگاه..."
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

        {/* Row 2: Status pills */}
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
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                filterStatus === value ? "bg-white/15" : "bg-muted"
              }`}>{count}</span>
            </button>
          ))}
        </div>

        {/* ── Active filter chips ── */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="flex items-center gap-1 text-[12px] text-muted-foreground shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              فیلتر فعال:
            </span>

            {selectedGuardId && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/12 border border-primary/30 text-[12px] text-primary font-semibold">
                <Users className="w-3 h-3" />
                {guardOptions.find(g => g.id === selectedGuardId)?.name}
                <button type="button" onClick={() => setSelectedGuardId(null)}
                  className="hover:text-destructive transition-colors ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedCpId && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/12 border border-sky-500/30 text-[12px] text-sky-400 font-semibold">
                <MapPin className="w-3 h-3" />
                {checkpointOptions.find(c => c.id === selectedCpId)?.name}
                <button type="button" onClick={() => setSelectedCpId(null)}
                  className="hover:text-destructive transition-colors ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filterStatus !== "all" && (
              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px] font-semibold ${
                filterStatus === "valid"   ? "bg-green-500/12 border-green-500/30 text-green-400"
                : filterStatus === "outside" ? "bg-yellow-500/12 border-yellow-500/30 text-yellow-400"
                : filterStatus === "failed"  ? "bg-red-500/12 border-red-500/30 text-red-400"
                : "bg-orange-500/12 border-orange-500/30 text-orange-400"
              }`}>
                {statusLabel[filterStatus as ScanStatus] ?? "آفلاین"}
                <button type="button" onClick={() => setFilterStatus("all")}
                  className="hover:text-destructive transition-colors ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {search && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border border-border text-[12px] text-foreground font-semibold">
                <Search className="w-3 h-3" />
                «{search}»
                <button type="button" onClick={() => setSearch("")}
                  className="hover:text-destructive transition-colors ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button type="button" onClick={clearAll}
              className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-lg hover:bg-destructive/10 mr-auto">
              <X className="w-3.5 h-3.5" />
              پاک کردن فیلترها
            </button>
          </div>
        )}

        {/* Result count */}
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-muted-foreground">
            {loading ? "در حال بارگذاری..." : `${filtered.length} رکورد`}
            {filtered.length !== allLogs.length && !loading && (
              <span className="text-muted-foreground/60"> از {allLogs.length}</span>
            )}
          </p>
          {filtered.length > 0 && !loading && (
            <button type="button" onClick={exportCsv}
              className="flex items-center gap-1 text-[12px] text-primary hover:underline">
              <Download className="w-3.5 h-3.5" />
              دریافت CSV
            </button>
          )}
        </div>
      </div>

      {/* ── Log list ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">در حال بارگذاری...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters ? "رکوردی با این فیلترها پیدا نشد." : "هنوز هیچ اسکنی ثبت نشده است."}
          </p>
          {hasActiveFilters && (
            <button type="button" onClick={clearAll}
              className="text-sm text-primary hover:underline mt-1">
              پاک کردن فیلترها
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log, i) => {
            const s = log.status ?? (log.withinRadius ? "valid" : "outside");
            return (
              <div key={log.id ?? i}
                className={`rounded-xl border border-border bg-card overflow-hidden hover:border-primary/20 transition-colors ${statusBorderLeft[s]}`}>
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold text-foreground truncate">{log.guardName}</p>
                      <p className="text-[13px] text-primary mt-0.5 truncate">{log.checkpointName}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {log.offlineQueued && (
                        <span className="text-[11px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full">
                          آفلاین
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
                      <span className={`flex items-center gap-1 text-[12px] font-semibold ${
                        log.withinRadius ? "text-green-400" : "text-yellow-400"
                      }`}>
                        {log.withinRadius
                          ? <CheckCircle className="w-3.5 h-3.5" />
                          : <AlertTriangle className="w-3.5 h-3.5" />}
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
