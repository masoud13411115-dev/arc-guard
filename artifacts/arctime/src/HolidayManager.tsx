import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection, addDoc, getDocs, query, orderBy,
  serverTimestamp, deleteDoc, doc
} from "firebase/firestore";
import { Plus, CalendarDays, Trash2, RefreshCw, AlertCircle, Globe } from "lucide-react";

interface Holiday {
  id: string;
  holidayDate: string;
  holidayTitle: string;
  branchId: string;
}

export default function HolidayManager() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    holidayDate: new Date().toISOString().slice(0, 10),
    holidayTitle: "",
    branchId: "all",
  });
  const [formError, setFormError] = useState("");

  const fetchHolidays = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const q = query(collection(db, "holidays"), orderBy("holidayDate", "desc"));
      const snap = await getDocs(q);
      setHolidays(snap.docs.map(d => ({ id: d.id, ...d.data() } as Holiday)));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchHolidays(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    if (!form.holidayDate || !form.holidayTitle.trim()) {
      setFormError("تاریخ و عنوان تعطیلی الزامی هستند.");
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "holidays"), {
        holidayDate: form.holidayDate,
        holidayTitle: form.holidayTitle.trim(),
        branchId: form.branchId.trim() || "all",
        createdAt: serverTimestamp(),
      });
      setForm({ holidayDate: new Date().toISOString().slice(0, 10), holidayTitle: "", branchId: "all" });
      setShowForm(false);
      setFormError("");
      await fetchHolidays();
    } catch {
      setFormError("خطا در ذخیره‌سازی.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!db) return;
    if (!confirm("حذف این تعطیلی؟")) return;
    try {
      await deleteDoc(doc(db, "holidays", id));
      setHolidays(prev => prev.filter(h => h.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-white/60">
          <CalendarDays size={14} />
          <span>{holidays.length} تعطیلی ثبت‌شده</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchHolidays} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => { setShowForm(v => !v); setFormError(""); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/20 text-purple-300 text-xs font-semibold hover:bg-purple-500/30 transition-colors"
            data-testid="btn-add-holiday"
          >
            <Plus size={13} />
            افزودن تعطیلی
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="glass-card p-4 flex flex-col gap-3"
          style={{ position: "relative", zIndex: 10 }}
        >
          <h3 className="text-sm font-bold text-white/80">تعطیلی جدید</h3>

          <div className="space-y-1">
            <label className="text-xs text-white/50 block">تاریخ تعطیلی</label>
            <input
              type="date" className="input-field h-11 text-sm"
              value={form.holidayDate}
              onChange={e => setForm(f => ({ ...f, holidayDate: e.target.value }))}
              data-testid="input-holiday-date"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/50 block">عنوان تعطیلی</label>
            <input
              type="text" inputMode="text" autoComplete="off"
              className="input-field h-11 text-sm"
              placeholder="مثال: عید نوروز"
              value={form.holidayTitle}
              onChange={e => setForm(f => ({ ...f, holidayTitle: e.target.value }))}
              data-testid="input-holiday-title"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/50 block">شعبه (یا «all» برای همه شعب)</label>
            <input
              type="text" inputMode="text" autoComplete="off"
              className="input-field h-11 text-sm"
              placeholder="all"
              value={form.branchId}
              onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}
              data-testid="input-holiday-branch"
            />
          </div>

          {formError && <p className="text-xs text-red-400 text-center">{formError}</p>}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button type="submit" disabled={saving} className="btn-primary h-11 text-sm" data-testid="btn-save-holiday">
              {saving ? "ذخیره..." : "ذخیره"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setFormError(""); }} className="btn-secondary h-11 text-sm">
              انصراف
            </button>
          </div>
        </form>
      )}

      {holidays.length === 0 && !showForm ? (
        <div className="glass-card p-8 text-center text-white/50 flex flex-col items-center gap-2">
          <AlertCircle size={22} className="text-white/30" />
          <p className="text-sm">هنوز تعطیلی ثبت نشده.</p>
        </div>
      ) : (
        holidays.map(h => (
          <div key={h.id} className="glass-card p-4 flex items-center justify-between gap-3" data-testid={`holiday-${h.id}`}>
            <div className="flex flex-col gap-1.5 min-w-0">
              <p className="font-bold">{h.holidayTitle}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-white/50 bg-black/20 px-2.5 py-1 rounded-xl">{h.holidayDate}</span>
                <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl ${
                  h.branchId === "all"
                    ? "bg-blue-500/15 text-blue-300"
                    : "bg-white/10 text-white/50"
                }`}>
                  {h.branchId === "all" && <Globe size={9} />}
                  {h.branchId === "all" ? "همه شعب" : h.branchId}
                </span>
              </div>
            </div>
            <button
              onClick={() => handleDelete(h.id)}
              className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors shrink-0"
              data-testid={`btn-delete-holiday-${h.id}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}
