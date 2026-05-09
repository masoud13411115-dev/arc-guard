import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection, addDoc, getDocs, query, orderBy,
  serverTimestamp, deleteDoc, doc
} from "firebase/firestore";
import { UserPlus, Users, Trash2, RefreshCw, AlertCircle, Building2, Hash } from "lucide-react";

export interface Employee {
  id: string;
  fullName: string;
  employeeCode: string;
  branchName: string;
  branchId: string;
}

export default function EmployeeManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    employeeCode: "",
    branchName: "دفتر مرکزی",
    branchId: "arctime-demo-company|main-branch",
  });
  const [formError, setFormError] = useState("");

  const fetchEmployees = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const q = query(collection(db, "employees"), orderBy("fullName", "asc"));
      const snap = await getDocs(q);
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchEmployees(); }, []);

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
      await fetchEmployees();
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-white/60">
          <Users size={14} />
          <span>{employees.length} کارمند ثبت‌شده</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchEmployees}
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
              type="text"
              inputMode="text"
              autoComplete="off"
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
              type="text"
              inputMode="text"
              autoComplete="off"
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
              type="text"
              inputMode="text"
              autoComplete="off"
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
              type="text"
              inputMode="text"
              autoComplete="off"
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
            className="glass-card p-4 flex items-start justify-between gap-3"
            data-testid={`employee-${emp.id}`}
          >
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
        ))
      )}
    </div>
  );
}
