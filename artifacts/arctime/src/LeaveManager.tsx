import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  RefreshCw, Download, CheckCircle2, XCircle, Clock, CalendarDays,
  Briefcase, FileCheck2, User, ChevronDown, ChevronUp, AlertCircle,
} from "lucide-react";
import { db } from "./firebase";
import {
  collection, getDocs, updateDoc, doc, query, orderBy, where,
} from "firebase/firestore";
import { gregToJalaliStr, todayJalali } from "./jalali";
import * as XLSX2 from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeaveRequest {
  id: string;
  companyId?: string;
  employeeCode: string;
  employeeName: string;
  branchName?: string;
  requestType: "hourly_leave" | "daily_leave" | "mission" | "excused_absence";
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  status: "pending" | "approved" | "rejected";
  createdAt?: { toDate?: () => Date; seconds?: number };
  createdAtText?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPANY_ID = "arctime-demo-company";

const REQUEST_TYPE_LABELS: Record<string, string> = {
  hourly_leave: "مرخصی ساعتی",
  daily_leave: "مرخصی روزانه",
  mission: "مأموریت",
  excused_absence: "غیبت موجه",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "در انتظار",
  approved: "تأیید شده",
  rejected: "رد شده",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function typeBadgeCls(t: string) {
  switch (t) {
    case "hourly_leave": return "bg-blue-500/15 border-blue-500/25 text-blue-300";
    case "daily_leave":  return "bg-teal-500/15 border-teal-500/25 text-teal-300";
    case "mission":      return "bg-purple-500/15 border-purple-500/25 text-purple-300";
    case "excused_absence": return "bg-amber-500/15 border-amber-500/25 text-amber-300";
    default: return "bg-white/10 border-white/15 text-white/50";
  }
}

function typeIcon(t: string) {
  switch (t) {
    case "hourly_leave": return <Clock size={10} />;
    case "daily_leave":  return <CalendarDays size={10} />;
    case "mission":      return <Briefcase size={10} />;
    case "excused_absence": return <FileCheck2 size={10} />;
    default: return <CalendarDays size={10} />;
  }
}

function statusBadgeCls(s: string) {
  switch (s) {
    case "pending":  return "bg-yellow-500/15 border-yellow-500/25 text-yellow-300";
    case "approved": return "bg-teal-500/15 border-teal-500/25 text-teal-300";
    case "rejected": return "bg-red-500/15 border-red-500/25 text-red-400";
    default: return "bg-white/10 text-white/40";
  }
}

function dateRange(req: LeaveRequest): string {
  const s = gregToJalaliStr(req.startDate);
  if (!req.endDate || req.endDate === req.startDate) {
    if (req.startTime && req.endTime) return `${s}  ${req.startTime} – ${req.endTime}`;
    return s;
  }
  const e = gregToJalaliStr(req.endDate);
  return `${s} تا ${e}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LeaveManager() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [subTab, setSubTab] = useState<"pending" | "all">("pending");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<string | null>(null);

  const toggleExpand = (id: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  async function fetchRequests() {
    if (!db) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "requests"),
        where("companyId", "==", COMPANY_ID),
        orderBy("createdAt", "desc"),
      );
      const snap = await getDocs(q);
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest)));
    } catch (e) {
      console.error("fetch requests", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRequests(); }, []);

  async function updateStatus(id: string, status: "approved" | "rejected") {
    if (!db) return;
    setProcessing(id);
    try {
      await updateDoc(doc(db, "requests", id), { status });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch (e) {
      console.error("update request", e);
    } finally {
      setProcessing(null);
    }
  }

  const visible = subTab === "pending"
    ? requests.filter(r => r.status === "pending")
    : requests;

  const pendingCount = requests.filter(r => r.status === "pending").length;

  const exportExcel = () => {
    const rows = requests.map(r => ({
      "نام کارمند": r.employeeName,
      "کد کارمندی": r.employeeCode,
      "نوع درخواست": REQUEST_TYPE_LABELS[r.requestType] ?? r.requestType,
      "تاریخ شروع": gregToJalaliStr(r.startDate),
      "تاریخ پایان": r.endDate ? gregToJalaliStr(r.endDate) : "",
      "ساعت شروع": r.startTime ?? "",
      "ساعت پایان": r.endTime ?? "",
      "توضیحات": r.description ?? "",
      "وضعیت": STATUS_LABELS[r.status] ?? r.status,
      "تاریخ ثبت": r.createdAtText ?? "",
    }));
    const ws = XLSX2.utils.json_to_sheet(rows);
    ws["!cols"] = Array(10).fill({ wch: 16 });
    const wb = XLSX2.utils.book_new();
    XLSX2.utils.book_append_sheet(wb, ws, "درخواست‌ها");
    XLSX2.writeFile(wb, `arctime-requests-${todayJalali().replace(/\//g, "-")}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-4">

      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["pending", "all"] as const).map(t => (
            <button
              key={t}
              onClick={() => setSubTab(t)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                subTab === t ? "bg-white/20 text-white" : "bg-white/8 text-white/50 hover:bg-white/12"
              }`}
            >
              {t === "pending" ? "در انتظار" : "همه"}
              {t === "pending" && pendingCount > 0 && (
                <span className="bg-yellow-400 text-black rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportExcel}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-teal-500/20 text-teal-300 text-xs font-semibold hover:bg-teal-500/30 transition-colors"
          >
            <Download size={12} />اکسل
          </button>
          <button
            onClick={fetchRequests}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* List */}
      {loading && visible.length === 0 && (
        <div className="glass-card p-8 text-center text-white/40 text-sm">در حال بارگذاری...</div>
      )}
      {!loading && visible.length === 0 && (
        <div className="glass-card p-10 flex flex-col items-center gap-3 text-white/40">
          <AlertCircle size={28} className="text-white/20" />
          <p className="text-sm">{subTab === "pending" ? "درخواست در انتظار وجود ندارد." : "هیچ درخواستی ثبت نشده."}</p>
        </div>
      )}

      {visible.map(req => {
        const isExp = expanded.has(req.id);
        const isPending = req.status === "pending";
        const isProc = processing === req.id;
        return (
          <div key={req.id} className="glass-card overflow-hidden">
            <div className="p-4 flex flex-col gap-3">
              {/* Row 1: employee + status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-bold truncate">{req.employeeName}</span>
                  <span className="text-xs text-white/45 font-mono">{req.employeeCode}</span>
                </div>
                <span className={`shrink-0 flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl border ${statusBadgeCls(req.status)}`}>
                  {STATUS_LABELS[req.status]}
                </span>
              </div>

              {/* Row 2: type badge + dates */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl border ${typeBadgeCls(req.requestType)}`}>
                  {typeIcon(req.requestType)}
                  {REQUEST_TYPE_LABELS[req.requestType]}
                </span>
                <span className="text-xs text-white/55 font-mono">{dateRange(req)}</span>
              </div>

              {/* Description (expandable) */}
              {req.description && (
                <button
                  onClick={() => toggleExpand(req.id)}
                  className="flex items-center justify-between text-xs text-white/45 hover:text-white/65 transition-colors"
                >
                  <span className={isExp ? "" : "truncate max-w-[200px]"}>
                    {isExp ? req.description : req.description}
                  </span>
                  {req.description.length > 40 && (
                    isExp ? <ChevronUp size={12} className="shrink-0" /> : <ChevronDown size={12} className="shrink-0" />
                  )}
                </button>
              )}

              {/* Approve / Reject */}
              {isPending && (
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/8">
                  <button
                    onClick={() => updateStatus(req.id, "rejected")}
                    disabled={isProc}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500/15 text-red-300 text-xs font-semibold hover:bg-red-500/25 transition-colors disabled:opacity-50"
                  >
                    <XCircle size={13} />
                    رد کردن
                  </button>
                  <button
                    onClick={() => updateStatus(req.id, "approved")}
                    disabled={isProc}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-teal-500/20 text-teal-300 text-xs font-semibold hover:bg-teal-500/30 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 size={13} />
                    تأیید
                  </button>
                </div>
              )}

              {/* Timestamp */}
              {req.createdAtText && (
                <div className="text-[10px] text-white/25 text-left">{req.createdAtText}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
