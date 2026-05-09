import React, { useState, useMemo } from "react";
import { toJalaliDate, todayJalali } from "./jalali";
import * as XLSX from "xlsx";
import {
  ArrowRight, RefreshCw, Download, Users, LogIn, LogOut,
  Clock, MapPin, Search, Filter, AlertCircle, Building2, UserCog, BarChart2,
  CalendarDays, Settings2
} from "lucide-react";
import EmployeeManager from "./EmployeeManager";
import Analytics from "./Analytics";
import WorkSettings from "./WorkSettings";
import LeaveManager from "./LeaveManager";

interface AttendanceRecord {
  id: string;
  employeeName?: string;
  employeeCode?: string;
  type?: "check_in" | "check_out";
  createdAtText?: string;
  createdAt?: { toDate?: () => Date; seconds?: number };
  distanceMeters?: number;
  branchName?: string;
  branchId?: string;
  qrText?: string;
  gps?: { lat: number; lng: number };
  shiftName?: string;
  shiftId?: string;
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

// Map of branch display name → identifiers used in qrText / branchId fields
const BRANCH_IDENTIFIERS: Record<string, string[]> = {
  "دفتر مرکزی": ["arctime-demo-company|main-branch", "main-branch"],
};

function matchesBranch(r: AttendanceRecord, branchFilter: string): boolean {
  if (String(r.branchName ?? "") === branchFilter) return true;
  if (String(r.branchId ?? "") === branchFilter) return true;
  const ids = BRANCH_IDENTIFIERS[branchFilter] ?? [];
  const qr = String(r.qrText ?? "");
  return ids.some(id => qr.includes(id));
}

interface Props {
  records: AttendanceRecord[];
  loading: boolean;
  onRefresh: () => void;
  onBack: () => void;
  onLogout: () => void;
}

const LATE_HOUR = 9;

function getDate(r: AttendanceRecord): Date | null {
  if (r.createdAt?.toDate) return r.createdAt.toDate();
  if (r.createdAt?.seconds) return new Date(r.createdAt.seconds * 1000);
  return null;
}

function isToday(r: AttendanceRecord): boolean {
  const d = getDate(r);
  if (!d) return false;
  return toJalaliDate(d) === todayJalali();
}

const SHIFT_TYPE_LABELS: Record<string, string> = {
  administrative: "اداری",
  normal: "عادی",
  smart: "هوشمند",
};

function computeLate(r: AttendanceRecord): boolean {
  if (r.type !== "check_in") return false;
  if (r.shiftType === "smart") return false;
  if (r.isLate !== undefined) return r.isLate === true;
  const d = getDate(r);
  if (!d) return false;
  return d.getHours() >= LATE_HOUR;
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="glass-card p-4 flex flex-col gap-2">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-white/50 leading-tight">{label}</div>
    </div>
  );
}

