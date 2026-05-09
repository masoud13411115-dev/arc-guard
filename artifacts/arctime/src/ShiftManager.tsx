import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection, addDoc, getDocs, query, orderBy,
  serverTimestamp, deleteDoc, doc
} from "firebase/firestore";
import { Plus, Clock, Trash2, RefreshCw, AlertCircle, Building2, Timer, Zap, Briefcase, Brain } from "lucide-react";

export type ShiftType = "administrative" | "normal" | "smart";

export interface Shift {
  id: string;
  shiftName: string;
  shiftType: ShiftType;
  startTime?: string;
  endTime?: string;
  allowedLateMinutes?: number;
  requiredHours?: number;
  branchId: string;
}

const TYPE_CONFIG: Record<ShiftType, {
  label: string; desc: string; icon: React.ReactNode;
  active: string; badge: string;
}> = {
  administrative: {
    label: "اداری", desc: "شروع و پایان ثابت",
    icon: <Briefcase size={14} />,
    active: "bg-blue-500/20 border-blue-400/50 text-blue-300",
    badge: "bg-blue-500/15 text-blue-300",
  },
  normal: {
    label: "عادی کاری", desc: "ساعت روزانه مشخص",
    icon: <Clock size={14} />,
    active: "bg-teal-500/20 border-teal-400/50 text-teal-300",
    badge: "bg-teal-500/15 text-teal-300",
  },
  smart: {
    label: "هوشمند", desc: "بدون ساعت ثابت",
    icon: <Brain size={14} />,
    active: "bg-purple-500/20 border-purple-400/50 text-purple-300",
    badge: "bg-purple-500/15 text-purple-300",
  },
};

