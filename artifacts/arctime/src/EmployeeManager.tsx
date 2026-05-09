import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection, addDoc, getDocs, query, orderBy,
  serverTimestamp, deleteDoc, doc, updateDoc
} from "firebase/firestore";
import { UserPlus, Users, Trash2, RefreshCw, AlertCircle, Building2, Hash, Clock } from "lucide-react";

export interface Employee {
  id: string;
  fullName: string;
  employeeCode: string;
  branchName: string;
  branchId: string;
  shiftId?: string;
}

interface ShiftOption {
  id: string;
  shiftName: string;
  shiftType: string;
}

const SHIFT_TYPE_LABELS: Record<string, string> = {
  administrative: "اداری",
  normal: "عادی",
  smart: "هوشمند",
};

export default function EmployeeManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    employeeCode: "",
    branchName: "دفتر مرکزی",
    branchId: "arctime-demo-company|main-branch",
  });
  const [formError, setFormError] = useState("");

  const fetchAll = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const [empSnap, shiftSnap] = await Promise.all([
        getDocs(query(collection(db, "employees"), orderBy("fullName", "asc"))),
        getDocs(query(collection(db, "shifts"), orderBy("shiftName", "asc"))),
      ]);
      setEmployees(empSnap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
      setShifts(shiftSnap.docs.map(d => ({ id: d.id, shiftName: d.data().shiftName as string, shiftType: (d.data().shiftType as string) || "administrative" })));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    const { fullName, employeeCode, branchName, branchId } = form;
    if (!fullName.trim() || !employeeCode.trim() || !branchName.trim() || !branchId.trim()) {
      setFormError("همه فیلدها الزامی هستند.");
      return;
    }
    if (employees.some(emp => emp.employeeCode === employeeCode.trim())) {
      setFormError("کد کارمندی تکراری است.");
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "employees"), {
        fullName: fullName.trim(),
        employeeCode: employeeCode.trim(),
        branchName: branchName.trim(),
        branchId: branchId.trim(),
        createdAt: serverTimestamp(),
      });
      setForm({ fullName: "", employeeCode: "", branchName: "دفتر مرکزی", branchId: "arctime-demo-company|main-branch" });
      setShowForm(false);
      setFormError("");
      await fetchAll();
    } catch {
      setFormError("خطا در ذخیره‌سازی. دوباره تلاش کنید.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!db) return;
    if (!confirm("حذف این کارمند؟ این عمل قابل بازگشت نیست.")) return;
    try {
      await deleteDoc(doc(db, "employees", id));
      setEmployees(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAssignShift = async (employeeId: string, shiftId: string) => {
    if (!db) return;
    setAssigningId(employeeId);
    try {
      await updateDoc(doc(db, "employees", employeeId), { shiftId: shiftId || null });
      setEmployees(prev => prev.map(e =>
        e.id === employeeId ? { ...e, shiftId: shiftId || undefined } : e
      ));
    } catch (e) {
      console.error(e);
    }
    setAssigningId(null);
  };

  const getShiftName = (shiftId?: string) => {
    if (!shiftId) return null;
    return shifts.find(s => s.id === shiftId)?.shiftName ?? null;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-white/60">
          <Users size={14} />
          <span>{employees.length} کارمند ثبت‌شده</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => { setShowForm(v => !v); setFormError(""); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/20 text-blue-300 text-xs font-semibold hover:bg-blue-500/30 transition-colors"
            data-testid="btn-add-employee"
          >
            <UserPlus size={13} />
            افزودن کارمند
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="glass-card p-4 flex flex-col gap-3"
          style={{ position: "relative", zIndex: 10 }}
        >
          <h3 className="text-sm font-bold text-white/80 mb-1">اطلاعات کارمند جدید</h3>

          <div className="space-y-1">
            <label className="text-xs text-white/50 block">نام و نام خانوادگی</label>
            <input
              type="text" inputMode="text" autoComplete="off"
              className="input-field h-11 text-sm"
              placeholder="مثال: علی رضایی"
              value={form.fullName}
              onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
              data-testid="input-emp-fullname"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/50 block">کد کارمندی</label>
            <input
              type="text" inputMode="text" autoComplete="off"
              className="input-field h-11 text-sm"
              placeholder="مثال: EMP001"
              value={form.employeeCode}
              onChange={e => setForm(f => ({ ...f, employeeCode: e.target.value }))}
              data-testid="input-emp-code"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/50 block">نام شعبه</label>
            <input
              type="text" inputMode="text" autoComplete="off"
              className="input-field h-11 text-sm"
              placeholder="مثال: دفتر مرکزی"
              value={form.branchName}
              onChange={e => setForm(f => ({ ...f, branchName: e.target.value }))}
              data-testid="input-emp-branch-name"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/50 block">شناسه شعبه (branchId)</label>
            <input
              type="text" inputMode="text" autoComplete="off"
              className="input-field h-11 text-sm"
              placeholder="arctime-demo-company|main-branch"
              value={form.branchId}
              onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}
              data-testid="input-emp-branch-id"
            />
          </div>

          {formError && <p className="text-xs text-red-400 text-center">{formError}</p>}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary h-11 text-sm"
              data-testid="btn-save-employee"
            >
              {saving ? "در حال ذخیره..." : "ذخیره"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError(""); }}
              className="btn-secondary h-11 text-sm"
            >
              انصراف
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="glass-card p-10 flex items-center justify-center">
          <RefreshCw size={22} className="animate-spin text-white/40" />
        </div>
      ) : employees.length === 0 && !showForm ? (
        <div className="glass-card p-10 text-center text-white/50 flex flex-col items-center gap-3">
          <AlertCircle size={24} className="text-white/30" />
          <p>هنوز کارمندی ثبت نشده.</p>
          <p className="text-xs">از دکمه «افزودن کارمند» استفاده کنید.</p>
        </div>
      ) : (
        employees.map(emp => (
          <div
            key={emp.id}
            className="glass-card p-4 flex flex-col gap-3"
            data-testid={`employee-${emp.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1.5 min-w-0">
                <p className="font-bold">{emp.fullName}</p>
                <div className="flex items-center gap-1.5 text-xs text-white/50">
                  <Hash size={10} />
                  <span className="font-mono">{emp.employeeCode}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white/50">
                  <Building2 size={10} />
                  <span>{emp.branchName}</span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(emp.id)}
                className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors shrink-0 mt-0.5"
                data-testid={`btn-delete-emp-${emp.id}`}
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Shift assignment */}
            <div className="flex items-center gap-2 pt-1 border-t border-white/8">
              <Clock size={12} className="text-blue-300 shrink-0" />
              <span className="text-xs text-white/50 shrink-0">شیفت:</span>
              {shifts.length === 0 ? (
                <span className="text-xs text-white/30 italic">ابتدا شیفت تعریف کنید</span>
              ) : (
                <select
                  className="flex-1 bg-white/8 border border-white/12 rounded-xl px-2 py-1.5 text-xs text-white appearance-none cursor-pointer"
                  value={emp.shiftId ?? ""}
                  onChange={e => handleAssignShift(emp.id, e.target.value)}
                  disabled={assigningId === emp.id}
                  data-testid={`select-shift-${emp.id}`}
                >
                  <option value="">— بدون شیفت —</option>
                  {shifts.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.shiftName} ({SHIFT_TYPE_LABELS[s.shiftType] ?? s.shiftType})
                    </option>
                  ))}
                </select>
              )}
              {assigningId === emp.id && (
                <RefreshCw size={12} className="animate-spin text-blue-400 shrink-0" />
              )}
              {emp.shiftId && assigningId !== emp.id && (
                <span className="text-[10px] text-teal-400 shrink-0">✓</span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
