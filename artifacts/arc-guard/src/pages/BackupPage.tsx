import { useState, useEffect, useRef } from "react";
import {
  Download, Upload, Clock, CheckCircle, XCircle, Trash2,
  Archive, FileJson, RefreshCw, Shield, AlertTriangle,
  Database, Calendar, ChevronDown, ChevronUp, Info,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getAdapterMode } from "@/lib/adapter";
import { isFirebaseReady } from "@/firebase";
import {
  runBackup, downloadBlob, getBackupHistory, deleteBackupRecord,
  getScheduleConfig, setScheduleConfig, computeNextRun,
  checkAndRunScheduledBackup, parseBackupFile, validateBackupData, restoreBackup,
  type BackupRecord, type BackupScheduleConfig, type BackupData, type RestoreResult,
  type BackupFormat, type BackupInterval,
} from "@/lib/backup";
import { useSyncManager } from "@/lib/syncManager";
import { estimateLocalDBSize } from "@/lib/localDB";
import SyncStatusBar from "@/components/SyncStatusBar";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024)     return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function fmtAgo(ts: number | null, t: (k: string) => string): string {
  if (!ts) return t("backup.status.never");
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0)  return `${d}${t("backup.time.d")}`;
  if (h > 0)  return `${h}${t("backup.time.h")}`;
  if (m > 0)  return `${m}${t("backup.time.m")}`;
  return t("backup.time.now");
}

function fmtDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("fa-IR");
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ icon: Icon, title, badge }: {
  icon: React.ElementType; title: string; badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
      <Icon className="w-4 h-4 text-primary shrink-0" />
      <span className="text-sm font-bold text-foreground flex-1">{title}</span>
      {badge}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface BackupPageProps { companyId: string; companyName: string; online?: boolean; }

export default function BackupPage({ companyId, companyName, online = true }: BackupPageProps) {
  const { t, isRTL } = useI18n();
  const dir = isRTL ? "rtl" : "ltr";

  // ── State ──────────────────────────────────────────────────────────────────
  const [creating,          setCreating]          = useState<false | "json" | "zip">(false);
  const [createMsg,         setCreateMsg]         = useState<{ ok: boolean; text: string } | null>(null);
  const [history,           setHistory]           = useState<BackupRecord[]>(() => getBackupHistory(companyId));
  const [schedule,          setSchedule]          = useState<BackupScheduleConfig>(() => getScheduleConfig(companyId));
  const [scheduleDirty,     setScheduleDirty]     = useState(false);
  const [scheduleSaved,     setScheduleSaved]     = useState(false);
  const [historyExpanded,   setHistoryExpanded]   = useState(false);

  // Restore flow
  const [restoreFile,       setRestoreFile]       = useState<File | null>(null);
  const [restoreParsed,     setRestoreParsed]     = useState<BackupData | null>(null);
  const [restoreParseErr,   setRestoreParseErr]   = useState<string | null>(null);
  const [restoreParsing,    setRestoreParsing]    = useState(false);
  const [restoreConfirm,    setRestoreConfirm]    = useState(false);
  const [restoreRunning,    setRestoreRunning]    = useState(false);
  const [restoreResult,     setRestoreResult]     = useState<RestoreResult | null>(null);
  const [restoreError,      setRestoreError]      = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // ── Sync status ────────────────────────────────────────────────────────────
  const sync = useSyncManager(companyId);
  const [dbSize, setDbSize] = useState("—");

  useEffect(() => {
    estimateLocalDBSize()
      .then(({ formatted }) => setDbSize(formatted))
      .catch(console.error);
  }, []);

  // ── Schedule check on mount ────────────────────────────────────────────────
  useEffect(() => {
    checkAndRunScheduledBackup(companyId)
      .then((ran) => { if (ran) setHistory(getBackupHistory(companyId)); })
      .catch(console.error);
  }, [companyId]);

  // ── Create backup ──────────────────────────────────────────────────────────
  async function handleCreate(format: BackupFormat) {
    setCreating(format);
    setCreateMsg(null);
    try {
      const { blob, filename } = await runBackup(companyId, format, "manual");
      downloadBlob(blob, filename);
      setHistory(getBackupHistory(companyId));
      setCreateMsg({ ok: true, text: t("backup.success") + ` — ${filename}` });
    } catch (e) {
      setCreateMsg({ ok: false, text: t("backup.error") + `: ${e}` });
    } finally {
      setCreating(false);
    }
  }

  // ── Schedule ───────────────────────────────────────────────────────────────
  function updateSchedule(patch: Partial<BackupScheduleConfig>) {
    setSchedule((prev) => ({ ...prev, ...patch }));
    setScheduleDirty(true);
    setScheduleSaved(false);
  }

  function saveSchedule() {
    const cfg: BackupScheduleConfig = {
      ...schedule,
      lastRunAt: schedule.lastRunAt,
      nextRunAt: computeNextRun({ ...schedule, lastRunAt: schedule.lastRunAt ?? Date.now() }),
    };
    setScheduleConfig(companyId, cfg);
    setSchedule(cfg);
    setScheduleDirty(false);
    setScheduleSaved(true);
    setTimeout(() => setScheduleSaved(false), 3000);
  }

  // ── History ────────────────────────────────────────────────────────────────
  function handleDeleteRecord(id: string) {
    deleteBackupRecord(companyId, id);
    setHistory(getBackupHistory(companyId));
  }

  // ── Restore ────────────────────────────────────────────────────────────────
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFile(file);
    setRestoreParsed(null);
    setRestoreParseErr(null);
    setRestoreResult(null);
    setRestoreError(null);
    setRestoreParsing(true);
    try {
      const data = await parseBackupFile(file);
      const err  = validateBackupData(data, companyId);
      if (err) { setRestoreParseErr(err); setRestoreParsing(false); return; }
      setRestoreParsed(data);
    } catch (e) {
      setRestoreParseErr(String(e));
    } finally {
      setRestoreParsing(false);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleRestore() {
    if (!restoreParsed) return;
    setRestoreRunning(true);
    setRestoreError(null);
    try {
      const result = await restoreBackup(companyId, restoreParsed);
      setRestoreResult(result);
      setRestoreConfirm(false);
    } catch (e) {
      setRestoreError(String(e));
      setRestoreConfirm(false);
    } finally {
      setRestoreRunning(false);
    }
  }

  function resetRestore() {
    setRestoreFile(null);
    setRestoreParsed(null);
    setRestoreParseErr(null);
    setRestoreResult(null);
    setRestoreError(null);
    setRestoreConfirm(false);
  }

  // ── Computed ───────────────────────────────────────────────────────────────
  const adapterMode = getAdapterMode();
  const fbReady     = isFirebaseReady;
  const lastRecord  = history[0] ?? null;
  const cfg         = schedule;
  const visibleHistory = historyExpanded ? history : history.slice(0, 5);

  const INTERVALS: { value: BackupInterval; key: string }[] = [
    { value: "1h",  key: "backup.schedule.1h"  },
    { value: "6h",  key: "backup.schedule.6h"  },
    { value: "12h", key: "backup.schedule.12h" },
    { value: "24h", key: "backup.schedule.24h" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl space-y-4 animate-fade-in-up pb-8" dir={dir}>

      {/* ── Page header ── */}
      <div>
        <h2 className="text-lg font-bold text-foreground">{t("backup.title")}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{t("backup.sub")}</p>
      </div>

      {/* ── Status card ── */}
      <Card>
        <CardHeader icon={Shield} title={t("backup.status.title")} />
        <div className="p-4 grid grid-cols-2 gap-3">
          {[
            { label: t("backup.status.last"),    value: fmtAgo(lastRecord?.createdAt ?? null, t) },
            { label: t("backup.status.next"),    value: cfg.enabled ? fmtAgo(cfg.nextRunAt, t) : t("backup.status.disabled") },
            { label: t("backup.status.total"),   value: String(history.length) },
            { label: t("backup.status.adapter"), value: adapterMode === "firebase" ? "Firebase" : t("adapter.local") },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-muted/20 p-3">
              <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
              <p className="text-sm font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>
        {!fbReady && adapterMode === "firebase" && (
          <div className="mx-4 mb-4 flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{t("backup.firebase.warn")}</span>
          </div>
        )}
      </Card>

      {/* ── Create backup ── */}
      <Card>
        <CardHeader icon={Download} title={t("backup.create.title")} />
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">{t("backup.create.sub")}</p>
          <div className="grid grid-cols-2 gap-3">
            {/* JSON */}
            <button
              onClick={() => handleCreate("json")}
              disabled={!!creating}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-sky-500/50 hover:bg-sky-500/5 transition-all disabled:opacity-50 text-center group"
            >
              <FileJson className="w-6 h-6 text-sky-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-foreground">{t("backup.json.btn")}</span>
              <span className="text-[10px] text-muted-foreground">JSON</span>
              {creating === "json" && <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />}
            </button>
            {/* ZIP */}
            <button
              onClick={() => handleCreate("zip")}
              disabled={!!creating}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-purple-500/50 hover:bg-purple-500/5 transition-all disabled:opacity-50 text-center group"
            >
              <Archive className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-foreground">{t("backup.zip.btn")}</span>
              <span className="text-[10px] text-muted-foreground">ZIP + README</span>
              {creating === "zip" && <RefreshCw className="w-3.5 h-3.5 text-purple-400 animate-spin" />}
            </button>
          </div>

          {creating && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 text-primary text-xs">
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>{t("backup.creating")}</span>
            </div>
          )}
          {createMsg && !creating && (
            <div className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${
              createMsg.ok
                ? "bg-green-500/10 border border-green-500/30 text-green-400"
                : "bg-red-500/10 border border-red-500/30 text-red-400"
            }`}>
              {createMsg.ok
                ? <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                : <XCircle    className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
              <span className="break-all">{createMsg.text}</span>
            </div>
          )}

          {/* What's included */}
          <div className="text-[10px] text-muted-foreground/60 space-y-0.5">
            <p className="font-semibold text-muted-foreground/80">{t("backup.create.includes")}</p>
            {["backup.create.inc.checkpoints","backup.create.inc.logs","backup.create.inc.alerts","backup.create.inc.guards"].map((k) => (
              <p key={k}>· {t(k)}</p>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Schedule ── */}
      <Card>
        <CardHeader icon={Calendar} title={t("backup.schedule.title")} />
        <div className="p-4 space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-foreground">{t("backup.schedule.enable")}</p>
              <p className="text-[10px] text-muted-foreground">{t("backup.schedule.sub")}</p>
            </div>
            <button
              onClick={() => updateSchedule({ enabled: !cfg.enabled })}
              className={`relative w-11 h-6 rounded-full transition-colors ${cfg.enabled ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${cfg.enabled ? (isRTL ? "right-0.5" : "left-5") : (isRTL ? "right-5" : "left-0.5")}`} />
            </button>
          </div>

          {cfg.enabled && (
            <>
              {/* Interval */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">{t("backup.schedule.interval")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {INTERVALS.map(({ value, key }) => (
                    <button
                      key={value}
                      onClick={() => updateSchedule({ interval: value })}
                      className={`py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                        cfg.interval === value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-border/60"
                      }`}
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Format */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">{t("backup.schedule.format")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["json","zip"] as BackupFormat[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => updateSchedule({ format: f })}
                      className={`py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                        cfg.format === f
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-border/60"
                      }`}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Save button */}
          <button
            onClick={saveSchedule}
            disabled={!scheduleDirty}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            {scheduleSaved
              ? <><CheckCircle className="w-4 h-4" />{t("backup.schedule.saved")}</>
              : t("backup.schedule.save")
            }
          </button>

          {/* Next run */}
          {cfg.enabled && cfg.nextRunAt && (
            <p className="text-[10px] text-muted-foreground text-center">
              {t("backup.schedule.next.label")}: {fmtDate(cfg.nextRunAt)}
            </p>
          )}
        </div>
      </Card>

      {/* ── History ── */}
      <Card>
        <CardHeader
          icon={Clock}
          title={t("backup.history.title")}
          badge={
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/40 text-muted-foreground font-mono">
              {history.length}
            </span>
          }
        />
        <div className="divide-y divide-border">
          {history.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              {t("backup.history.empty")}
            </div>
          ) : (
            <>
              {visibleHistory.map((rec) => (
                <div key={rec.id} className="flex items-start gap-3 px-4 py-3 hover:bg-accent/10">
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                    rec.status === "success" ? "bg-green-400" : "bg-red-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        rec.format === "zip"
                          ? "bg-purple-500/10 text-purple-400"
                          : "bg-sky-500/10 text-sky-400"
                      }`}>{rec.format.toUpperCase()}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        rec.trigger === "scheduled"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-muted/30 text-muted-foreground"
                      }`}>
                        {rec.trigger === "scheduled" ? t("backup.history.scheduled") : t("backup.history.manual")}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 font-mono">{fmtSize(rec.sizeBytes)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{fmtDate(rec.createdAt)}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5 font-mono truncate">{rec.filename}</p>
                    <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground/60">
                      <span>{t("backup.history.checkpoints")}: {rec.stats.checkpoints}</span>
                      <span>{t("backup.history.logs")}: {rec.stats.patrolLogs}</span>
                      <span>{t("backup.history.alerts")}: {rec.stats.alerts}</span>
                    </div>
                    {rec.error && (
                      <p className="text-[10px] text-red-400 mt-0.5 truncate">{rec.error}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteRecord(rec.id)}
                    className="shrink-0 p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                    title={t("backup.history.delete")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {history.length > 5 && (
                <button
                  onClick={() => setHistoryExpanded((v) => !v)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {historyExpanded
                    ? <><ChevronUp className="w-3.5 h-3.5" />{t("backup.history.less")}</>
                    : <><ChevronDown className="w-3.5 h-3.5" />{t("backup.history.more", { n: String(history.length - 5) })}</>
                  }
                </button>
              )}
            </>
          )}
        </div>
      </Card>

      {/* ── Restore ── */}
      <Card>
        <CardHeader icon={Upload} title={t("backup.restore.title")} />
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">{t("backup.restore.sub")}</p>

          {/* Offline warning */}
          {!online && (
            <div className="flex items-center gap-2 p-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-xs">
              <span className="shrink-0">⚠</span>
              <p>{t("manager.offline.banner")}</p>
            </div>
          )}

          {/* Upload button */}
          {!restoreParsed && !restoreResult && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".json,.zip"
                className="hidden"
                onChange={handleFileSelect}
                disabled={!online}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={restoreParsing || !online}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {restoreParsing
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> {t("backup.restore.parsing")}</>
                  : <><Upload className="w-4 h-4" /> {t("backup.restore.select")}</>
                }
              </button>
            </>
          )}

          {/* Parse error */}
          {restoreParseErr && (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs">
              <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div className="space-y-2 flex-1">
                <p>{restoreParseErr}</p>
                <button onClick={resetRestore} className="text-red-300 hover:text-red-100 underline">{t("backup.restore.try.again")}</button>
              </div>
            </div>
          )}

          {/* Parsed preview */}
          {restoreParsed && !restoreResult && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl border border-green-500/30 bg-green-500/5 space-y-2">
                <p className="text-xs font-bold text-green-400">{t("backup.restore.preview.title")}</p>
                <div className="space-y-1.5 text-xs" dir="ltr">
                  {[
                    ["Company",      restoreParsed.companyName],
                    ["Created",      fmtDate(restoreParsed.createdAt)],
                    ["Version",      restoreParsed.version],
                    ["Checkpoints",  String(restoreParsed.collections.checkpoints.length)],
                    ["Patrol Logs",  String(restoreParsed.collections.patrolLogs.length)],
                    ["Alerts",       String(restoreParsed.collections.alerts.length)],
                    ["Guards",       String(restoreParsed.collections.guards.length)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-muted-foreground w-24 shrink-0">{k}</span>
                      <span className="text-foreground font-mono">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setRestoreConfirm(true)}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-sm font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />{t("backup.restore.confirm.btn")}
                </button>
                <button
                  onClick={resetRestore}
                  className="px-4 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-accent transition-colors"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          )}

          {/* Restore result */}
          {restoreResult && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl border border-green-500/30 bg-green-500/5">
                <p className="text-xs font-bold text-green-400 mb-2">{t("backup.restore.success")}</p>
                <div className="space-y-1 text-xs" dir="ltr">
                  {[
                    ["Checkpoints", restoreResult.checkpointsRestored],
                    ["Patrol Logs", restoreResult.patrolLogsRestored],
                    ["Alerts",      restoreResult.alertsRestored],
                    ["Guards",      restoreResult.guardsRestored],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      <span className="text-muted-foreground w-24 shrink-0">{k}</span>
                      <span className="text-green-400 font-mono">{v} restored</span>
                    </div>
                  ))}
                  {restoreResult.errors.length > 0 && (
                    <p className="text-amber-400 mt-2">{restoreResult.errors.length} errors</p>
                  )}
                </div>
              </div>
              <button onClick={resetRestore} className="w-full py-2 rounded-xl border border-border text-xs text-muted-foreground hover:bg-accent transition-colors">
                {t("backup.restore.done")}
              </button>
            </div>
          )}

          {/* Restore error */}
          {restoreError && (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs">
              <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div className="space-y-1 flex-1">
                <p className="font-bold">{t("backup.restore.error")}</p>
                <p className="break-all font-mono">{restoreError}</p>
                <button onClick={resetRestore} className="text-red-300 hover:text-red-100 underline">{t("backup.restore.try.again")}</button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ── Offline Sync Status ── */}
      <SyncStatusBar sync={sync} dbSize={dbSize} compact={false} />

      {/* ── Diagnostics ── */}
      <Card>
        <CardHeader icon={Database} title={t("backup.diag.title")} />
        <div className="p-4 space-y-2.5">
          {[
            { label: t("backup.diag.company"),   value: companyName, sub: companyId },
            { label: t("backup.diag.adapter"),   value: adapterMode === "firebase" ? "Firebase" : t("adapter.local"), ok: adapterMode === "firebase" ? fbReady : null },
            { label: t("backup.diag.count"),     value: String(history.length) },
            { label: t("backup.diag.last.size"), value: lastRecord ? fmtSize(lastRecord.sizeBytes) : "—" },
            { label: t("backup.diag.schedule"),  value: cfg.enabled ? `${cfg.interval} · ${cfg.format.toUpperCase()}` : t("backup.status.disabled") },
            { label: t("sync.local.size"),        value: dbSize },
          ].map(({ label, value, sub, ok }) => (
            <div key={label} className="flex items-start gap-3">
              <span className="text-xs text-muted-foreground flex-1">{label}</span>
              <div className="text-right">
                <div className="flex items-center gap-1.5 justify-end">
                  {ok === true  && <CheckCircle className="w-3 h-3 text-green-400" />}
                  {ok === false && <XCircle     className="w-3 h-3 text-red-400"   />}
                  <span className="text-xs font-semibold text-foreground">{value}</span>
                </div>
                {sub && <p className="text-[10px] font-mono text-muted-foreground/50 mt-0.5">{sub}</p>}
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 pb-4">
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
            <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">{t("backup.diag.note")}</p>
          </div>
        </div>
      </Card>

      {/* ── Restore confirmation modal ── */}
      {restoreConfirm && restoreParsed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border-2 border-amber-500/50 bg-card p-6 space-y-4 animate-fade-in-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{t("backup.restore.confirm.title")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{companyName}</p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <p className="text-xs text-amber-300 leading-relaxed">{t("backup.restore.confirm.warning")}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs border border-border rounded-xl p-3">
              <div><p className="font-bold text-foreground">{restoreParsed.collections.checkpoints.length}</p><p className="text-muted-foreground">{t("backup.history.checkpoints")}</p></div>
              <div><p className="font-bold text-foreground">{restoreParsed.collections.patrolLogs.length}</p><p className="text-muted-foreground">{t("backup.history.logs")}</p></div>
              <div><p className="font-bold text-foreground">{restoreParsed.collections.alerts.length}</p><p className="text-muted-foreground">{t("backup.history.alerts")}</p></div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRestore}
                disabled={restoreRunning}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {restoreRunning
                  ? <><RefreshCw className="w-4 h-4 animate-spin" />{t("backup.restore.running")}</>
                  : t("backup.restore.confirm.btn")
                }
              </button>
              <button
                onClick={() => setRestoreConfirm(false)}
                disabled={restoreRunning}
                className="px-4 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-accent transition-colors disabled:opacity-60"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
