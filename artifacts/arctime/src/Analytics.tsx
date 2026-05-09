import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  ChevronRight, ChevronLeft, Download, Users, LogIn, LogOut,
  Clock, AlertTriangle, BarChart2, Building2, Hash, TrendingUp, TrendingDown,
  CalendarDays, ChevronDown, ChevronUp, Timer,
} from "lucide-react";
import {
  nowJalali, addJalaliMonths, jalaliMonthRange,
  toJalaliMonthLabel, toJalaliDate,
} from "./jalali";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  isEarlyLeave?: boolean;
  earlyLeaveMinutes?: number;
  isHolidayWork?: boolean;
  holidayTitle?: string;
  isWeekendWork?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTimestamp(r: AttendanceRecord): number | null {
  if (r.createdAt?.toDate) {
    try { return r.createdAt.toDate().getTime(); } catch { /* ignore */ }
  }
  if (typeof r.createdAt?.seconds === "number") return r.createdAt.seconds * 1000;
  return null;
}

function fmtHours(h: number): string {
  const hh = Math.floor(Math.abs(h));
  const mm = Math.round((Math.abs(h) - hh) * 60);
  return `${hh}:${String(mm).padStart(2, "0")}`;
}

function fmtMin(m: number): string {
  if (m < 60) return `${m} دقیقه`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}:${String(min).padStart(2, "0")}` : `${h} ساعت`;
}

// ─── Color logic ─────────────────────────────────────────────────────────────

function hoursRatio(worked: number, required: number) {
  if (required <= 0) return -1; // no required info
  return worked / required;
}

function ratioBgBar(r: number) {
  if (r < 0) return "bg-teal-400";
  if (r >= 1) return "bg-teal-400";
  if (r >= 0.9) return "bg-yellow-400";
  return "bg-red-400";
}

function ratioTextColor(r: number) {
  if (r < 0) return "text-teal-300";
  if (r >= 1) return "text-teal-300";
  if (r >= 0.9) return "text-yellow-300";
  return "text-red-400";
}

function ratioBadge(r: number) {
  if (r < 0) return "bg-teal-500/15 border-teal-500/25";
  if (r >= 1) return "bg-teal-500/15 border-teal-500/25";
  if (r >= 0.9) return "bg-yellow-500/15 border-yellow-500/25";
  return "bg-red-500/15 border-red-500/25";
}

function lateTextColor(min: number) {
  if (min === 0) return "text-teal-300";
  if (min <= 30) return "text-yellow-300";
  return "text-red-400";
}

function lateBadgeCls(min: number) {
  if (min === 0) return "bg-teal-500/10 border-teal-500/20 text-teal-300";
  if (min <= 30) return "bg-yellow-500/15 border-yellow-500/25 text-yellow-300";
  return "bg-red-500/15 border-red-500/25 text-red-400";
}

function earlyBadgeCls(min: number) {
  if (min === 0) return "bg-teal-500/10 border-teal-500/20 text-teal-300";
  if (min <= 30) return "bg-yellow-500/15 border-yellow-500/25 text-yellow-300";
  return "bg-amber-500/15 border-amber-500/25 text-amber-300";
}

// ─── Session calculation ──────────────────────────────────────────────────────

interface DaySession {
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  workedMinutes: number;
  requiredMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  isHoliday: boolean;
  isWeekend: boolean;
}

interface EmployeeMetrics {
  workedHours: number;
  requiredHours: number;
  overtimeHours: number;
  undertimeHours: number;
  totalLateMinutes: number;
  totalEarlyLeaveMinutes: number;
  sessions: DaySession[];
}

function calcEmployeeMetrics(events: AttendanceRecord[]): EmployeeMetrics {
  const sorted = [...events].sort(
    (a, b) => (getTimestamp(a) ?? 0) - (getTimestamp(b) ?? 0)
  );
  let workedMs = 0, requiredMs = 0, overtimeMs = 0, undertimeMs = 0;
  let totalLateMin = 0, totalEarlyMin = 0;
  const sessions: DaySession[] = [];
  let openIn: AttendanceRecord | null = null;

  for (const ev of sorted) {
    const t = getTimestamp(ev);
    if (t === null) continue;
    if (ev.type === "check_in" && openIn === null) {
      openIn = ev;
    } else if (ev.type === "check_out" && openIn !== null) {
      const inT = getTimestamp(openIn);
      if (inT !== null) {
        const diff = t - inT;
        if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
          workedMs += diff;
          const stdH = openIn.standardWorkHours;
          const stdMs = stdH && stdH > 0 ? stdH * 3_600_000 : 0;
          if (stdMs > 0) {
            requiredMs += stdMs;
            if (diff > stdMs) overtimeMs += diff - stdMs;
            else undertimeMs += stdMs - diff;
          }
          const lateMin = openIn.lateMinutes ?? 0;
          const earlyMin = ev.earlyLeaveMinutes ?? 0;
          totalLateMin += lateMin;
          totalEarlyMin += earlyMin;

          const inD = new Date(inT), outD = new Date(t);
          const hm = (d: Date) =>
            `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
          sessions.push({
            date: toJalaliDate(inD),
            checkInTime: hm(inD),
            checkOutTime: hm(outD),
            workedMinutes: Math.floor(diff / 60000),
            requiredMinutes: Math.floor(stdMs / 60000),
            lateMinutes: lateMin,
            earlyLeaveMinutes: earlyMin,
            isHoliday: openIn.isHolidayWork === true || ev.isHolidayWork === true,
            isWeekend: openIn.isWeekendWork === true || ev.isWeekendWork === true,
          });
        }
      }
      openIn = null;
    }
  }
  return {
    workedHours: workedMs / 3_600_000,
    requiredHours: requiredMs / 3_600_000,
    overtimeHours: overtimeMs / 3_600_000,
    undertimeHours: undertimeMs / 3_600_000,
    totalLateMinutes: totalLateMin,
    totalEarlyLeaveMinutes: totalEarlyMin,
    sessions,
  };
}

