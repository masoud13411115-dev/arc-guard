import { useState, useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { QRCodeSVG } from "qrcode.react";
import {
  MapPin, Plus, QrCode, Trash2, Shield, Clock,
  CheckCircle, Pencil, X, Download, ChevronDown, ChevronUp,
  Printer, Copy, Navigation, Crosshair, Info, RefreshCw, Zap, Loader2, Nfc, Layers,
} from "lucide-react";
import { useDynamicQrText, WINDOW_SECS } from "@/lib/dynamicQr";
import type { VerificationMode, ScanMode } from "@/types";
import {
  saveCheckpoint as fbSaveCheckpoint,
  updateCheckpoint as fbUpdateCheckpoint,
  deleteCheckpoint as fbDeleteCheckpoint,
  subscribeCheckpoints as fbSubscribeCheckpoints,
  checkpointPath,
} from "@/lib/adapter";
import { getCurrentPosition } from "@/lib/gps";
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
  verificationMode: "" as VerificationMode | "",
  scanMode: "" as ScanMode | "",
};
type FormState = typeof EMPTY_FORM;

// ── Scan mode definitions ────────────────────────────────────────────────────
type ScanModeMeta = {
  value: ScanMode;
  label: string;
  icon: React.ElementType;
  colors: string;
  badgeColors: string;
};
const SCAN_MODES: ScanModeMeta[] = [
  { value: "qr",      label: "QR",       icon: QrCode,  colors: "border-sky-500/60 bg-sky-500/10 text-sky-400",         badgeColors: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  { value: "gps",     label: "GPS",      icon: MapPin,  colors: "border-green-500/60 bg-green-500/10 text-green-400",   badgeColors: "bg-green-500/10 text-green-400 border-green-500/20" },
  { value: "nfc",     label: "NFC",      icon: Nfc,     colors: "border-purple-500/60 bg-purple-500/10 text-purple-400", badgeColors: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  { value: "qr+gps",  label: "QR+GPS",   icon: Shield,  colors: "border-primary/60 bg-primary/10 text-primary",         badgeColors: "bg-primary/10 text-primary border-primary/20" },
  { value: "qr+nfc",  label: "QR+NFC",   icon: Layers,  colors: "border-amber-500/60 bg-amber-500/10 text-amber-400",   badgeColors: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { value: "gps+nfc", label: "GPS+NFC",  icon: Zap,     colors: "border-orange-500/60 bg-orange-500/10 text-orange-400", badgeColors: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  { value: "all",     label: "همه",      icon: Shield,  colors: "border-red-500/60 bg-red-500/10 text-red-400",          badgeColors: "bg-red-500/10 text-red-400 border-red-500/20" },
];
function scanModeMeta(m: ScanMode | ""): ScanModeMeta | undefined {
  return SCAN_MODES.find((s) => s.value === m);
}

// ── Dynamic QR display sub-component ─────────────────────────────────────────
function DynamicQrCard({ cp, t }: { cp: { id: string; name: string; dynamicQrSecret?: string }; t: (k: string, v?: Record<string, string>) => string }) {
  const qrText = useDynamicQrText(cp.id, cp.dynamicQrSecret);
  const [countdown, setCountdown] = useState(WINDOW_SECS - (Math.floor(Date.now() / 1000) % WINDOW_SECS));

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(WINDOW_SECS - (Math.floor(Date.now() / 1000) % WINDOW_SECS));
    }, 500);
    return () => clearInterval(id);
  }, []);

  if (!qrText) {
    return (
      <div className="h-56 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-xl border border-border">
      <QRCodeSVG value={qrText} size={220} level="H" includeMargin bgColor="#ffffff" fgColor="#0a1628" />
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <RefreshCw className="w-3.5 h-3.5" style={{ animation: "spin 60s linear infinite" }} />
        <span>{t("vm.dynamic.refresh")} — {countdown}s</span>
      </div>
      <p className="text-[10px] text-gray-400 font-mono text-center break-all px-2 leading-relaxed">
        {qrText.slice(0, 45)}…
      </p>
    </div>
  );
}

const inputClass = "w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors";

function toIntervalMinutes(value: string, unit: IntervalUnit): number {
  const n = Math.max(1, parseInt(value) || 1);
  return unit === "hours" ? n * 60 : n;
}

function formatIntervalLabel(mins: number, t: (k: string, v?: Record<string, string>) => string): string {
  if (mins < 60) return t("cp.interval.minutes", { n: String(mins) });
  if (mins % 60 === 0) return t("cp.interval.hours", { n: String(mins / 60) });
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return t("cp.interval.hours.minutes", { h: String(h), m: String(m) });
}

export default function CheckpointManager({ companyId }: CheckpointManagerProps) {
  const { t, dir } = useI18n();
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

  const fsPath = checkpointPath(companyId); // same path for both save and load

  // ── Subscribe to checkpoints ────────────────────────────────────────────────
  useEffect(() => {
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
  }, [companyId, fsPath]);

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
      verificationMode: cp.verificationMode ?? "",
      scanMode: cp.scanMode ?? "",
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
      alert(t("cp.gps.failed"));
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
    if (isNaN(lat) || isNaN(lng)) { alert(t("cp.gps.failed")); return; }

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
        ...(form.verificationMode ? { verificationMode: form.verificationMode as VerificationMode } : {}),
        ...(form.scanMode ? { scanMode: form.scanMode as ScanMode } : {}),
      };

      if (editId) {
        await fbUpdateCheckpoint(companyId, editId, payload);
        setCheckpoints((prev) => prev.map((c) => c.id === editId ? { ...c, ...payload } : c));
        flash(t("cp.updated"));
        closeForm();
      } else {
        const newId = await fbSaveCheckpoint(companyId, payload);
        const savedPath = `${fsPath}/${newId}`;
        const qrCode = `ARCG|${companyId}|${newId}`;
        console.log(`[CheckpointManager] checkpoint saved — id=${newId} companyId=${companyId} path=${savedPath} qr=${qrCode}`);
        const newCp: Checkpoint = {
          ...payload, id: newId, companyId, qrCode, createdAt: Date.now(),
        };
        setCheckpoints((prev) => {
          const updated = [...prev, newCp];
          lsBackupSave(companyId, updated);
          return updated;
        });
        setDebugInfo({
          id: newId,
          path: `save: ${savedPath} | load: ${fsPath} (companyId: ${companyId}) | QR: ${qrCode}`,
        });
        setExpandedQr(newId);
        flash(t("cp.saved"));
        closeForm();
      }
    } catch (err) {
      console.error("[CheckpointManager] save error:", err);
      alert(t("common.error") + ":\n" + String(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (deleteConfirm !== id) { setDeleteConfirm(id); return; }
    try {
      await fbDeleteCheckpoint(companyId, id);
      flash(t("cp.deleted"));
    } catch (err) {
      alert(t("common.error") + ": " + err);
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
  <div class="logo">ARC GUARD · ${t("app.tagline")}</div>
  <div class="qr">${svgHtml}</div>
  <div class="name">${cp.name}</div>
  ${cp.location ? `<div class="loc">${cp.location}</div>` : ""}
  <div class="code">${cp.qrCode}</div>
  <div class="badge">${t("cp.radius.suffix", { n: String(cp.radiusMeters) })} · ${formatIntervalLabel(cp.patrolIntervalMinutes, t)}</div>
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
    <div className="space-y-4" dir={dir}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">{t("cp.manage.title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("cp.active.count", { n: String(checkpoints.length) })}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary-foreground bg-primary rounded-lg px-3 py-2 hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" />{t("cp.add.btn")}
        </button>
      </div>

      {/* Load error banner */}
      {loadError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-red-400">{t("cp.error.load")}</p>
            <p className="text-xs text-muted-foreground mt-0.5 break-words">{loadError}</p>
            <p className="text-[11px] text-muted-foreground mt-1 font-mono">
              مسیر: {fsPath}
            </p>
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
            <Info className="w-3.5 h-3.5" />{t("cp.debug.path")}
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
              {editId ? t("cp.form.edit") : t("cp.form.new")}
            </h4>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("cp.form.name.label")}</label>
              <input
                value={form.name}
                onChange={(e) => setF("name", e.target.value)}
                placeholder={t("cp.form.name.placeholder")}
                required
                className={inputClass}
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("cp.form.location.label")}</label>
              <input
                value={form.location}
                onChange={(e) => setF("location", e.target.value)}
                placeholder={t("cp.form.location.placeholder")}
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
                <><RefreshCw className="w-4 h-4 animate-spin" />{t("cp.form.gps.loading")}</>
              ) : (
                <><Navigation className="w-4 h-4" />{t("cp.form.gps.btn")}</>
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
                    <p className="text-xs font-bold text-green-400">{t("cp.form.gps.ok")}</p>
                    <div className="mt-1.5 grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-black/20 px-2 py-1.5 text-center">
                        <p className="text-[9px] text-muted-foreground mb-0.5">{t("cp.gps.lat")}</p>
                        <p className="text-xs font-mono text-foreground">{gpsPreview.lat.toFixed(6)}</p>
                      </div>
                      <div className="rounded-lg bg-black/20 px-2 py-1.5 text-center">
                        <p className="text-[9px] text-muted-foreground mb-0.5">{t("cp.gps.lng")}</p>
                        <p className="text-xs font-mono text-foreground">{gpsPreview.lng.toFixed(6)}</p>
                      </div>
                      <div className="rounded-lg bg-black/20 px-2 py-1.5 text-center">
                        <p className="text-[9px] text-muted-foreground mb-0.5">{t("cp.gps.accuracy")}</p>
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
                <label className="text-xs text-muted-foreground">{t("cp.form.lat.label")}</label>
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
                <label className="text-xs text-muted-foreground">{t("cp.form.lng.label")}</label>
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
              {t("cp.form.coords.hint")}
            </p>

            {/* Radius */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("cp.form.radius.label")}</label>
              <select
                value={form.radiusMeters}
                onChange={(e) => setF("radiusMeters", e.target.value)}
                className={inputClass}
              >
                {["10", "25", "50", "100", "200"].map((v) => (
                  <option key={v} value={v}>{t("cp.radius.suffix", { n: v })}</option>
                ))}
              </select>
            </div>

            {/* Patrol interval */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {t("cp.form.interval.label")}
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
                  <option value="minutes">{t("cp.form.interval.minutes")}</option>
                  <option value="hours">{t("cp.form.interval.hours")}</option>
                </select>
              </div>
              <p className="text-[11px] text-primary/70 text-center">
                {formatIntervalLabel(toIntervalMinutes(form.intervalValue, form.intervalUnit), t)}
                {" · "}{t("cp.form.interval.hint")}
              </p>
            </div>

            {/* Scan Mode */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                {t("sm.title")}
              </label>
              {/* 7-button grid — "company default" toggle row above */}
              <button
                type="button"
                onClick={() => setF("scanMode", "")}
                className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-medium transition-colors ${
                  form.scanMode === ""
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-primary/30"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />{t("sm.company.default")}
              </button>
              <div className="grid grid-cols-3 gap-2">
                {SCAN_MODES.map(({ value, label, icon: Icon, colors }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setF("scanMode", value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all ${
                      form.scanMode === value
                        ? colors
                        : "border-border bg-muted/30 text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                    <span className="text-[11px] font-bold leading-tight">{label}</span>
                    <span className="text-[9px] leading-tight opacity-70">
                      {t(`sm.${value}.desc` as Parameters<typeof t>[0])}
                    </span>
                  </button>
                ))}
              </div>
              {/* Dynamic QR toggle — only visible for modes that include QR */}
              {(form.scanMode === "qr" || form.scanMode === "qr+gps" || form.scanMode === "qr+nfc" || form.scanMode === "all") && (
                <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                  <label className="flex items-center gap-2 text-xs text-amber-400 cursor-pointer">
                    <Zap className="w-3.5 h-3.5" />
                    {t("vm.dynamicQr")} — {t("vm.dynamicQr.desc")}
                  </label>
                  <button
                    type="button"
                    onClick={() => setF("verificationMode",
                      form.verificationMode === "dynamicQr" ? "fixedQr" : "dynamicQr"
                    )}
                    className={`w-9 h-5 rounded-full border-2 transition-colors flex items-center ${
                      form.verificationMode === "dynamicQr"
                        ? "bg-amber-400 border-amber-500 justify-end"
                        : "bg-muted border-border justify-start"
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full bg-white mx-0.5 shadow" />
                  </button>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={closeForm}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? t("cp.form.saving") : editId ? t("cp.form.update") : t("cp.form.save")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Checkpoint list ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {checkpoints.length === 0 && !showForm && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            {t("cp.no.checkpoints")}
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
                    <p className="text-xs text-destructive flex-1">{t("cp.delete.confirm")}</p>
                    <button
                      onClick={() => handleDelete(cp.id)}
                      className="text-xs text-destructive border border-destructive/30 rounded px-2 py-0.5 hover:bg-destructive/10"
                    >
                      {t("common.delete")}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="text-xs text-muted-foreground border border-border rounded px-2 py-0.5 hover:bg-muted"
                    >
                      {t("cp.delete.no")}
                    </button>
                  </div>
                )}

                {/* Info chips */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="flex items-center gap-1 text-xs bg-muted rounded px-2 py-0.5 text-muted-foreground font-mono">
                    <MapPin className="w-3 h-3" />{cp.lat.toFixed(4)}, {cp.lng.toFixed(4)}
                  </span>
                  <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary rounded px-2 py-0.5">
                    <Shield className="w-3 h-3" />{t("cp.radius.suffix", { n: String(cp.radiusMeters) })}
                  </span>
                  <span className="flex items-center gap-1 text-xs bg-muted rounded px-2 py-0.5 text-muted-foreground">
                    <Clock className="w-3 h-3" />{formatIntervalLabel(cp.patrolIntervalMinutes, t)}
                  </span>
                  {/* Show scanMode badge (new) or verificationMode badge (legacy) */}
                  {cp.scanMode ? (() => {
                    const meta = scanModeMeta(cp.scanMode);
                    if (!meta) return null;
                    const Icon = meta.icon;
                    return (
                      <span className={`flex items-center gap-1 text-xs rounded px-2 py-0.5 border ${meta.badgeColors}`}>
                        <Icon className="w-3 h-3" />{meta.label}
                        {cp.verificationMode === "dynamicQr" && <Zap className="w-2.5 h-2.5 text-amber-400" />}
                      </span>
                    );
                  })() : cp.verificationMode ? (
                    <span className={`flex items-center gap-1 text-xs rounded px-2 py-0.5 ${
                      cp.verificationMode === "dynamicQr" ? "bg-amber-500/10 text-amber-400"
                      : cp.verificationMode === "gpsOnly" ? "bg-green-500/10 text-green-400"
                      : "bg-sky-500/10 text-sky-400"
                    }`}>
                      {cp.verificationMode === "gpsOnly" && <MapPin className="w-3 h-3" />}
                      {cp.verificationMode === "fixedQr" && <QrCode className="w-3 h-3" />}
                      {cp.verificationMode === "dynamicQr" && <Zap className="w-3 h-3" />}
                      {t(`vm.${cp.verificationMode}` as Parameters<typeof t>[0])}
                    </span>
                  ) : null}
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
                  {t("cp.qr.expand")}
                </span>
                {expandedQr === cp.id
                  ? <ChevronUp className="w-3.5 h-3.5" />
                  : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {expandedQr === cp.id && (
                <div className="px-4 pb-4 animate-fade-in-up space-y-3">
                  {/* QR preview — static or rotating depending on mode */}
                  {cp.verificationMode === "dynamicQr" ? (
                    <DynamicQrCard cp={cp} t={t} />
                  ) : (
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
                  )}

                  {/* Action buttons — hidden for dynamicQr (rotating code cannot be printed) */}
                  {cp.verificationMode !== "dynamicQr" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => downloadQrPng(cp)}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-primary/30 bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />{t("cp.qr.download.png")}
                    </button>
                    <button
                      onClick={() => downloadQrSvg(cp)}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-border bg-muted text-xs font-semibold text-muted-foreground hover:bg-accent transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />{t("cp.qr.download.svg")}
                    </button>
                    <button
                      onClick={() => printQr(cp)}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-border bg-muted text-xs font-semibold text-muted-foreground hover:bg-accent transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />{t("cp.qr.print")}
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
                        ? <><CheckCircle className="w-3.5 h-3.5" />{t("cp.qr.copied")}</>
                        : <><Copy className="w-3.5 h-3.5" />{t("cp.qr.copy")}</>}
                    </button>
                  </div>
                  )}

                  {/* Security note */}
                  <div className="rounded-lg bg-muted/50 border border-border px-3 py-2.5">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      <span className="text-primary font-semibold">🔒</span>{" "}
                      {t("cp.qr.security")}
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
