import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  ChevronRight, ChevronLeft, Download, Users, LogIn, LogOut,
  Clock, AlertTriangle, BarChart2, Building2, Hash, TrendingUp, TrendingDown
} from "lucide-react";

export interface AttendanceRecord {
  id: string;
  employeeName?: string;
  employeeCode?: string;
  type?: "check_in" | "check_out";
  createdAtText?: string;
  createdAt?: { toDate?: () => Date; seconds?: number };
  distanceMeters?: number;
  branchName?: string;
  branchId?: string;
  shiftName?: string;
  shiftType?: string;
  shiftEndTime?: string;
  standardWorkHours?: number;
  isLate?: boolean;
  lateMinutes?: number;
  isHolidayWork?: boolean;
  holidayTitle?: string;
}

const LATE_HOUR = 9;

const MONTH_NAMES_FA = [
  "ژانویه", "فوریه", "مارس", "آوریل", "مه", "ژوئن",
  "ژوئیه", "اوت", "سپتامبر", "اکتبر", "نوامبر", "دسامبر",
];

function getTimestamp(r: AttendanceRecord): number | null {
  if (r.createdAt?.toDate) {
    try { return r.createdAt.toDate().getTime(); } catch { /* ignore */ }
  }
  if (typeof r.createdAt?.seconds === "number") return r.createdAt.seconds * 1000;
  return null;
}

interface SessionMetrics {
  workedHours: number;
  overtimeHours: number;
  undertimeHours: number;
}

function calcSessionMetrics(events: AttendanceRecord[]): SessionMetrics {
  const sorted = [...events].sort(
    (a, b) => (getTimestamp(a) ?? 0) - (getTimestamp(b) ?? 0)
  );
  let workedMs = 0, overtimeMs = 0, undertimeMs = 0;
  let openCheckIn: AttendanceRecord | null = null;
  for (const ev of sorted) {
    const t = getTimestamp(ev);
    if (t === null) continue;
    if (ev.type === "check_in" && openCheckIn === null) {
      openCheckIn = ev;
    } else if (ev.type === "check_out" && openCheckIn !== null) {
      const inT = getTimestamp(openCheckIn);
      if (inT !== null) {
        const diff = t - inT;
        if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
          workedMs += diff;
          const stdH = openCheckIn.standardWorkHours;
          if (stdH && stdH > 0) {
            const stdMs = stdH * 3_600_000;
            if (diff > stdMs) overtimeMs += diff - stdMs;
            else undertimeMs += stdMs - diff;
          }
        }
      }
      openCheckIn = null;
    }
  }
  return {
    workedHours: workedMs / 3_600_000,
    overtimeHours: overtimeMs / 3_600_000,
    undertimeHours: undertimeMs / 3_600_000,
  };
}

