import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  ArrowRight, RefreshCw, Download, Users, LogIn, LogOut,
  Clock, MapPin, Search, Filter, AlertCircle, Building2
} from "lucide-react";

interface AttendanceRecord {
  id: string;
  employeeName?: string;
  type?: "check_in" | "check_out";
  createdAtText?: string;
  createdAt?: { toDate?: () => Date; seconds?: number };
  distanceMeters?: number;
  branchName?: string;
  gps?: { lat: number; lng: number };
}

interface Props {
  records: AttendanceRecord[];
  loading: boolean;
  onRefresh: () => void;
  onBack: () => void;
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
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function isLate(r: AttendanceRecord): boolean {
  if (r.type !== "check_in") return false;
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

export default function ManagerScreen({ records, loading, onRefresh, onBack }: Props) {
  const [nameFilter, setNameFilter] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);
  const [branchFilter, setBranchFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "check_in" | "check_out">("");

  const todayRecords = useMemo(() => records.filter(isToday), [records]);

  const stats = useMemo(() => ({
    employeesToday: new Set(
      todayRecords.filter(r => r.type === "check_in").map(r => r.employeeName)
    ).size,
    checkIns: todayRecords.filter(r => r.type === "check_in").length,
    checkOuts: todayRecords.filter(r => r.type === "check_out").length,
    lateArrivals: todayRecords.filter(isLate).length,
  }), [todayRecords]);

  const branches = useMemo(() =>
    [...new Set(records.map(r => r.branchName).filter(Boolean) as string[])],
    [records]
  );

  const filtered = useMemo(() => records.filter(r => {
    if (todayOnly && !isToday(r)) return false;
    if (nameFilter.trim() && !r.employeeName?.includes(nameFilter.trim())) return false;
    if (branchFilter && r.branchName !== branchFilter) return false;
    if (typeFilter && r.type !== typeFilter) return false;
    return true;
  }), [records, todayOnly, nameFilter, branchFilter, typeFilter]);

  const exportExcel = () => {
    const rows = filtered.map(r => ({
      "نام کارمند": r.employeeName ?? "",
      "نوع": r.type === "check_in" ? "ورود" : "خروج",
      "تاریخ و ساعت": r.createdAtText ?? "",
      "فاصله از مرکز (متر)": r.distanceMeters ?? "",
      "شعبه": r.branchName ?? "",
      "عرض جغرافیایی": r.gps?.lat ?? "",
      "طول جغرافیایی": r.gps?.lng ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 20 }, { wch: 8 }, { wch: 22 }, { wch: 18 }, { wch: 15 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "حضور و غیاب");
    XLSX.writeFile(wb, `arctime-${new Date().toISOString().slice(0,10)}.xlsx`);
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
        </div>
      </div>

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
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-0.5">
                  <h3 className="font-bold">{record.employeeName ?? "—"}</h3>
                  <p className="text-xs text-white/50">{record.createdAtText ?? "نامشخص"}</p>
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

              {isLate(record) && record.type === "check_in" && (
                <div className="flex items-center gap-1.5 text-xs text-red-300 bg-red-500/10 px-3 py-1.5 rounded-xl">
                  <Clock size={11} />
                  تأخیر در ورود
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
