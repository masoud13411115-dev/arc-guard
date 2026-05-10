import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  MapPin, Plus, QrCode, Trash2, Shield, Clock,
  CheckCircle, Pencil, X, Download, ChevronDown, ChevronUp,
  Printer, Copy, Navigation, Crosshair, Info, RefreshCw,
} from "lucide-react";
import {
  saveCheckpoint as fbSaveCheckpoint,
  updateCheckpoint as fbUpdateCheckpoint,
  deleteCheckpoint as fbDeleteCheckpoint,
  subscribeCheckpoints as fbSubscribeCheckpoints,
  checkpointPath,
} from "@/lib/firestore";
import * as demoStore from "@/lib/demo-store";
import { getCurrentPosition } from "@/lib/gps";
import { isFirebaseReady } from "@/firebase";
import type { Checkpoint } from "@/types";

// ── LocalStorage backup (live mode) ──────────────────────────────────────────
const lsKey = (cid: string) => `arc_guard_v1:live_${cid}_checkpoints`;
function lsBackupSave(cid: string, cps: Checkpoint[]) {
  try { localStorage.setItem(lsKey(cid), JSON.stringify(cps)); } catch {}
}
function lsBackupLoad(cid: string): Checkpoint[] {
  try { const r = localStorage.getItem(lsKey(cid)); return r ? JSON.parse(r) : []; } catch { return []; }
}

interface CheckpointManagerProps {
  companyId: string;
}

type IntervalUnit = "minutes" | "hours";
const EMPTY_FORM = {
  name: "", location: "", lat: "", lng: "",
  radiusMeters: "50",
  intervalValue: "30",
  intervalUnit: "minutes" as IntervalUnit,
};
type FormState = typeof EMPTY_FORM;

const inputClass = "w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors";

function toIntervalMinutes(value: string, unit: IntervalUnit): number {
  const n = Math.max(1, parseInt(value) || 1);
  return unit === "hours" ? n * 60 : n;
}

function formatIntervalLabel(mins: number): string {
  if (mins < 60) return `هر ${mins} دقیقه`;
  if (mins % 60 === 0) return `هر ${mins / 60} ساعت`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `هر ${h} ساعت و ${m} دقیقه`;
}

