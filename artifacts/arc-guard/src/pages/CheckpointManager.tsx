import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  MapPin, Plus, QrCode, Trash2, Shield, Clock,
  CheckCircle, Pencil, X, Download, ChevronDown, ChevronUp
} from "lucide-react";
import { saveCheckpoint, updateCheckpoint, deleteCheckpoint, subscribeCheckpoints } from "@/lib/firestore";
import { getCurrentPosition } from "@/lib/gps";
import { db } from "@/firebase";
import type { Checkpoint } from "@/types";

function generateQrCode(name: string): string {
  return `ARC_GUARD_CP_${name.toUpperCase().replace(/\s+/g, "_")}_${Date.now()}`;
}

const EMPTY_FORM = {
  name: "", location: "", lat: "", lng: "",
  radiusMeters: "50", schedule: "every-2h",
};

type FormState = typeof EMPTY_FORM;

export default function CheckpointManager() {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [expandedQr, setExpandedQr] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const qrRefs = useRef<Record<string, SVGSVGElement | null>>({});

  useEffect(() => {
    if (!db) return;
    return subscribeCheckpoints(setCheckpoints);
  }, []);

  const setF = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (cp: Checkpoint) => {
    setEditId(cp.id);
    setForm({
      name: cp.name,
      location: cp.location ?? "",
      lat: String(cp.lat),
      lng: String(cp.lng),
      radiusMeters: String(cp.radiusMeters),
      schedule: "every-2h",
    });
    setShowForm(true);
    setExpandedQr(null);
  };

  const captureGps = async () => {
    setGpsLoading(true);
    try {
      const c = await getCurrentPosition();
      setF("lat", c.lat.toFixed(7));
      setF("lng", c.lng.toFixed(7));
    } catch {
      alert("دریافت GPS ممکن نشد.");
    } finally {
      setGpsLoading(false);
    }
  };

  const scheduleToMinutes = (s: string): number[] => {
    const base = new Date().getHours() * 60 + new Date().getMinutes();
    const intervals: Record<string, number> = {
      "every-1h": 60, "every-2h": 120, "every-4h": 240, "every-8h": 480,
    };
    const interval = intervals[s] ?? 120;
    const count = Math.floor(1440 / interval);
    return Array.from({ length: count }, (_, i) => (base + i * interval) % 1440);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.lat || !form.lng) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        location: form.location.trim(),
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        radiusMeters: parseInt(form.radiusMeters),
        scheduledMinutes: scheduleToMinutes(form.schedule),
        active: true,
        qrCode: editId
          ? (checkpoints.find((c) => c.id === editId)?.qrCode ?? generateQrCode(form.name))
          : generateQrCode(form.name),
      };
      if (editId) {
        await updateCheckpoint(editId, payload);
        setSavedMsg("ایستگاه با موفقیت ویرایش شد");
      } else {
        await saveCheckpoint(payload);
        setSavedMsg("ایستگاه با موفقیت ذخیره شد");
      }
      setShowForm(false);
      setEditId(null);
      setForm(EMPTY_FORM);
      setTimeout(() => setSavedMsg(""), 3000);
    } catch (err) {
      alert("خطا در ذخیره: " + err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirm !== id) { setDeleteConfirm(id); return; }
    try {
      await deleteCheckpoint(id);
      setSavedMsg("ایستگاه حذف شد");
      setTimeout(() => setSavedMsg(""), 3000);
    } catch (err) {
      alert("خطا در حذف: " + err);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const downloadQr = (cp: Checkpoint) => {
    const svg = qrRefs.current[cp.id];
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `qr_${cp.name.replace(/\s+/g, "_")}.svg`;
    a.click();
  };

  const scheduleLabel: Record<string, string> = {
    "every-1h": "هر ۱ ساعت", "every-2h": "هر ۲ ساعت",
    "every-4h": "هر ۴ ساعت", "every-8h": "هر ۸ ساعت",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">مدیریت ایستگاه‌ها</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{checkpoints.length} ایستگاه فعال</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary-foreground bg-primary rounded-lg px-3 py-2 hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" />
          افزودن ایستگاه
        </button>
      </div>

      {/* Success toast */}
      {savedMsg && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2.5 flex items-center gap-2 text-sm text-green-400 animate-fade-in-up">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {savedMsg}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-primary/40 bg-card p-5 animate-fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              {editId ? "ویرایش ایستگاه" : "ایستگاه جدید"}
            </h4>
            <button onClick={() => { setShowForm(false); setEditId(null); }}
              className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground tracking-wide">نام ایستگاه *</label>
              <input value={form.name} onChange={(e) => setF("name", e.target.value)}
                placeholder="مثال: دروازه اصلی" required
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors" />
            </div>

            {/* Location description */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground tracking-wide">توضیح موقعیت</label>
              <input value={form.location} onChange={(e) => setF("location", e.target.value)}
                placeholder="مثال: ورودی شمالی، ساختمان الف"
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors" />
            </div>

            {/* GPS row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground tracking-wide">عرض جغرافیایی *</label>
                <input value={form.lat} onChange={(e) => setF("lat", e.target.value)}
                  placeholder="35.6892" required type="number" step="any"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors font-mono" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground tracking-wide">طول جغرافیایی *</label>
                <input value={form.lng} onChange={(e) => setF("lng", e.target.value)}
                  placeholder="51.3890" required type="number" step="any"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors font-mono" />
              </div>
            </div>

            {/* GPS capture button */}
            <button type="button" onClick={captureGps} disabled={gpsLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border text-xs text-primary hover:bg-primary/10 transition-colors font-medium">
              <MapPin className="w-3.5 h-3.5" />
              {gpsLoading ? "در حال دریافت موقعیت..." : "استفاده از موقعیت GPS فعلی من"}
            </button>

            {/* Radius + Schedule */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground tracking-wide">شعاع مجاز (متر)</label>
                <select value={form.radiusMeters} onChange={(e) => setF("radiusMeters", e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors">
                  {["10","25","50","100","200"].map((v) => <option key={v} value={v}>{v} متر</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground tracking-wide">برنامه گشت</label>
                <select value={form.schedule} onChange={(e) => setF("schedule", e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors">
                  {Object.entries(scheduleLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">
                انصراف
              </button>
              <button type="submit" disabled={saving || !db}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                {saving ? "در حال ذخیره..." : editId ? "ذخیره تغییرات" : "ایجاد ایستگاه"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Checkpoint List */}
      {checkpoints.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-12 text-center">
          <Shield className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">هنوز ایستگاهی تعریف نشده</p>
          <p className="text-xs text-muted-foreground/60 mt-1">روی «افزودن ایستگاه» کلیک کنید تا اولین ایستگاه گشت را بسازید.</p>
          <button onClick={openCreate}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary border border-primary/30 rounded-lg px-4 py-2 hover:bg-primary/10 transition-colors">
            <Plus className="w-3.5 h-3.5" />
            افزودن اولین ایستگاه
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {checkpoints.map((cp) => (
            <div key={cp.id}
              className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors">
              {/* Card Header */}
              <div className="flex items-start gap-3 p-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">{cp.name}</p>
                      {cp.location && <p className="text-xs text-muted-foreground mt-0.5 truncate">{cp.location}</p>}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(cp)}
                        className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(cp.id)}
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors ${
                          deleteConfirm === cp.id
                            ? "bg-destructive/10 border-destructive/30 text-destructive"
                            : "bg-muted border-border text-muted-foreground hover:text-destructive hover:border-destructive/30"
                        }`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {deleteConfirm === cp.id && (
                    <div className="mt-2 flex items-center gap-2">
                      <p className="text-xs text-destructive flex-1">آیا مطمئنید؟</p>
                      <button onClick={() => handleDelete(cp.id)}
                        className="text-xs text-destructive border border-destructive/30 rounded px-2 py-0.5 hover:bg-destructive/10 transition-colors">
                        حذف
                      </button>
                      <button onClick={() => setDeleteConfirm(null)}
                        className="text-xs text-muted-foreground border border-border rounded px-2 py-0.5 hover:bg-muted transition-colors">
                        نه
                      </button>
                    </div>
                  )}

                  {/* Meta tags */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="flex items-center gap-1 text-xs bg-muted rounded px-2 py-0.5 text-muted-foreground font-mono">
                      <MapPin className="w-3 h-3" />
                      {cp.lat.toFixed(4)}, {cp.lng.toFixed(4)}
                    </span>
                    <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary rounded px-2 py-0.5">
                      <Shield className="w-3 h-3" />
                      شعاع: {cp.radiusMeters} متر
                    </span>
                    <span className="flex items-center gap-1 text-xs bg-muted rounded px-2 py-0.5 text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {cp.scheduledMinutes.length} بازدید/روز
                    </span>
                  </div>
                </div>
              </div>

              {/* QR Code Section */}
              <div className="border-t border-border">
                <button
                  onClick={() => setExpandedQr(expandedQr === cp.id ? null : cp.id)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground hover:bg-accent/30 transition-colors">
                  <span className="flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-primary" />
                    نمایش کد QR
                  </span>
                  {expandedQr === cp.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {expandedQr === cp.id && (
                  <div className="px-4 pb-4 animate-fade-in-up">
                    <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-xl">
                      <QRCodeSVG
                        ref={(el) => { qrRefs.current[cp.id] = el; }}
                        value={cp.qrCode}
                        size={180}
                        level="H"
                        includeMargin
                        bgColor="#ffffff"
                        fgColor="#0a1628"
                      />
                      <p className="text-xs text-gray-500 font-mono text-center break-all px-2">{cp.qrCode}</p>
                    </div>
                    <button
                      onClick={() => downloadQr(cp)}
                      className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent transition-colors">
                      <Download className="w-3.5 h-3.5" />
                      دانلود QR Code
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!db && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-400">
          Firebase پیکربندی نشده — ایستگاه‌ها فقط بصورت محلی ذخیره می‌شوند.
        </div>
      )}
    </div>
  );
}
