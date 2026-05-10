import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  MapPin, Plus, QrCode, Trash2, Shield, Clock,
  CheckCircle, Pencil, X, Download, ChevronDown, ChevronUp,
  Info, Printer, Copy
} from "lucide-react";
import { saveCheckpoint, updateCheckpoint, deleteCheckpoint, subscribeCheckpoints } from "@/lib/firestore";
import { getCurrentPosition } from "@/lib/gps";
import { isFirebaseReady } from "@/firebase";
import { DEMO_CHECKPOINTS } from "@/lib/demo";
import type { Checkpoint } from "@/types";

interface CheckpointManagerProps {
  companyId: string;
}

function generateQrCode(name: string): string {
  // Uppercase, underscored, URL-safe — scanProtection.isValidQrFormat will accept this
  const clean = name.toUpperCase().replace(/[^A-Z0-9]/g, "_").replace(/__+/g, "_");
  return `ARC_GUARD_CP_${clean}_${Date.now()}`;
}

const EMPTY_FORM = { name: "", location: "", lat: "", lng: "", radiusMeters: "50", schedule: "every-2h" };
type FormState = typeof EMPTY_FORM;

const inputClass = "w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors";

export default function CheckpointManager({ companyId }: CheckpointManagerProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [expandedQr, setExpandedQr] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const qrRefs = useRef<Record<string, SVGSVGElement | null>>({});
  const isDemo = !isFirebaseReady;

  useEffect(() => {
    if (isDemo) { setCheckpoints(DEMO_CHECKPOINTS); return; }
    return subscribeCheckpoints(companyId, setCheckpoints);
  }, [companyId, isDemo]);

  const setF = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const openCreate = () => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); setExpandedQr(null); };
  const openEdit = (cp: Checkpoint) => {
    setEditId(cp.id);
    setForm({ name: cp.name, location: cp.location ?? "", lat: String(cp.lat), lng: String(cp.lng), radiusMeters: String(cp.radiusMeters), schedule: "every-2h" });
    setShowForm(true);
    setExpandedQr(null);
  };
  const closeForm = () => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); };

  const captureGps = async () => {
    setGpsLoading(true);
    try {
      const c = await getCurrentPosition();
      setF("lat", c.lat.toFixed(7));
      setF("lng", c.lng.toFixed(7));
    } catch { alert("دریافت GPS ممکن نشد."); }
    finally { setGpsLoading(false); }
  };

  const scheduleToMinutes = (s: string): number[] => {
    const base = new Date().getHours() * 60 + new Date().getMinutes();
    const intervals: Record<string, number> = { "every-1h": 60, "every-2h": 120, "every-4h": 240, "every-8h": 480 };
    const interval = intervals[s] ?? 120;
    return Array.from({ length: Math.floor(1440 / interval) }, (_, i) => (base + i * interval) % 1440);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemo) { alert("در حالت نمونه ذخیره‌سازی غیرفعال است. Firebase را پیکربندی کنید."); return; }
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
      if (editId) { await updateCheckpoint(companyId, editId, payload); setSavedMsg("ایستگاه ویرایش شد"); }
      else { await saveCheckpoint(companyId, payload); setSavedMsg("ایستگاه ذخیره شد"); }
      closeForm();
      setTimeout(() => setSavedMsg(""), 3000);
    } catch (err) { alert("خطا: " + err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (isDemo) { alert("در حالت نمونه حذف غیرفعال است."); return; }
    if (deleteConfirm !== id) { setDeleteConfirm(id); return; }
    try {
      await deleteCheckpoint(companyId, id);
      setSavedMsg("ایستگاه حذف شد");
      setTimeout(() => setSavedMsg(""), 3000);
    } catch (err) { alert("خطا: " + err); }
    finally { setDeleteConfirm(null); }
  };

  // ── QR Download as PNG (uses canvas internally) ────────────────────────────
  const downloadQrPng = (cp: Checkpoint) => {
    const svg = qrRefs.current[cp.id];
    if (!svg) return;
    const size = 400;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size + 60; // extra space for label
    const ctx = canvas.getContext("2d")!;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Convert SVG → image
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
      // Label
      ctx.fillStyle = "#0a1628";
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "center";
      ctx.fillText(cp.name, size / 2, size + 22);
      ctx.font = "13px monospace";
      ctx.fillStyle = "#475569";
      ctx.fillText(cp.qrCode.slice(0, 45), size / 2, size + 44);
      URL.revokeObjectURL(url);
      // Download
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `qr_${cp.name.replace(/\s+/g, "_")}.png`;
      a.click();
    };
    img.src = url;
  };

  // ── QR Download as SVG ─────────────────────────────────────────────────────
  const downloadQrSvg = (cp: Checkpoint) => {
    const svg = qrRefs.current[cp.id];
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `qr_${cp.name.replace(/\s+/g, "_")}.svg`;
    a.click();
  };

  // ── Print QR ───────────────────────────────────────────────────────────────
  const printQr = (cp: Checkpoint) => {
    const svg = qrRefs.current[cp.id];
    if (!svg) return;
    const svgHtml = new XMLSerializer().serializeToString(svg);
    const win = window.open("", "_blank", "width=500,height=650");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>QR Code — ${cp.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #fff; display: flex; flex-direction: column; align-items: center; padding: 32px 24px; font-family: sans-serif; }
    .logo { font-size: 13px; color: #64748b; margin-bottom: 8px; letter-spacing: 2px; font-weight: 600; }
    .qr { border: 3px solid #0e4569; border-radius: 12px; padding: 16px; background: #fff; }
    .qr svg { display: block; width: 280px; height: 280px; }
    .name { margin-top: 18px; font-size: 22px; font-weight: 700; color: #0a1628; text-align: center; }
    .loc { margin-top: 4px; font-size: 13px; color: #64748b; text-align: center; }
    .code { margin-top: 10px; font-size: 10px; color: #94a3b8; font-family: monospace; word-break: break-all; text-align: center; max-width: 300px; }
    .badge { margin-top: 20px; background: #0f172a; color: #38bdf8; border-radius: 8px; padding: 6px 20px; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; }
    .radius { margin-top: 6px; font-size: 12px; color: #94a3b8; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="logo">ARC GUARD · سیستم هوشمند گشت امنیتی</div>
  <div class="qr">${svgHtml}</div>
  <div class="name">${cp.name}</div>
  ${cp.location ? `<div class="loc">${cp.location}</div>` : ""}
  <div class="code">${cp.qrCode}</div>
  <div class="badge">شعاع مجاز: ${cp.radiusMeters} متر</div>
  <div class="radius">${cp.scheduledMinutes.length} بازدید در ۲۴ ساعت</div>
  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }</script>
</body>
</html>`);
    win.document.close();
  };

  // ── Copy QR code text ──────────────────────────────────────────────────────
  const copyQrCode = async (cp: Checkpoint) => {
    try {
      await navigator.clipboard.writeText(cp.qrCode);
      setCopiedId(cp.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  return (
    <div className="space-y-4">
      {/* Demo notice */}
      {isDemo && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-yellow-400">حالت نمونه:</span> ایستگاه‌های زیر نمونه هستند. QR Code قابل دانلود و چاپ است. برای ایجاد ایستگاه واقعی، Firebase را متصل کنید.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">مدیریت ایستگاه‌ها</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{checkpoints.length} ایستگاه{isDemo ? " (نمونه)" : " فعال"}</p>
        </div>
        <button
          onClick={openCreate}
          disabled={isDemo}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary-foreground bg-primary rounded-lg px-3 py-2 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />افزودن ایستگاه
        </button>
      </div>

      {savedMsg && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2.5 flex items-center gap-2 text-sm text-green-400 animate-fade-in-up">
          <CheckCircle className="w-4 h-4 shrink-0" />{savedMsg}
        </div>
      )}

      {/* ── Form ── */}
      {showForm && !isDemo && (
        <div className="rounded-xl border border-primary/40 bg-card p-5 animate-fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              {editId ? "ویرایش ایستگاه" : "ایستگاه جدید"}
            </h4>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">نام ایستگاه *</label>
              <input value={form.name} onChange={(e) => setF("name", e.target.value)} placeholder="مثال: دروازه اصلی" required className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">توضیح موقعیت</label>
              <input value={form.location} onChange={(e) => setF("location", e.target.value)} placeholder="ورودی شمالی، ساختمان الف" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">عرض جغرافیایی *</label>
                <input value={form.lat} onChange={(e) => setF("lat", e.target.value)} placeholder="35.6892" required type="number" step="any" className={inputClass + " font-mono"} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">طول جغرافیایی *</label>
                <input value={form.lng} onChange={(e) => setF("lng", e.target.value)} placeholder="51.3890" required type="number" step="any" className={inputClass + " font-mono"} />
              </div>
            </div>
            <button type="button" onClick={captureGps} disabled={gpsLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border text-xs text-primary hover:bg-primary/10 transition-colors font-medium">
              <MapPin className="w-3.5 h-3.5" />
              {gpsLoading ? "در حال دریافت موقعیت..." : "استفاده از GPS فعلی"}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">شعاع مجاز (متر)</label>
                <select value={form.radiusMeters} onChange={(e) => setF("radiusMeters", e.target.value)} className={inputClass}>
                  {["10","25","50","100","200"].map((v) => <option key={v} value={v}>{v} متر</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">برنامه گشت</label>
                <select value={form.schedule} onChange={(e) => setF("schedule", e.target.value)} className={inputClass}>
                  {[["every-1h","هر ۱ ساعت"],["every-2h","هر ۲ ساعت"],["every-4h","هر ۴ ساعت"],["every-8h","هر ۸ ساعت"]].map(([v,l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={closeForm}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">انصراف</button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {saving ? "در حال ذخیره..." : editId ? "ذخیره تغییرات" : "ایجاد ایستگاه"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Checkpoint list ── */}
      <div className="space-y-3">
        {checkpoints.map((cp) => (
          <div key={cp.id} className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors">
            {/* Header */}
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
                  {!isDemo && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(cp)} className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(cp.id)}
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors ${deleteConfirm === cp.id ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-muted border-border text-muted-foreground hover:text-destructive hover:border-destructive/30"}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {deleteConfirm === cp.id && !isDemo && (
                  <div className="mt-2 flex items-center gap-2">
                    <p className="text-xs text-destructive flex-1">آیا مطمئنید؟</p>
                    <button onClick={() => handleDelete(cp.id)} className="text-xs text-destructive border border-destructive/30 rounded px-2 py-0.5 hover:bg-destructive/10">حذف</button>
                    <button onClick={() => setDeleteConfirm(null)} className="text-xs text-muted-foreground border border-border rounded px-2 py-0.5 hover:bg-muted">نه</button>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="flex items-center gap-1 text-xs bg-muted rounded px-2 py-0.5 text-muted-foreground font-mono">
                    <MapPin className="w-3 h-3" />{cp.lat.toFixed(4)}, {cp.lng.toFixed(4)}
                  </span>
                  <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary rounded px-2 py-0.5">
                    <Shield className="w-3 h-3" />شعاع: {cp.radiusMeters} متر
                  </span>
                  <span className="flex items-center gap-1 text-xs bg-muted rounded px-2 py-0.5 text-muted-foreground">
                    <Clock className="w-3 h-3" />{cp.scheduledMinutes.length} بازدید/روز
                  </span>
                </div>
              </div>
            </div>

            {/* QR expand toggle */}
            <div className="border-t border-border">
              <button
                onClick={() => setExpandedQr(expandedQr === cp.id ? null : cp.id)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground hover:bg-accent/30 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-primary" />
                  نمایش و دانلود کد QR
                </span>
                {expandedQr === cp.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {/* ── QR panel ── */}
              {expandedQr === cp.id && (
                <div className="px-4 pb-4 animate-fade-in-up space-y-3">
                  {/* QR preview */}
                  <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-border">
                    <QRCodeSVG
                      ref={(el: SVGSVGElement | null) => { qrRefs.current[cp.id] = el; }}
                      value={cp.qrCode}
                      size={200}
                      level="H"
                      includeMargin
                      bgColor="#ffffff"
                      fgColor="#0a1628"
                    />
                    <p className="text-[10px] text-gray-400 font-mono text-center break-all px-2 leading-relaxed">
                      {cp.qrCode}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => downloadQrPng(cp)}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-primary/30 bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />دانلود PNG
                    </button>
                    <button
                      onClick={() => downloadQrSvg(cp)}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-border bg-muted text-xs font-semibold text-muted-foreground hover:bg-accent transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />دانلود SVG
                    </button>
                    <button
                      onClick={() => printQr(cp)}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-border bg-muted text-xs font-semibold text-muted-foreground hover:bg-accent transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />چاپ QR
                    </button>
                    <button
                      onClick={() => copyQrCode(cp)}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg border text-xs font-semibold transition-colors ${copiedId === cp.id ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-border bg-muted text-muted-foreground hover:bg-accent"}`}
                    >
                      {copiedId === cp.id ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedId === cp.id ? "کپی شد!" : "کپی کد"}
                    </button>
                  </div>

                  {/* Security note */}
                  <div className="rounded-lg bg-muted/50 border border-border px-3 py-2.5">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      <span className="text-primary font-semibold">🔒 امنیت:</span> این کد QR فقط توسط دوربین نگهبان قابل اسکن است. ورود دستی کد مسدود می‌شود. هر ایستگاه هر ۵ دقیقه یک‌بار قابل اسکن است.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