function fmtHours(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}:${String(mm).padStart(2, "0")}`;
}

function SummaryCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="glass-card p-4 flex flex-col gap-2">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div className="text-2xl font-bold leading-none">{value}</div>
      {sub && <div className="text-xs text-white/40">{sub}</div>}
      <div className="text-xs text-white/50 leading-tight">{label}</div>
    </div>
  );
}

export default function Analytics({ records }: { records: AttendanceRecord[] }) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const goPrev = () => {
    if (selectedMonth === 0) { setSelectedYear(y => y - 1); setSelectedMonth(11); }
    else setSelectedMonth(m => m - 1);
  };
  const goNext = () => {
    if (selectedMonth === 11) { setSelectedYear(y => y + 1); setSelectedMonth(0); }
    else setSelectedMonth(m => m + 1);
  };
  const isCurrentMonth =
    selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  const filtered = useMemo(() =>
    records.filter(r => {
      const t = getTimestamp(r);
      if (t === null) return false;
      const d = new Date(t);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    }),
    [records, selectedYear, selectedMonth]
  );

  const employeeStats = useMemo(() => {
    const map = new Map<string, {
      name: string; code: string; branch: string; events: AttendanceRecord[];
    }>();
    for (const r of filtered) {
      const key = r.employeeCode ?? r.employeeName ?? "unknown";
      if (!map.has(key)) {
        map.set(key, {
          name: r.employeeName ?? "—",
          code: r.employeeCode ?? "—",
          branch: r.branchName ?? "—",
          events: [],
        });
      }
      map.get(key)!.events.push(r);
    }
    return Array.from(map.values()).map(({ name, code, branch, events }) => {
      const checkIns = events.filter(e => e.type === "check_in").length;
      const checkOuts = events.filter(e => e.type === "check_out").length;
      const lateArrivals = events.filter(e => {
        if (e.type !== "check_in") return false;
        if (e.shiftType === "smart") return false;
        if (e.isLate !== undefined) return e.isLate === true;
        const t = getTimestamp(e);
        return t !== null && new Date(t).getHours() >= LATE_HOUR;
      }).length;
      const holidayWork = events.filter(e => e.isHolidayWork === true).length;
      const metrics = calcSessionMetrics(events);
      return { name, code, branch, checkIns, checkOuts, lateArrivals, holidayWork, ...metrics };
    }).sort((a, b) => b.checkIns - a.checkIns);
  }, [filtered]);

  const summary = useMemo(() => ({
    activeEmployees: employeeStats.length,
    totalCheckIns: employeeStats.reduce((s, e) => s + e.checkIns, 0),
    totalCheckOuts: employeeStats.reduce((s, e) => s + e.checkOuts, 0),
    totalLate: employeeStats.reduce((s, e) => s + e.lateArrivals, 0),
    totalWorkedHours: employeeStats.reduce((s, e) => s + e.workedHours, 0),
    totalOvertimeHours: employeeStats.reduce((s, e) => s + e.overtimeHours, 0),
    totalUndertimeHours: employeeStats.reduce((s, e) => s + e.undertimeHours, 0),
  }), [employeeStats]);

  const exportExcel = () => {
    const monthLabel = `${MONTH_NAMES_FA[selectedMonth]} ${selectedYear}`;
    const rows = employeeStats.map(e => ({
      "ماه": monthLabel,
      "نام کارمند": e.name,
      "کد کارمندی": e.code,
      "شعبه": e.branch,
      "تعداد ورود": e.checkIns,
      "تعداد خروج": e.checkOuts,
      "تأخیر": e.lateArrivals,
      "کار در تعطیلی": e.holidayWork,
      "ساعت کارکرد": Number(e.workedHours.toFixed(2)),
      "کارکرد (ساعت:دقیقه)": fmtHours(e.workedHours),
      "اضافه‌کاری (ساعت)": Number(e.overtimeHours.toFixed(2)),
      "کسر کاری (ساعت)": Number(e.undertimeHours.toFixed(2)),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 16 },
      { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 16 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "آمار ماهانه");
    XLSX.writeFile(wb, `arctime-monthly-${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-4">

      {/* Month navigator */}
      <div className="glass-card p-3 flex items-center justify-between">
        <button
          onClick={goPrev}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
          data-testid="btn-prev-month"
        >
          <ChevronRight size={18} />
        </button>
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-bold text-base">
            {MONTH_NAMES_FA[selectedMonth]} {selectedYear}
          </span>
          {isCurrentMonth && (
            <span className="text-[10px] text-teal-400 font-semibold">ماه جاری</span>
          )}
        </div>
        <button
          onClick={goNext}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
          data-testid="btn-next-month"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard
          icon={<Users size={17} className="text-blue-300" />}
          label="کارمند فعال"
          value={String(summary.activeEmployees)}
          color="bg-blue-500/20"
        />
        <SummaryCard
          icon={<TrendingUp size={17} className="text-teal-300" />}
          label="ساعت کارکرد"
          value={fmtHours(summary.totalWorkedHours)}
          sub="مجموع"
          color="bg-teal-500/20"
        />
        <SummaryCard
          icon={<LogIn size={17} className="text-indigo-300" />}
          label="ورود ثبت‌شده"
          value={String(summary.totalCheckIns)}
          color="bg-indigo-500/20"
        />
        <SummaryCard
          icon={<AlertTriangle size={17} className="text-red-300" />}
          label="تأخیر ورود"
          value={String(summary.totalLate)}
          color="bg-red-500/20"
        />
        {summary.totalOvertimeHours > 0 && (
          <SummaryCard
            icon={<TrendingUp size={17} className="text-green-300" />}
            label="اضافه‌کاری"
            value={fmtHours(summary.totalOvertimeHours)}
            sub="مجموع"
            color="bg-green-500/20"
          />
        )}
        {summary.totalUndertimeHours > 0 && (
          <SummaryCard
            icon={<TrendingDown size={17} className="text-orange-300" />}
            label="کسر کاری"
            value={fmtHours(summary.totalUndertimeHours)}
            sub="مجموع"
            color="bg-orange-500/20"
          />
        )}
      </div>

      {/* Header row + export */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-white/60">
          <BarChart2 size={14} />
          <span>جزئیات کارمندان ({employeeStats.length} نفر)</span>
        </div>
        {employeeStats.length > 0 && (
          <button
            onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-500/20 text-teal-300 text-xs font-semibold hover:bg-teal-500/30 transition-colors"
            data-testid="btn-export-monthly"
          >
            <Download size={13} />
            اکسل ماهانه
          </button>
        )}
      </div>

      {/* Employee breakdown */}
      {employeeStats.length === 0 ? (
        <div className="glass-card p-10 text-center text-white/50 flex flex-col items-center gap-3">
          <BarChart2 size={28} className="text-white/25" />
          <p>در {MONTH_NAMES_FA[selectedMonth]} {selectedYear} رکوردی یافت نشد.</p>
        </div>
      ) : (
        employeeStats.map((emp, i) => (
          <div
            key={`${emp.code}-${i}`}
            className="glass-card p-4 flex flex-col gap-3"
            data-testid={`analytics-emp-${emp.code}`}
          >
            {/* Employee identity */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="font-bold truncate">{emp.name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {emp.code !== "—" && (
                    <span className="flex items-center gap-1 text-xs text-white/45 font-mono">
                      <Hash size={9} />
                      {emp.code}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-white/45">
                    <Building2 size={9} />
                    {emp.branch}
                  </span>
                </div>
              </div>
              {/* Worked hours badge */}
              <div className="shrink-0 bg-teal-500/15 border border-teal-500/25 rounded-2xl px-3 py-1.5 text-center">
                <div className="text-sm font-bold text-teal-300 font-mono leading-none">
                  {fmtHours(emp.workedHours)}
                </div>
                <div className="text-[9px] text-teal-400/70 mt-0.5">ساعت کار</div>
              </div>
            </div>

            {/* Overtime / undertime row */}
            {(emp.overtimeHours > 0 || emp.undertimeHours > 0) && (
              <div className="flex flex-wrap gap-2 pt-1 border-t border-white/8">
                {emp.overtimeHours > 0 && (
                  <span className="flex items-center gap-1 text-xs bg-green-500/15 text-green-300 px-2.5 py-1 rounded-xl">
                    <TrendingUp size={10} />
                    اضافه‌کاری: {fmtHours(emp.overtimeHours)}
                  </span>
                )}
                {emp.undertimeHours > 0 && (
                  <span className="flex items-center gap-1 text-xs bg-orange-500/15 text-orange-300 px-2.5 py-1 rounded-xl">
                    <TrendingDown size={10} />
                    کسر کاری: {fmtHours(emp.undertimeHours)}
                  </span>
                )}
              </div>
            )}

            {/* Stat pills */}
            <div className="grid grid-cols-4 gap-1.5">
              <div className="flex flex-col items-center gap-1 bg-indigo-500/10 rounded-2xl py-2.5 px-1">
                <LogIn size={12} className="text-indigo-300" />
                <span className="text-base font-bold leading-none">{emp.checkIns}</span>
                <span className="text-[9px] text-white/45">ورود</span>
              </div>
              <div className="flex flex-col items-center gap-1 bg-orange-500/10 rounded-2xl py-2.5 px-1">
                <LogOut size={12} className="text-orange-300" />
                <span className="text-base font-bold leading-none">{emp.checkOuts}</span>
                <span className="text-[9px] text-white/45">خروج</span>
              </div>
              <div className={`flex flex-col items-center gap-1 rounded-2xl py-2.5 px-1 ${
                emp.lateArrivals > 0 ? "bg-red-500/15" : "bg-white/5"
              }`}>
                <AlertTriangle size={12} className={emp.lateArrivals > 0 ? "text-red-300" : "text-white/30"} />
                <span className={`text-base font-bold leading-none ${emp.lateArrivals > 0 ? "text-red-300" : ""}`}>
                  {emp.lateArrivals}
                </span>
                <span className="text-[9px] text-white/45">تأخیر</span>
              </div>
              <div className={`flex flex-col items-center gap-1 rounded-2xl py-2.5 px-1 ${
                emp.holidayWork > 0 ? "bg-purple-500/15" : "bg-white/5"
              }`}>
                <Users size={12} className={emp.holidayWork > 0 ? "text-purple-300" : "text-white/30"} />
                <span className={`text-base font-bold leading-none ${emp.holidayWork > 0 ? "text-purple-300" : ""}`}>
                  {emp.holidayWork}
                </span>
                <span className="text-[9px] text-white/45">تعطیل</span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
