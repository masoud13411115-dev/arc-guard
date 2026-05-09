import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection, addDoc, getDocs, query, orderBy,
  serverTimestamp, deleteDoc, doc
} from "firebase/firestore";
import { Plus, Clock, Trash2, RefreshCw, AlertCircle, Building2, Timer } from "lucide-react";

export interface Shift {
  id: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  allowedLateMinutes: number;
  branchId: string;
}

export default function ShiftManager() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    shiftName: "",
    startTime: "08:00",
    endTime: "17:00",
    allowedLateMinutes: "10",
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
    if (!form.shiftName.trim() || !form.startTime || !form.endTime) {
      setFormError("نام شیفت، زمان شروع و پایان الزامی هستند.");
      return;
    }
    const late = parseInt(form.allowedLateMinutes) || 0;
    setSaving(true);
    try {
      await addDoc(collection(db, "shifts"), {
        shiftName: form.shiftName.trim(),
        startTime: form.startTime,
        endTime: form.endTime,
        allowedLateMinutes: late,
        branchId: form.branchId.trim() || "all",
        createdAt: serverTimestamp(),
      });
      setForm({ shiftName: "", startTime: "08:00", endTime: "17:00", allowedLateMinutes: "10", branchId: "all" });
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
          className="glass-card p-4 flex flex-col gap-3"
          style={{ position: "relative", zIndex: 10 }}
        >
          <h3 className="text-sm font-bold text-white/80">شیفت جدید</h3>

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

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-white/50 block">زمان شروع</label>
              <input
                type="time" className="input-field h-11 text-sm"
                value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                data-testid="input-shift-start"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50 block">زمان پایان</label>
              <input
                type="time" className="input-field h-11 text-sm"
                value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                data-testid="input-shift-end"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/50 block">تأخیر مجاز (دقیقه)</label>
            <input
              type="number" inputMode="numeric"
              className="input-field h-11 text-sm" min="0" max="120"
              value={form.allowedLateMinutes}
              onChange={e => setForm(f => ({ ...f, allowedLateMinutes: e.target.value }))}
              data-testid="input-shift-late"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/50 block">شعبه (یا «all» برای همه)</label>
            <input
              type="text" inputMode="text" autoComplete="off"
              className="input-field h-11 text-sm"
              placeholder="all"
              value={form.branchId}
              onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}
              data-testid="input-shift-branch"
            />
          </div>

          {formError && <p className="text-xs text-red-400 text-center">{formError}</p>}

          <div className="grid grid-cols-2 gap-2 pt-1">
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
        shifts.map(shift => (
          <div key={shift.id} className="glass-card p-4 flex items-center justify-between gap-3" data-testid={`shift-${shift.id}`}>
            <div className="flex flex-col gap-1.5 min-w-0">
              <p className="font-bold">{shift.shiftName}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-white/55 bg-black/20 px-2.5 py-1 rounded-xl">
                  <Clock size={10} />
                  {shift.startTime} – {shift.endTime}
                </span>
                <span className="flex items-center gap-1 text-xs bg-yellow-500/15 text-yellow-300 px-2.5 py-1 rounded-xl">
                  <Timer size={10} />
                  تأخیر مجاز: {shift.allowedLateMinutes} دقیقه
                </span>
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
        ))
      )}
    </div>
  );
}