export default function ManagerScreen({ records, loading, onRefresh, onBack, onLogout }: Props) {
  const [nameFilter, setNameFilter] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);
  const [branchFilter, setBranchFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "check_in" | "check_out">("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "analytics" | "leaves" | "employees" | "settings">("dashboard");

  const branches = useMemo(() => {
    const names = new Set<string>();
    records.forEach(r => {
      if (r.branchName) { names.add(r.branchName); return; }
      // Fall back: derive display name from qrText / branchId
      for (const [displayName, ids] of Object.entries(BRANCH_IDENTIFIERS)) {
        const qr = String(r.qrText ?? r.branchId ?? "");
        if (ids.some(id => qr.includes(id))) { names.add(displayName); break; }
      }
    });
    return [...names];
  }, [records]);

  const filtered = useMemo(() => records.filter(r => {
    if (todayOnly && !isToday(r)) return false;
    if (nameFilter.trim() !== "") {
      const n = nameFilter.trim();
      const matchName = String(r.employeeName ?? "").includes(n);
      const matchCode = String(r.employeeCode ?? "").includes(n);
      if (!matchName && !matchCode) return false;
    }
    if (branchFilter !== "" && !matchesBranch(r, branchFilter)) return false;
    if (typeFilter !== "" && String(r.type ?? "") !== typeFilter) return false;
    return true;
  }), [records, todayOnly, nameFilter, branchFilter, typeFilter]);

  const stats = useMemo(() => ({
    employeesToday: new Set(
      filtered.filter(r => String(r.type) === "check_in" && isToday(r)).map(r => r.employeeName)
    ).size,
    checkIns: filtered.filter(r => String(r.type) === "check_in").length,
    checkOuts: filtered.filter(r => String(r.type) === "check_out").length,
    lateArrivals: filtered.filter(r => computeLate(r) && isToday(r)).length,
  }), [filtered]);

  const exportExcel = () => {
    const rows = filtered.map(r => ({
      "نام کارمند": r.employeeName ?? "",
      "کد کارمندی": r.employeeCode ?? "",
      "شیفت": r.shiftName ?? "",
      "نوع شیفت": SHIFT_TYPE_LABELS[r.shiftType ?? ""] ?? "",
      "ساعت استاندارد": r.standardWorkHours ?? "",
      "نوع": r.type === "check_in" ? "ورود" : "خروج",
      "تأخیر": r.isLate === true ? "بله" : r.isLate === false ? "خیر" : "",
      "دقیقه تأخیر": r.lateMinutes ?? "",
      "خروج زود": r.isEarlyLeave === true ? "بله" : r.isEarlyLeave === false ? "خیر" : "",
      "دقیقه خروج زود": r.earlyLeaveMinutes ?? "",
      "تاریخ و ساعت": r.createdAtText ?? "",
      "کار در روز تعطیل": r.isHolidayWork ? "بله" : "خیر",
      "تعطیل کاری": r.isWeekendWork ? "بله" : "خیر",
      "عنوان تعطیلی": r.holidayTitle ?? "",
      "فاصله از مرکز (متر)": r.distanceMeters ?? "",
      "شعبه": r.branchName ?? "",
      "عرض جغرافیایی": r.gps?.lat ?? "",
      "طول جغرافیایی": r.gps?.lng ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 10 },
      { wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 15 }, { wch: 14 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "حضور و غیاب");
    XLSX.writeFile(wb, `arctime-${todayJalali().replace(/\//g,"-")}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            data-testid="btn-back-manager"
          >
            <ArrowRight size={22} className="rotate-180" />
          </button>
          <h2 className="text-xl font-bold">داشبورد مدیریت</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/15 text-red-300 text-xs font-semibold hover:bg-red-500/25 transition-colors"
            data-testid="btn-manager-logout"
          >
            <LogOut size={13} />
            خروج از مدیریت
          </button>
          {activeTab === "dashboard" && <>
            <button
              onClick={exportExcel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-500/20 text-teal-300 text-xs font-semibold hover:bg-teal-500/30 transition-colors"
              data-testid="btn-export-excel"
            >
              <Download size={14} />
              اکسل
            </button>
            <button
              onClick={onRefresh}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              data-testid="btn-refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-2xl overflow-hidden border border-white/10">
        {(["dashboard","analytics","leaves","employees","settings"] as const).map((t, i) => {
          const labels: Record<string, string> = { dashboard: "گزارش", analytics: "آمار", leaves: "مرخصی", employees: "کارمند", settings: "تنظیم" };
          const icons: Record<string, React.ReactNode> = {
            dashboard: <Clock size={12} />, analytics: <BarChart2 size={12} />,
            leaves: <CalendarDays size={12} />, employees: <UserCog size={12} />, settings: <Settings2 size={12} />,
          };
          return (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`flex-1 flex items-center justify-center gap-1 py-3 text-[11px] font-semibold transition-colors ${i > 0 ? "border-r border-white/10" : ""} ${
                activeTab === t ? "bg-white/15 text-white" : "text-white/45 hover:text-white/70"
              }`}
              data-testid={`tab-${t}`}
            >
              {icons[t]}
              {labels[t]}
            </button>
          );
        })}
      </div>

      {activeTab === "dashboard" && <>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Users size={18} className="text-blue-300" />}
          label="کارمندان امروز"
          value={stats.employeesToday}
          color="bg-blue-500/20"
        />
        <StatCard
          icon={<LogIn size={18} className="text-teal-300" />}
          label="ورودی‌های امروز"
          value={stats.checkIns}
          color="bg-teal-500/20"
        />
        <StatCard
          icon={<LogOut size={18} className="text-orange-300" />}
          label="خروجی‌های امروز"
          value={stats.checkOuts}
          color="bg-orange-500/20"
        />
        <StatCard
          icon={<Clock size={18} className="text-red-300" />}
          label={`تأخیر (بعد از ${LATE_HOUR}:۰۰)`}
          value={stats.lateArrivals}
          color="bg-red-500/20"
        />
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white/70">
          <Filter size={14} />
          فیلترها
        </div>

        {/* Name search */}
        <div className="relative">
          <Search size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="جستجو بر اساس نام..."
            value={nameFilter}
            onChange={e => setNameFilter(e.target.value)}
            className="input-field pr-10 text-sm h-11"
            data-testid="filter-name"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as "" | "check_in" | "check_out")}
            className="input-field text-sm h-11 cursor-pointer"
            data-testid="filter-type"
          >
            <option value="">همه ورود/خروج</option>
            <option value="check_in">فقط ورود</option>
            <option value="check_out">فقط خروج</option>
          </select>

          {/* Branch filter */}
          <select
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
            className="input-field text-sm h-11 cursor-pointer"
            data-testid="filter-branch"
          >
            <option value="">همه شعب</option>
            {branches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Today toggle */}
        <button
          onClick={() => setTodayOnly(v => !v)}
          className={`flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold transition-colors ${
            todayOnly
              ? "bg-blue-500/30 text-blue-200 border border-blue-400/30"
              : "bg-white/8 text-white/60 border border-white/10"
          }`}
          data-testid="filter-today"
        >
          <Clock size={14} />
          {todayOnly ? "فقط امروز ✓" : "فقط امروز"}
        </button>
      </div>

      {/* Record count */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-white/40">{filtered.length} رکورد</span>
        {(nameFilter || todayOnly || branchFilter || typeFilter) && (
          <button
            onClick={() => { setNameFilter(""); setTodayOnly(false); setBranchFilter(""); setTypeFilter(""); }}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            پاک کردن فیلترها
          </button>
        )}
      </div>

      {/* Records list */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="glass-card p-10 flex items-center justify-center">
            <RefreshCw size={24} className="animate-spin text-white/40" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-10 text-center text-white/50 flex flex-col items-center gap-3">
            <AlertCircle size={28} className="text-white/30" />
            <p>رکوردی یافت نشد.</p>
          </div>
        ) : (
          filtered.map(record => (
            <div key={record.id} className="glass-card p-4 flex flex-col gap-3" data-testid={`record-${record.id}`}>
              <div className="flex justify-between items-start gap-2">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <h3 className="font-bold truncate">{record.employeeName ?? "—"}</h3>
                  <p className="text-xs text-white/50">{record.createdAtText ?? "نامشخص"}</p>
                  {record.shiftName && (
                    <span className="flex items-center gap-1.5 text-[10px] text-white/55 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock size={9} className="text-blue-300/60" />
                        {record.shiftName}
                      </span>
                      {record.shiftType && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${
                          record.shiftType === "administrative" ? "bg-blue-500/20 text-blue-300" :
                          record.shiftType === "normal" ? "bg-teal-500/20 text-teal-300" :
                          "bg-purple-500/20 text-purple-300"
                        }`}>
                          {SHIFT_TYPE_LABELS[record.shiftType] ?? record.shiftType}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
                  record.type === "check_in"
                    ? "bg-teal-500/20 text-teal-300"
                    : "bg-orange-500/20 text-orange-300"
                }`}>
                  {record.type === "check_in" ? "ورود" : "خروج"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5 text-xs text-white/55 bg-black/20 px-3 py-2 rounded-xl">
                  <MapPin size={11} className="text-teal-400 shrink-0" />
                  <span>{record.distanceMeters ?? "—"} متر</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white/55 bg-black/20 px-3 py-2 rounded-xl">
                  <Building2 size={11} className="text-blue-400 shrink-0" />
                  <span className="truncate">{record.branchName ?? "—"}</span>
                </div>
              </div>

              {computeLate(record) && record.type === "check_in" && (
                <div className="flex items-center gap-1.5 text-xs text-red-300 bg-red-500/10 px-3 py-1.5 rounded-xl">
                  <Clock size={11} />
                  تأخیر در ورود
                  {record.lateMinutes != null && record.lateMinutes > 0 && (
                    <span className="mr-auto font-mono">{record.lateMinutes} دقیقه</span>
                  )}
                </div>
              )}

              {record.isEarlyLeave && record.type === "check_out" && (
                <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-xl">
                  <LogOut size={11} />
                  خروج زودهنگام
                  {record.earlyLeaveMinutes != null && record.earlyLeaveMinutes > 0 && (
                    <span className="mr-auto font-mono">{record.earlyLeaveMinutes} دقیقه</span>
                  )}
                </div>
              )}

              {record.isHolidayWork && (
                <div className="flex items-center gap-1.5 text-xs text-purple-300 bg-purple-500/10 px-3 py-1.5 rounded-xl">
                  <CalendarDays size={11} />
                  کار در روز تعطیل
                  {record.holidayTitle && (
                    <span className="mr-auto text-purple-300/60">{record.holidayTitle}</span>
                  )}
                </div>
              )}

              {record.isWeekendWork && (
                <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-xl">
                  <CalendarDays size={11} />
                  تعطیل کاری
                </div>
              )}
            </div>
          ))
        )}
      </div>

      </>}

      {activeTab === "analytics" && <Analytics records={records} />}

      {activeTab === "leaves" && <LeaveManager />}

      {activeTab === "employees" && <EmployeeManager />}

      {activeTab === "settings" && <WorkSettings />}
    </div>
  );
}
