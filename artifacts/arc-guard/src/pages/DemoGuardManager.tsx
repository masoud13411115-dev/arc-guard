/**
 * DemoGuardManager — Real Test Mode guard CRUD.
 * Shown inside Manager Dashboard > Settings when Firebase is not configured.
 * All data is persisted to localStorage via demo-store.
 */

import { useState, useEffect } from "react";
import { Users, Plus, Pencil, Trash2, X, CheckCircle, Shield, Hash } from "lucide-react";
import * as demoStore from "@/lib/demo-store";
import type { UserProfile } from "@/types";

const inputClass =
  "w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors";

const EMPTY_FORM = { displayName: "", email: "", guardCode: "" };
type FormState = typeof EMPTY_FORM;

export default function DemoGuardManager() {
  const [guards, setGuards] = useState<UserProfile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editUid, setEditUid] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => demoStore.subscribeGuards(setGuards), []);

  const setF = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => {
    setEditUid(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (g: UserProfile) => {
    setEditUid(g.uid);
    setForm({ displayName: g.displayName, email: g.email, guardCode: g.guardCode ?? "" });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditUid(null); setForm(EMPTY_FORM); };

  const flash = (msg: string) => { setSavedMsg(msg); setTimeout(() => setSavedMsg(""), 3000); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.displayName.trim()) return;
    if (editUid) {
      demoStore.updateGuard(editUid, {
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        guardCode: form.guardCode.trim() || undefined,
      });
      flash("نگهبان ویرایش شد");
    } else {
      demoStore.addGuard({
        displayName: form.displayName.trim(),
        email: form.email.trim() || `guard${Date.now()}@demo.arcguard`,
        guardCode: form.guardCode.trim() || `G${String(guards.length + 1).padStart(3, "0")}`,
      });
      flash("نگهبان اضافه شد");
    }
    closeForm();
  };

  const handleDelete = (uid: string) => {
    if (deleteConfirm !== uid) { setDeleteConfirm(uid); return; }
    demoStore.deleteGuard(uid);
    setDeleteConfirm(null);
    flash("نگهبان حذف شد");
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            مدیریت نگهبانان
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{guards.length} نگهبان در حالت آزمایشی</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary-foreground bg-primary rounded-lg px-3 py-2 hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" />افزودن نگهبان
        </button>
      </div>

      {/* Feedback */}
      {savedMsg && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2.5 flex items-center gap-2 text-sm text-green-400 animate-fade-in-up">
          <CheckCircle className="w-4 h-4 shrink-0" />{savedMsg}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-primary/40 bg-card p-5 animate-fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              {editUid ? "ویرایش نگهبان" : "نگهبان جدید"}
            </h4>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">نام کامل *</label>
              <input
                value={form.displayName}
                onChange={(e) => setF("displayName", e.target.value)}
                placeholder="مثال: علی محمدی"
                required
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">ایمیل</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setF("email", e.target.value)}
                placeholder="guard@company.com"
                className={inputClass}
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Hash className="w-3 h-3" /> کد نگهبان
              </label>
              <input
                value={form.guardCode}
                onChange={(e) => setF("guardCode", e.target.value)}
                placeholder="GUARD001 (خودکار اگر خالی باشد)"
                className={inputClass + " font-mono"}
                dir="ltr"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={closeForm}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">
                انصراف
              </button>
              <button type="submit"
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity">
                {editUid ? "ذخیره تغییرات" : "افزودن"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Guard list */}
      <div className="space-y-2">
        {guards.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            هنوز نگهبانی اضافه نشده. با دکمه بالا شروع کنید.
          </div>
        )}
        {guards.map((g) => (
          <div key={g.uid}
            className="rounded-xl border border-border bg-card p-4 flex items-center gap-3 hover:border-primary/30 transition-colors">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <span className="text-base font-bold text-primary">
                {g.displayName.charAt(0)}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{g.displayName}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {g.guardCode && (
                  <span className="text-[11px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    {g.guardCode}
                  </span>
                )}
                <span className="text-xs text-muted-foreground truncate">{g.email}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => openEdit(g)}
                className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(g.uid)}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                  deleteConfirm === g.uid
                    ? "bg-destructive/10 border-destructive/40 text-destructive"
                    : "bg-muted border-border text-muted-foreground hover:text-destructive hover:border-destructive/30"
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {deleteConfirm && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-center gap-3">
            <p className="text-xs text-destructive flex-1">آیا از حذف این نگهبان مطمئنید؟</p>
            <button
              onClick={() => { if (deleteConfirm) handleDelete(deleteConfirm); }}
              className="text-xs text-destructive border border-destructive/30 rounded px-2.5 py-1 hover:bg-destructive/10 transition-colors"
            >
              بله، حذف
            </button>
            <button
              onClick={() => setDeleteConfirm(null)}
              className="text-xs text-muted-foreground border border-border rounded px-2.5 py-1 hover:bg-muted transition-colors"
            >
              انصراف
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