const LATE_HOUR = 9;

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="glass-card p-4 flex flex-col gap-2">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
      <div className="text-2xl font-bold leading-none">{value}</div>
      {sub && <div className="text-xs text-white/40">{sub}</div>}
      <div className="text-xs text-white/50 leading-tight">{label}</div>
    </div>
  );
}

function MetricCell({ label, value, textCls, bgCls }: {
  label: string; value: string; textCls: string; bgCls: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-2xl py-2.5 px-1 ${bgCls}`}>
      <span className={`text-sm font-bold leading-none font-mono ${textCls}`}>{value}</span>
      <span className="text-[8px] text-white/40 text-center leading-tight">{label}</span>
    </div>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export default function Analytics({ records }: { records: AttendanceRecord[] }) {
  const initJ = nowJalali();
  const [jYear, setJYear] = useState(initJ.jy);
  const [jMonth, setJMonth] = useState(initJ.jm);
  const [expandedEmps, setExpandedEmps] = useState<Set<string>>(new Set());

  const toggleExpand = (k: string) =>
    setExpandedEmps(prev => { const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s; });

  const goPrev = () => { const r = addJalaliMonths(jYear, jMonth, -1); setJYear(r.jy); setJMonth(r.jm); };
  const goNext = () => { const r = addJalaliMonths(jYear, jMonth, 1); setJYear(r.jy); setJMonth(r.jm); };
  const nowJ = nowJalali();
  const isCurrentMonth = jYear === nowJ.jy && jMonth === nowJ.jm;

  const filtered = useMemo(() => {
    const { start, end } = jalaliMonthRange(jYear, jMonth);
    const s = start.getTime(), e = end.getTime();
    return records.filter(r => { const t = getTimestamp(r); return t !== null && t >= s && t <= e; });
  }, [records, jYear, jMonth]);

  const employeeStats = useMemo(() => {
    const map = new Map<string, { name: string; code: string; branch: string; events: AttendanceRecord[] }>();
    for (const r of filtered) {
      const key = r.employeeCode ?? r.employeeName ?? "unknown";
      if (!map.has(key)) map.set(key, { name: r.employeeName ?? "—", code: r.employeeCode ?? "—", branch: r.branchName ?? "—", events: [] });
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
      const earlyLeaves = events.filter(e => e.type === "check_out" && e.isEarlyLeave === true).length;
      const holidayWork = events.filter(e => e.isHolidayWork === true).length;
      const weekendWork = events.filter(e => e.isWeekendWork === true).length;
      const metrics = calcEmployeeMetrics(events);
      return { name, code, branch, checkIns, checkOuts, lateArrivals, earlyLeaves, holidayWork, weekendWork, ...metrics };
    }).sort((a, b) => b.checkIns - a.checkIns);
  }, [filtered]);

  const summary = useMemo(() => ({
    activeEmployees: employeeStats.length,
    totalCheckIns: employeeStats.reduce((s, e) => s + e.checkIns, 0),
    totalWorkedHours: employeeStats.reduce((s, e) => s + e.workedHours, 0),
    totalRequiredHours: employeeStats.reduce((s, e) => s + e.requiredHours, 0),
    totalOvertimeHours: employeeStats.reduce((s, e) => s + e.overtimeHours, 0),
    totalUndertimeHours: employeeStats.reduce((s, e) => s + e.undertimeHours, 0),
    totalLateMinutes: employeeStats.reduce((s, e) => s + e.totalLateMinutes, 0),
    totalEarlyLeaveMinutes: employeeStats.reduce((s, e) => s + e.totalEarlyLeaveMinutes, 0),
  }), [employeeStats]);

  const exportExcel = () => {
    const monthLabel = toJalaliMonthLabel(jYear, jMonth);
    const summaryRows = employeeStats.map(e => ({
      "ماه": monthLabel,
      "نام کارمند": e.name,
      "کد کارمندی": e.code,
      "شعبه": e.branch,
      "روز کاری": e.sessions.length,
      "کارکرد (اعشار)": Number(e.workedHours.toFixed(2)),
      "کارکرد (س:د)": fmtHours(e.workedHours),
      "نیاز (اعشار)": Number(e.requiredHours.toFixed(2)),
      "نیاز (س:د)": fmtHours(e.requiredHours),
      "اضافه‌کاری (اعشار)": Number(e.overtimeHours.toFixed(2)),
      "اضافه‌کاری (س:د)": fmtHours(e.overtimeHours),
      "کسر کاری (اعشار)": Number(e.undertimeHours.toFixed(2)),
      "کسر کاری (س:د)": fmtHours(e.undertimeHours),
      "تعداد ورود": e.checkIns,
      "تعداد خروج": e.checkOuts,
      "دفعات تأخیر": e.lateArrivals,
      "مجموع دقیقه تأخیر": e.totalLateMinutes,
      "دفعات خروج زود": e.earlyLeaves,
      "مجموع دقیقه خروج زود": e.totalEarlyLeaveMinutes,
      "کار در روز تعطیل": e.holidayWork,
      "تعطیل کاری": e.weekendWork,
    }));
    const dailyRows = employeeStats.flatMap(e =>
      e.sessions.map(s => ({
        "نام کارمند": e.name,
        "کد کارمندی": e.code,
        "تاریخ": s.date,
        "ساعت ورود": s.checkInTime ?? "—",
        "ساعت خروج": s.checkOutTime ?? "—",
        "کارکرد (دقیقه)": s.workedMinutes,
        "کارکرد (س:د)": fmtHours(s.workedMinutes / 60),
        "نیاز (دقیقه)": s.requiredMinutes,
        "تأخیر (دقیقه)": s.lateMinutes,
        "خروج زود (دقیقه)": s.earlyLeaveMinutes,
        "تعطیل رسمی": s.isHoliday ? "بله" : "خیر",
        "تعطیل کاری": s.isWeekend ? "بله" : "خیر",
      }))
    );
    const ws1 = XLSX.utils.json_to_sheet(summaryRows);
    ws1["!cols"] = Array(22).fill({ wch: 16 });
    const ws2 = XLSX.utils.json_to_sheet(dailyRows);
    ws2["!cols"] = Array(12).fill({ wch: 14 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "خلاصه ماهانه");
    XLSX.utils.book_append_sheet(wb, ws2, "جزئیات روزانه");
    XLSX.writeFile(wb, `arctime-${jYear}-${String(jMonth).padStart(2, "0")}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-4">

      {/* Month navigator */}
      <div className="glass-card p-3 flex items-center justify-between">
        <button onClick={goPrev} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors" data-testid="btn-prev-month">
          <ChevronRight size={18} />
        </button>
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-bold text-base">{toJalaliMonthLabel(jYear, jMonth)}</span>
          {isCurrentMonth && <span className="text-[10px] text-teal-400 font-semibold">ماه جاری</span>}
        </div>
        <button onClick={goNext} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors" data-testid="btn-next-month">
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Top summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard icon={<Users size={17} className="text-blue-300" />} label="کارمند فعال" value={String(summary.activeEmployees)} color="bg-blue-500/20" />
        <SummaryCard icon={<Timer size={17} className="text-teal-300" />} label="مجموع کارکرد" value={fmtHours(summary.totalWorkedHours)} sub="ساعت:دقیقه" color="bg-teal-500/20" />
        <SummaryCard icon={<LogIn size={17} className="text-indigo-300" />} label="ورود ثبت‌شده" value={String(summary.totalCheckIns)} color="bg-indigo-500/20" />
        <SummaryCard icon={<AlertTriangle size={17} className="text-red-300" />} label="مجموع تأخیر" value={summary.totalLateMinutes > 0 ? fmtMin(summary.totalLateMinutes) : "۰"} color="bg-red-500/20" />
        {summary.totalRequiredHours > 0 && (
          <SummaryCard icon={<Clock size={17} className="text-white/60" />} label="مجموع نیاز کاری" value={fmtHours(summary.totalRequiredHours)} sub="ساعت:دقیقه" color="bg-white/10" />
        )}
        {summary.totalOvertimeHours > 0 && (
          <SummaryCard icon={<TrendingUp size={17} className="text-green-300" />} label="اضافه‌کاری" value={fmtHours(summary.totalOvertimeHours)} sub="مجموع" color="bg-green-500/20" />
        )}
        {summary.totalUndertimeHours > 0 && (
          <SummaryCard icon={<TrendingDown size={17} className="text-orange-300" />} label="کسر کاری" value={fmtHours(summary.totalUndertimeHours)} sub="مجموع" color="bg-orange-500/20" />
        )}
        {summary.totalEarlyLeaveMinutes > 0 && (
          <SummaryCard icon={<LogOut size={17} className="text-amber-300" />} label="مجموع خروج زود" value={fmtMin(summary.totalEarlyLeaveMinutes)} color="bg-amber-500/20" />
        )}
      </div>

      {/* List header + export */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-white/60">
          <BarChart2 size={14} />
          <span>خلاصه ماهانه ({employeeStats.length} نفر)</span>
        </div>
        {employeeStats.length > 0 && (
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-500/20 text-teal-300 text-xs font-semibold hover:bg-teal-500/30 transition-colors" data-testid="btn-export-monthly">
            <Download size={13} />
            اکسل کامل
          </button>
        )}
      </div>

      {/* Employee cards */}
      {employeeStats.length === 0 ? (
        <div className="glass-card p-10 text-center text-white/50 flex flex-col items-center gap-3">
          <BarChart2 size={28} className="text-white/25" />
          <p>در {toJalaliMonthLabel(jYear, jMonth)} رکوردی یافت نشد.</p>
        </div>
      ) : (
        employeeStats.map((emp, i) => {
          const empKey = `${emp.code}-${i}`;
          const isExp = expandedEmps.has(empKey);
          const ratio = hoursRatio(emp.workedHours, emp.requiredHours);
          const hasReq = emp.requiredHours > 0;

          return (
            <div key={empKey} className="glass-card overflow-hidden" data-testid={`analytics-emp-${emp.code}`}>
              <div className="p-4 flex flex-col gap-3">

                {/* Identity + worked badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <p className="font-bold truncate">{emp.name}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {emp.code !== "—" && (
                        <span className="flex items-center gap-1 text-xs text-white/45 font-mono"><Hash size={9} />{emp.code}</span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-white/45"><Building2 size={9} />{emp.branch}</span>
                    </div>
                  </div>
                  <div className={`shrink-0 rounded-2xl px-3 py-1.5 text-center border ${ratioBadge(ratio)}`}>
                    <div className={`text-sm font-bold font-mono leading-none ${ratioTextColor(ratio)}`}>
                      {fmtHours(emp.workedHours)}
                    </div>
                    <div className="text-[9px] text-white/40 mt-0.5">کارکرد</div>
                  </div>
                </div>

                {/* Progress bar */}
                {hasReq && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[10px] text-white/35">
                      <span>کارکرد: {fmtHours(emp.workedHours)}</span>
                      <span>نیاز: {fmtHours(emp.requiredHours)}</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all ${ratioBgBar(ratio)}`}
                        style={{ width: `${Math.min(100, Math.max(2, ratio * 100))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className={`font-semibold ${ratioTextColor(ratio)}`}>
                        {ratio >= 1
                          ? `اضافه‌کاری: ${fmtHours(emp.overtimeHours)}`
                          : `کسر کاری: ${fmtHours(emp.undertimeHours)}`}
                      </span>
                      <span className={`font-bold ${ratioTextColor(ratio)}`}>
                        {Math.round(Math.min(ratio, 9.99) * 100)}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Hours metrics */}
                <div className="grid grid-cols-4 gap-1.5">
                  <MetricCell label="کارکرد" value={fmtHours(emp.workedHours)} textCls="text-white/80" bgCls="bg-white/6" />
                  {hasReq
                    ? <MetricCell label="نیاز" value={fmtHours(emp.requiredHours)} textCls="text-white/55" bgCls="bg-white/5" />
                    : <MetricCell label="نوع شیفت" value="هوشمند" textCls="text-purple-300" bgCls="bg-purple-500/10" />
                  }
                  <MetricCell
                    label="اضافه‌کاری"
                    value={emp.overtimeHours > 0 ? fmtHours(emp.overtimeHours) : "—"}
                    textCls={emp.overtimeHours > 0 ? "text-teal-300" : "text-white/20"}
                    bgCls={emp.overtimeHours > 0 ? "bg-teal-500/10" : "bg-white/5"}
                  />
                  <MetricCell
                    label="کسر کاری"
                    value={emp.undertimeHours > 0 ? fmtHours(emp.undertimeHours) : "—"}
                    textCls={emp.undertimeHours > 0 ? "text-red-400" : "text-white/20"}
                    bgCls={emp.undertimeHours > 0 ? "bg-red-500/10" : "bg-white/5"}
                  />
                </div>

                {/* Attendance pills */}
                <div className="grid grid-cols-4 gap-1.5">
                  <div className="flex flex-col items-center gap-1 bg-indigo-500/10 rounded-2xl py-2 px-1">
                    <LogIn size={11} className="text-indigo-300" />
                    <span className="text-sm font-bold">{emp.checkIns}</span>
                    <span className="text-[8px] text-white/40">ورود</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 bg-orange-500/10 rounded-2xl py-2 px-1">
                    <LogOut size={11} className="text-orange-300" />
                    <span className="text-sm font-bold">{emp.checkOuts}</span>
                    <span className="text-[8px] text-white/40">خروج</span>
                  </div>
                  <div className={`flex flex-col items-center gap-1 rounded-2xl py-2 px-1 ${emp.lateArrivals > 0 ? "bg-red-500/15" : "bg-white/5"}`}>
                    <AlertTriangle size={11} className={emp.lateArrivals > 0 ? "text-red-300" : "text-white/25"} />
                    <span className={`text-sm font-bold ${emp.lateArrivals > 0 ? "text-red-300" : ""}`}>{emp.lateArrivals}</span>
                    <span className="text-[8px] text-white/40">تأخیر</span>
                  </div>
                  <div className={`flex flex-col items-center gap-1 rounded-2xl py-2 px-1 ${emp.earlyLeaves > 0 ? "bg-amber-500/15" : "bg-white/5"}`}>
                    <TrendingDown size={11} className={emp.earlyLeaves > 0 ? "text-amber-300" : "text-white/25"} />
                    <span className={`text-sm font-bold ${emp.earlyLeaves > 0 ? "text-amber-300" : ""}`}>{emp.earlyLeaves}</span>
                    <span className="text-[8px] text-white/40">خروج زود</span>
                  </div>
                </div>

                {/* Minutes + special-day badges */}
                {(emp.totalLateMinutes > 0 || emp.totalEarlyLeaveMinutes > 0 || emp.holidayWork > 0 || emp.weekendWork > 0) && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/8">
                    {emp.totalLateMinutes > 0 && (
                      <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl border ${lateBadgeCls(emp.totalLateMinutes)}`}>
                        <Clock size={9} />تأخیر: {fmtMin(emp.totalLateMinutes)}
                      </span>
                    )}
                    {emp.totalEarlyLeaveMinutes > 0 && (
                      <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl border ${earlyBadgeCls(emp.totalEarlyLeaveMinutes)}`}>
                        <LogOut size={9} />خروج زود: {fmtMin(emp.totalEarlyLeaveMinutes)}
                      </span>
                    )}
                    {emp.holidayWork > 0 && (
                      <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl border bg-purple-500/15 border-purple-500/25 text-purple-300">
                        <CalendarDays size={9} />تعطیل رسمی: {emp.holidayWork}
                      </span>
                    )}
                    {emp.weekendWork > 0 && (
                      <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl border bg-amber-500/10 border-amber-500/20 text-amber-300">
                        <CalendarDays size={9} />تعطیل کاری: {emp.weekendWork}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Expandable daily sessions */}
              {emp.sessions.length > 0 && (
                <>
                  <button
                    onClick={() => toggleExpand(empKey)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-white/4 hover:bg-white/8 transition-colors border-t border-white/8 text-xs text-white/45"
                  >
                    <span>جزئیات روزانه ({emp.sessions.length} روز)</span>
                    {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {isExp && (
                    <div className="flex flex-col divide-y divide-white/6 bg-black/15">
                      {emp.sessions.map((s, si) => {
                        const sr = hoursRatio(s.workedMinutes, s.requiredMinutes);
                        return (
                          <div key={si} className="px-4 py-3 flex flex-col gap-2">
                            {/* Date row */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono text-white/65 font-semibold">{s.date}</span>
                              <div className="flex gap-1">
                                {s.isHoliday && <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-md">تعطیل رسمی</span>}
                                {s.isWeekend && <span className="text-[9px] bg-amber-500/15 text-amber-300 px-1.5 py-0.5 rounded-md">تعطیل کاری</span>}
                              </div>
                            </div>
                            {/* Times + hours */}
                            <div className="flex items-center gap-2 text-xs">
                              <span className="flex items-center gap-1 text-teal-300">
                                <LogIn size={9} />{s.checkInTime ?? "—"}
                              </span>
                              <span className="text-white/20">←</span>
                              <span className="flex items-center gap-1 text-orange-300">
                                <LogOut size={9} />{s.checkOutTime ?? "—"}
                              </span>
                              <span className="mr-auto font-mono text-white/60 font-semibold">
                                {fmtHours(s.workedMinutes / 60)}
                              </span>
                              {s.requiredMinutes > 0 && (
                                <span className={`text-[10px] font-bold ${ratioTextColor(sr)}`}>
                                  {Math.min(Math.round(sr * 100), 999)}%
                                </span>
                              )}
                            </div>
                            {/* Late / early-leave */}
                            {(s.lateMinutes > 0 || s.earlyLeaveMinutes > 0) && (
                              <div className="flex flex-wrap gap-1.5">
                                {s.lateMinutes > 0 && (
                                  <span className={`text-[10px] px-2 py-0.5 rounded-lg border ${lateBadgeCls(s.lateMinutes)}`}>
                                    تأخیر {s.lateMinutes} د
                                  </span>
                                )}
                                {s.earlyLeaveMinutes > 0 && (
                                  <span className={`text-[10px] px-2 py-0.5 rounded-lg border ${earlyBadgeCls(s.earlyLeaveMinutes)}`}>
                                    خروج زود {s.earlyLeaveMinutes} د
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