export default function ShiftManager() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    shiftName: "",
    shiftType: "administrative" as ShiftType,
    startTime: "08:00",
    endTime: "17:00",
    allowedLateMinutes: "10",
    requiredHours: "8",
    branchId: "all",
  });
  const [formError, setFormError] = useState("");

  const fetchShifts = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const q = query(collection(db, "shifts"), orderBy("shiftName", "asc"));
      const snap = await getDocs(q);
      setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Shift)));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchShifts(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    if (!form.shiftName.trim()) { setFormError("نام شیفت الزامی است."); return; }
    if (form.shiftType === "administrative" && (!form.startTime || !form.endTime)) {
      setFormError("زمان شروع و پایان برای شیفت اداری الزامی است."); return;
    }
    if ((form.shiftType === "normal" || form.shiftType === "smart") && !form.requiredHours) {
      setFormError("ساعت کاری روزانه الزامی است."); return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        shiftName: form.shiftName.trim(),
        shiftType: form.shiftType,
        branchId: form.branchId.trim() || "all",
        createdAt: serverTimestamp(),
      };
      if (form.shiftType === "administrative") {
        payload.startTime = form.startTime;
        payload.endTime = form.endTime;
        payload.allowedLateMinutes = parseInt(form.allowedLateMinutes) || 0;
      } else if (form.shiftType === "normal") {
        payload.requiredHours = parseFloat(form.requiredHours) || 8;
        if (form.startTime) payload.startTime = form.startTime;
        const late = parseInt(form.allowedLateMinutes);
        if (!isNaN(late) && late > 0) payload.allowedLateMinutes = late;
      } else {
        payload.requiredHours = parseFloat(form.requiredHours) || 8;
      }
      await addDoc(collection(db, "shifts"), payload);
      setForm({ shiftName: "", shiftType: "administrative", startTime: "08:00", endTime: "17:00", allowedLateMinutes: "10", requiredHours: "8", branchId: "all" });
      setShowForm(false);
      setFormError("");
      await fetchShifts();
    } catch {
      setFormError("خطا در ذخیره‌سازی.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!db) return;
    if (!confirm("حذف این شیفت؟")) return;
    try {
      await deleteDoc(doc(db, "shifts", id));
      setShifts(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-white/60">
          <Clock size={14} />
          <span>{shifts.length} شیفت تعریف‌شده</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchShifts} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => { setShowForm(v => !v); setFormError(""); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/20 text-blue-300 text-xs font-semibold hover:bg-blue-500/30 transition-colors"
            data-testid="btn-add-shift"
          >
            <Plus size={13} />
            افزودن شیفت
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="glass-card p-4 flex flex-col gap-4"
          style={{ position: "relative", zIndex: 10 }}
        >
          <h3 className="text-sm font-bold text-white/80">شیفت جدید</h3>

          {/* Shift type selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50">نوع شیفت</label>
            <div className="grid grid-cols-3 gap-2">
              {(["administrative", "normal", "smart"] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, shiftType: t }))}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-colors ${
                    form.shiftType === t
                      ? TYPE_CONFIG[t].active
                      : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
                  }`}
                  data-testid={`select-type-${t}`}
                >
                  {TYPE_CONFIG[t].icon}
                  <span className="text-[11px] font-bold leading-tight">{TYPE_CONFIG[t].label}</span>
                  <span className="text-[9px] opacity-60 leading-tight">{TYPE_CONFIG[t].desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Shift name */}
          <div className="space-y-1">
            <label className="text-xs text-white/50 block">نام شیفت</label>
            <input
              type="text" inputMode="text" autoComplete="off"
              className="input-field h-11 text-sm"
              placeholder="مثال: شیفت صبح"
              value={form.shiftName}
              onChange={e => setForm(f => ({ ...f, shiftName: e.target.value }))}
              data-testid="input-shift-name"
            />
          </div>

          {/* Administrative: start + end time */}
          {form.shiftType === "administrative" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-white/50 block">زمان شروع</label>
                <input type="time" className="input-field h-11 text-sm"
                  value={form.startTime}
                  onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                  data-testid="input-shift-start" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/50 block">زمان پایان</label>
                <input type="time" className="input-field h-11 text-sm"
                  value={form.endTime}
                  onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                  data-testid="input-shift-end" />
              </div>
            </div>
          )}

          {/* Administrative: allowed late */}
          {form.shiftType === "administrative" && (
            <div className="space-y-1">
              <label className="text-xs text-white/50 block">تأخیر مجاز (دقیقه)</label>
              <input
                type="number" inputMode="numeric" className="input-field h-11 text-sm" min="0" max="120"
                value={form.allowedLateMinutes}
                onChange={e => setForm(f => ({ ...f, allowedLateMinutes: e.target.value }))}
                data-testid="input-shift-late" />
            </div>
          )}

          {/* Normal + Smart: required daily hours */}
          {(form.shiftType === "normal" || form.shiftType === "smart") && (
            <div className="space-y-1">
              <label className="text-xs text-white/50 block">ساعت کاری روزانه</label>
              <input
                type="number" inputMode="decimal" className="input-field h-11 text-sm" min="1" max="24" step="0.5"
                placeholder="8"
                value={form.requiredHours}
                onChange={e => setForm(f => ({ ...f, requiredHours: e.target.value }))}
                data-testid="input-shift-hours" />
            </div>
          )}

          {/* Normal: optional start time + late */}
          {form.shiftType === "normal" && (
            <div className="flex flex-col gap-2">
              <label className="text-xs text-white/50">تأخیر (اختیاری)</label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-white/35 block">زمان شروع اختیاری</label>
                  <input type="time" className="input-field h-10 text-sm"
                    value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    data-testid="input-shift-start-normal" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-white/35 block">تأخیر مجاز (دقیقه)</label>
                  <input type="number" inputMode="numeric" className="input-field h-10 text-sm" min="0" max="120"
                    placeholder="0 = بدون اعمال"
                    value={form.allowedLateMinutes}
                    onChange={e => setForm(f => ({ ...f, allowedLateMinutes: e.target.value }))}
                    data-testid="input-shift-late-normal" />
                </div>
              </div>
            </div>
          )}

          {/* Branch */}
          <div className="space-y-1">
            <label className="text-xs text-white/50 block">شعبه (یا «all» برای همه)</label>
            <input
              type="text" inputMode="text" autoComplete="off"
              className="input-field h-11 text-sm" placeholder="all"
              value={form.branchId}
              onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}
              data-testid="input-shift-branch" />
          </div>

          {formError && <p className="text-xs text-red-400 text-center">{formError}</p>}

          <div className="grid grid-cols-2 gap-2">
            <button type="submit" disabled={saving} className="btn-primary h-11 text-sm" data-testid="btn-save-shift">
              {saving ? "ذخیره..." : "ذخیره"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setFormError(""); }} className="btn-secondary h-11 text-sm">
              انصراف
            </button>
          </div>
        </form>
      )}

      {shifts.length === 0 && !showForm ? (
        <div className="glass-card p-8 text-center text-white/50 flex flex-col items-center gap-2">
          <AlertCircle size={22} className="text-white/30" />
          <p className="text-sm">هنوز شیفتی تعریف نشده.</p>
        </div>
      ) : (
        shifts.map(shift => {
          const cfg = TYPE_CONFIG[shift.shiftType ?? "administrative"];
          return (
            <div key={shift.id} className="glass-card p-4 flex items-center justify-between gap-3" data-testid={`shift-${shift.id}`}>
              <div className="flex flex-col gap-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold">{shift.shiftName}</p>
                  <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                    {cfg.icon}
                    {cfg.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {shift.shiftType === "administrative" && shift.startTime && (
                    <span className="flex items-center gap-1 text-xs text-white/55 bg-black/20 px-2.5 py-1 rounded-xl">
                      <Clock size={10} />
                      {shift.startTime}{shift.endTime ? ` – ${shift.endTime}` : ""}
                    </span>
                  )}
                  {(shift.shiftType === "normal" || shift.shiftType === "smart") && shift.requiredHours && (
                    <span className="flex items-center gap-1 text-xs text-white/55 bg-black/20 px-2.5 py-1 rounded-xl">
                      <Clock size={10} />
                      {shift.requiredHours} ساعت در روز
                    </span>
                  )}
                  {shift.allowedLateMinutes != null && shift.allowedLateMinutes > 0 && (
                    <span className="flex items-center gap-1 text-xs bg-yellow-500/15 text-yellow-300 px-2.5 py-1 rounded-xl">
                      <Timer size={10} />
                      تأخیر مجاز: {shift.allowedLateMinutes} دقیقه
                    </span>
                  )}
                  {shift.shiftType === "smart" && (
                    <span className="flex items-center gap-1 text-xs bg-purple-500/15 text-purple-300 px-2.5 py-1 rounded-xl">
                      <Zap size={10} />
                      بدون محدودیت تأخیر
                    </span>
                  )}
                </div>
                {shift.branchId !== "all" && (
                  <div className="flex items-center gap-1 text-xs text-white/35 font-mono">
                    <Building2 size={9} />
                    {shift.branchId}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDelete(shift.id)}
                className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors shrink-0"
                data-testid={`btn-delete-shift-${shift.id}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