export default function CheckpointManager({ companyId }: CheckpointManagerProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<{ id: string; path: string } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsPreview, setGpsPreview] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [expandedQr, setExpandedQr] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const qrRefs = useRef<Record<string, SVGSVGElement | null>>({});

  const isDemo = !isFirebaseReady;
  const fsPath = checkpointPath(companyId); // same path for both save and load

  // ── Subscribe to checkpoints ────────────────────────────────────────────────
  useEffect(() => {
    if (isDemo) {
      return demoStore.subscribeCheckpoints(setCheckpoints);
    }
    console.log(`[CheckpointManager] subscribing companyId=${companyId} path=${fsPath}`);
    setLoadError(null);
    return fbSubscribeCheckpoints(
      companyId,
      (cps) => {
        setCheckpoints(cps);
        setLoadError(null);
        lsBackupSave(companyId, cps); // keep local backup in sync
      },
      (err) => {
        const msg = `${err.message} (code: ${(err as { code?: string }).code ?? "unknown"})`;
        setLoadError(msg);
        // Fall back to localStorage cache so data is not lost
        const cached = lsBackupLoad(companyId);
        if (cached.length > 0) {
          setCheckpoints(cached);
        }
      },
    );
  }, [companyId, isDemo, fsPath]);

  const setF = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const flash = (msg: string) => { setSavedMsg(msg); setTimeout(() => setSavedMsg(""), 3000); };

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setGpsPreview(null);
    setShowForm(true);
    setExpandedQr(null);
  };

  const openEdit = (cp: Checkpoint) => {
    setEditId(cp.id);
    const mins = cp.patrolIntervalMinutes ?? 120;
    let intervalValue = String(mins);
    let intervalUnit: IntervalUnit = "minutes";
    if (mins >= 60 && mins % 60 === 0) {
      intervalValue = String(mins / 60);
      intervalUnit = "hours";
    }
    setForm({
      name: cp.name,
      location: cp.location ?? "",
      lat: String(cp.lat),
      lng: String(cp.lng),
      radiusMeters: String(cp.radiusMeters),
      intervalValue,
      intervalUnit,
    });
    setGpsPreview(null);
    setShowForm(true);
    setExpandedQr(null);
  };

  const closeForm = () => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); setGpsPreview(null); };

  // ── GPS capture ─────────────────────────────────────────────────────────────
  const captureGps = async () => {
    setGpsLoading(true);
    try {
      const c = await getCurrentPosition();
      setF("lat", c.lat.toFixed(7));
      setF("lng", c.lng.toFixed(7));
      setGpsPreview({ lat: c.lat, lng: c.lng, accuracy: c.accuracy });
    } catch {
      alert("دریافت GPS ممکن نشد. مجوز مکان را در مرورگر فعال کنید.");
    } finally {
      setGpsLoading(false);
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.lat || !form.lng) return;

    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (isNaN(lat) || isNaN(lng)) { alert("مختصات GPS معتبر نیست."); return; }

    setSaving(true);
    setDebugInfo(null);
    try {
      // qrCode is NOT included — each storage layer generates it using the checkpoint ID
      const payload: Omit<Checkpoint, 'id' | 'createdAt' | 'companyId' | 'qrCode'> = {
        name: form.name.trim(),
        location: form.location.trim(),
        lat,
        lng,
        radiusMeters: parseInt(form.radiusMeters),
        patrolIntervalMinutes: toIntervalMinutes(form.intervalValue, form.intervalUnit),
        active: true,
      };

      if (isDemo) {
        if (editId) {
          demoStore.updateCheckpoint(editId, payload);
          flash("ایستگاه ویرایش شد");
        } else {
          const newCp = demoStore.addCheckpoint(payload);
          setDebugInfo({ id: newCp.id, path: `localStorage (demo) — companyId: demo-company | QR: ${newCp.qrCode}` });
          flash("ایستگاه اضافه شد");
        }
        closeForm();
      } else {
        if (editId) {
          await fbUpdateCheckpoint(companyId, editId, payload);
          // Optimistic: update list immediately (subscription will confirm later)
          setCheckpoints((prev) => prev.map((c) => c.id === editId ? { ...c, ...payload } : c));
          flash("ایستگاه ویرایش شد");
          closeForm();
        } else {
          const newId = await fbSaveCheckpoint(companyId, payload);
          const savedPath = `${fsPath}/${newId}`;
          // QR code is ARCG|{companyId}|{checkpointId} — same formula used in firestore.ts
          const qrCode = `ARCG|${companyId}|${newId}`;
          console.log(`[CheckpointManager] checkpoint saved — id=${newId} companyId=${companyId} path=${savedPath} qr=${qrCode}`);
          // Optimistic: add to list immediately so QR appears without waiting for subscription
          const newCp: Checkpoint = {
            ...payload, id: newId, companyId, qrCode, createdAt: Date.now(),
          };
          setCheckpoints((prev) => {
            const updated = [...prev, newCp];
            lsBackupSave(companyId, updated); // keep backup in sync
            return updated;
          });
          setDebugInfo({
            id: newId,
            path: `save: ${savedPath} | load: ${fsPath} (companyId: ${companyId}) | QR: ${qrCode}`,
          });
          setExpandedQr(newId); // auto-open QR for new checkpoint
          flash("ایستگاه ذخیره شد ✓");
          closeForm();
        }
      }
    } catch (err) {
      console.error("[CheckpointManager] save error:", err);
      alert("خطا در ذخیره:\n" + String(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (deleteConfirm !== id) { setDeleteConfirm(id); return; }
    try {
      if (isDemo) {
        demoStore.deleteCheckpoint(id);
      } else {
        await fbDeleteCheckpoint(companyId, id);
      }
      flash("ایستگاه حذف شد");
    } catch (err) {
      alert("خطا: " + err);
    } finally {
      setDeleteConfirm(null);
    }
  };

  // ── QR download PNG ─────────────────────────────────────────────────────────
  const downloadQrPng = (cp: Checkpoint) => {
    const svg = qrRefs.current[cp.id];
    if (!svg) return;
    const size = 400;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size + 70;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
      ctx.fillStyle = "#0a1628";
      ctx.font = "bold 20px Arial";
      ctx.textAlign = "center";
      ctx.fillText(cp.name, size / 2, size + 26);
      if (cp.location) {
        ctx.font = "13px Arial";
        ctx.fillStyle = "#475569";
        ctx.fillText(cp.location, size / 2, size + 44);
      }
      ctx.font = "11px monospace";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(cp.qrCode.slice(0, 50), size / 2, size + 62);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `qr_${cp.name.replace(/\s+/g, "_")}.png`;
      a.click();
    };
    img.src = url;
  };

  const downloadQrSvg = (cp: Checkpoint) => {
    const svg = qrRefs.current[cp.id];
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `qr_${cp.name.replace(/\s+/g, "_")}.svg`;
    a.click();
  };

  const printQr = (cp: Checkpoint) => {
    const svg = qrRefs.current[cp.id];
    if (!svg) return;
    const svgHtml = new XMLSerializer().serializeToString(svg);
    const win = window.open("", "_blank", "width=500,height=700");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>QR — ${cp.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #fff; display: flex; flex-direction: column; align-items: center; padding: 32px 24px; font-family: sans-serif; }
    .logo { font-size: 12px; color: #64748b; margin-bottom: 10px; letter-spacing: 2px; font-weight: 600; }
    .qr { border: 3px solid #0e4569; border-radius: 12px; padding: 16px; background: #fff; }
    .qr svg { display: block; width: 280px; height: 280px; }
    .name { margin-top: 18px; font-size: 22px; font-weight: 700; color: #0a1628; text-align: center; }
    .loc { margin-top: 4px; font-size: 13px; color: #64748b; text-align: center; }
    .code { margin-top: 8px; font-size: 10px; color: #94a3b8; font-family: monospace; word-break: break-all; text-align: center; max-width: 300px; }
    .badge { margin-top: 16px; background: #0f172a; color: #38bdf8; border-radius: 8px; padding: 6px 20px; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; }
    .gps { margin-top: 6px; font-size: 11px; color: #94a3b8; font-family: monospace; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="logo">ARC GUARD · سیستم هوشمند گشت امنیتی</div>
  <div class="qr">${svgHtml}</div>
  <div class="name">${cp.name}</div>
  ${cp.location ? `<div class="loc">${cp.location}</div>` : ""}
  <div class="code">${cp.qrCode}</div>
  <div class="badge">شعاع: ${cp.radiusMeters} متر · بازه: ${formatIntervalLabel(cp.patrolIntervalMinutes)}</div>
  <div class="gps">${cp.lat.toFixed(6)}, ${cp.lng.toFixed(6)}</div>
  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\/script>
</body>
</html>`);
    win.document.close();
  };

  const copyQrCode = async (cp: Checkpoint) => {
    try {
      await navigator.clipboard.writeText(cp.qrCode);
      setCopiedId(cp.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Demo mode banner */}
      {isDemo && (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 px-4 py-3 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-sky-400">حالت آزمایشی:</span>{" "}
            ایستگاه‌ها در مرورگر ذخیره می‌شوند. QR کدهای تولید شده توسط نگهبان (دمو) قابل اسکن هستند.
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">مدیریت ایستگاه‌ها</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {checkpoints.length} ایستگاه{isDemo ? " (آزمایشی — در مرورگر)" : " فعال"}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary-foreground bg-primary rounded-lg px-3 py-2 hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" />افزودن ایستگاه
        </button>
      </div>

      {/* Load error banner */}
      {loadError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-red-400">خطا در بارگذاری ایستگاه‌ها از Firebase:</p>
            <p className="text-xs text-muted-foreground mt-0.5 break-words">{loadError}</p>
            {!isDemo && (
              <p className="text-[11px] text-muted-foreground mt-1 font-mono">
                مسیر: {fsPath}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Success message */}
      {savedMsg && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2.5 flex items-center gap-2 text-sm text-green-400 animate-fade-in-up">
          <CheckCircle className="w-4 h-4 shrink-0" />{savedMsg}
        </div>
      )}

      {/* Debug info — shown after each save */}
      {debugInfo && (
        <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-3 space-y-1">
          <p className="text-[11px] font-semibold text-sky-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />اطلاعات ذخیره‌سازی
          </p>
          <p className="text-[11px] text-muted-foreground font-mono break-words">
            id: {debugInfo.id}
          </p>
          <p className="text-[11px] text-muted-foreground font-mono break-words">
            {debugInfo.path}
          </p>
        </div>
      )}

      {/* ── Add / Edit Form ─────────────────────────────────────────────────── */}
      {showForm && (
        <div className="rounded-xl border border-primary/40 bg-card p-5 animate-fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              {editId ? "ویرایش ایستگاه" : "ایستگاه جدید"}
            </h4>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">نام ایستگاه *</label>
              <input
                value={form.name}
                onChange={(e) => setF("name", e.target.value)}
                placeholder="مثال: دروازه اصلی"
                required
                className={inputClass}
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">توضیح موقعیت</label>
              <input
                value={form.location}
                onChange={(e) => setF("location", e.target.value)}
                placeholder="ورودی شمالی، ساختمان الف"
                className={inputClass}
              />
            </div>

            {/* GPS capture button */}
            <button
              type="button"
              onClick={captureGps}
              disabled={gpsLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-primary/40 text-sm text-primary hover:bg-primary/10 hover:border-primary/60 transition-all font-medium"
            >
              {gpsLoading ? (
                <><RefreshCw className="w-4 h-4 animate-spin" />در حال دریافت موقعیت GPS...</>
              ) : (
                <><Navigation className="w-4 h-4" />استفاده از موقعیت فعلی (GPS)</>
              )}
            </button>

            {/* GPS preview badge — shown after capture */}
            {gpsPreview && (
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 animate-fade-in-up">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Crosshair className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-green-400">موقعیت GPS دریافت شد ✓</p>
                    <div className="mt-1.5 grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-black/20 px-2 py-1.5 text-center">
                        <p className="text-[9px] text-muted-foreground mb-0.5">عرض</p>
                        <p className="text-xs font-mono text-foreground">{gpsPreview.lat.toFixed(6)}</p>
                      </div>
                      <div className="rounded-lg bg-black/20 px-2 py-1.5 text-center">
                        <p className="text-[9px] text-muted-foreground mb-0.5">طول</p>
                        <p className="text-xs font-mono text-foreground">{gpsPreview.lng.toFixed(6)}</p>
                      </div>
                      <div className="rounded-lg bg-black/20 px-2 py-1.5 text-center">
                        <p className="text-[9px] text-muted-foreground mb-0.5">دقت</p>
                        <p className="text-xs font-mono text-foreground">±{Math.round(gpsPreview.accuracy)}م</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Manual lat/lng */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">عرض جغرافیایی *</label>
                <input
                  value={form.lat}
                  onChange={(e) => { setF("lat", e.target.value); setGpsPreview(null); }}
                  placeholder="35.6892"
                  required
                  type="number"
                  step="any"
                  className={inputClass + " font-mono text-sm"}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">طول جغرافیایی *</label>
                <input
                  value={form.lng}
                  onChange={(e) => { setF("lng", e.target.value); setGpsPreview(null); }}
                  placeholder="51.3890"
                  required
                  type="number"
                  step="any"
                  className={inputClass + " font-mono text-sm"}
                  dir="ltr"
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              مختصات را از GPS بالا بگیرید یا دستی وارد کنید
            </p>

            {/* Radius */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">شعاع مجاز (متر)</label>
              <select
                value={form.radiusMeters}
                onChange={(e) => setF("radiusMeters", e.target.value)}
                className={inputClass}
              >
                {["10", "25", "50", "100", "200"].map((v) => (
                  <option key={v} value={v}>{v} متر</option>
                ))}
              </select>
            </div>

            {/* Patrol interval */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                بازه گشت (فاصله بین هر بازدید)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={form.intervalValue}
                  onChange={(e) => setF("intervalValue", e.target.value)}
                  className={inputClass + " w-24 text-center font-mono"}
                  dir="ltr"
                />
                <select
                  value={form.intervalUnit}
                  onChange={(e) => setF("intervalUnit", e.target.value as IntervalUnit)}
                  className={inputClass}
                >
                  <option value="minutes">دقیقه</option>
                  <option value="hours">ساعت</option>
                </select>
              </div>
              <p className="text-[11px] text-primary/70 text-center">
                {formatIntervalLabel(toIntervalMinutes(form.intervalValue, form.intervalUnit))}
                {" · "}هر نگهبان باید در این بازه از این ایستگاه بازدید کند
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={closeForm}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? "در حال ذخیره..." : editId ? "ذخیره تغییرات" : "ایجاد ایستگاه"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Checkpoint list ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {checkpoints.length === 0 && !showForm && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            هنوز ایستگاهی تعریف نشده. با دکمه «افزودن ایستگاه» شروع کنید.
          </div>
        )}
        {checkpoints.map((cp) => (
          <div key={cp.id}
            className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors">
            {/* Header row */}
            <div className="flex items-start gap-3 p-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{cp.name}</p>
                    {cp.location && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{cp.location}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(cp)}
                      className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                      title="ویرایش"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cp.id)}
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors ${
                        deleteConfirm === cp.id
                          ? "bg-destructive/10 border-destructive/30 text-destructive"
                          : "bg-muted border-border text-muted-foreground hover:text-destructive hover:border-destructive/30"
                      }`}
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Delete confirm */}
                {deleteConfirm === cp.id && (
                  <div className="mt-2 flex items-center gap-2">
                    <p className="text-xs text-destructive flex-1">آیا مطمئنید؟</p>
                    <button
                      onClick={() => handleDelete(cp.id)}
                      className="text-xs text-destructive border border-destructive/30 rounded px-2 py-0.5 hover:bg-destructive/10"
                    >
                      حذف
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="text-xs text-muted-foreground border border-border rounded px-2 py-0.5 hover:bg-muted"
                    >
                      نه
                    </button>
                  </div>
                )}

                {/* Info chips */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="flex items-center gap-1 text-xs bg-muted rounded px-2 py-0.5 text-muted-foreground font-mono">
                    <MapPin className="w-3 h-3" />{cp.lat.toFixed(4)}, {cp.lng.toFixed(4)}
                  </span>
                  <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary rounded px-2 py-0.5">
                    <Shield className="w-3 h-3" />{cp.radiusMeters} متر
                  </span>
                  <span className="flex items-center gap-1 text-xs bg-muted rounded px-2 py-0.5 text-muted-foreground">
                    <Clock className="w-3 h-3" />{formatIntervalLabel(cp.patrolIntervalMinutes)}
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
                {expandedQr === cp.id
                  ? <ChevronUp className="w-3.5 h-3.5" />
                  : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {expandedQr === cp.id && (
                <div className="px-4 pb-4 animate-fade-in-up space-y-3">
                  {/* QR preview */}
                  <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-xl border border-border">
                    <QRCodeSVG
                      ref={(el: SVGSVGElement | null) => { qrRefs.current[cp.id] = el; }}
                      value={cp.qrCode}
                      size={220}
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
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg border text-xs font-semibold transition-colors ${
                        copiedId === cp.id
                          ? "border-green-500/30 bg-green-500/10 text-green-400"
                          : "border-border bg-muted text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {copiedId === cp.id
                        ? <><CheckCircle className="w-3.5 h-3.5" />کپی شد!</>
                        : <><Copy className="w-3.5 h-3.5" />کپی کد</>}
                    </button>
                  </div>

                  {/* Security note */}
                  <div className="rounded-lg bg-muted/50 border border-border px-3 py-2.5">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      <span className="text-primary font-semibold">🔒 امنیت:</span>{" "}
                      این کد QR فقط توسط دوربین نگهبان قابل اسکن است. هر ایستگاه هر ۵ دقیقه یک‌بار قابل اسکن است.
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
