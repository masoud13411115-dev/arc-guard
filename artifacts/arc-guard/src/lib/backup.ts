/**
 * ARC Guard — Enterprise Backup & Restore
 *
 * Reads data via the adapter (Firebase or future local server).
 * Restore writes directly to Firebase/Firestore with original document IDs
 * (requires setDoc with explicit ID — not yet in the generic adapter interface).
 *
 * History and schedule configs are stored per-company in localStorage so
 * backup data is fully isolated between tenants.
 */

import {
  getCheckpoints, getPatrolLogs, getAlertHistory,
  getCompanyGuards, getCompany, getAdapterMode,
} from "@/lib/adapter";
import { db } from "@/firebase";
import type {
  Checkpoint, PatrolLog, Alert, UserProfile,
} from "@/types";

// ── Public types ──────────────────────────────────────────────────────────────

export type BackupFormat   = "json" | "zip";
export type BackupTrigger  = "manual" | "scheduled";
export type BackupStatus   = "success" | "error";
export type BackupInterval = "1h" | "6h" | "12h" | "24h";

export interface BackupCollectionStats {
  checkpoints: number;
  patrolLogs:  number;
  alerts:      number;
  guards:      number;
}

export interface BackupData {
  version:     "2.0";
  createdAt:   number;
  companyId:   string;
  companyName: string;
  adapterMode: string;
  collections: {
    checkpoints: Checkpoint[];
    patrolLogs:  PatrolLog[];
    alerts:      Alert[];
    guards:      UserProfile[];
  };
}

export interface BackupRecord {
  id:        string;
  createdAt: number;
  format:    BackupFormat;
  sizeBytes: number;
  stats:     BackupCollectionStats;
  trigger:   BackupTrigger;
  status:    BackupStatus;
  filename:  string;
  error?:    string;
}

export interface BackupScheduleConfig {
  enabled:   boolean;
  interval:  BackupInterval;
  format:    BackupFormat;
  lastRunAt: number | null;
  nextRunAt: number | null;
}

export interface RestoreResult {
  checkpointsRestored: number;
  patrolLogsRestored:  number;
  alertsRestored:      number;
  guardsRestored:      number;
  errors:              string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const INTERVAL_MS: Record<BackupInterval, number> = {
  "1h":  1  * 60 * 60 * 1_000,
  "6h":  6  * 60 * 60 * 1_000,
  "12h": 12 * 60 * 60 * 1_000,
  "24h": 24 * 60 * 60 * 1_000,
};

const MAX_HISTORY = 50;

// ── LocalStorage keys (company-scoped for isolation) ──────────────────────────

const lsHistory  = (cid: string) => `arc_guard_v2:backup_history_${cid}`;
const lsSchedule = (cid: string) => `arc_guard_v2:backup_schedule_${cid}`;

// ── History ───────────────────────────────────────────────────────────────────

export function getBackupHistory(companyId: string): BackupRecord[] {
  try {
    const raw = localStorage.getItem(lsHistory(companyId));
    if (!raw) return [];
    return JSON.parse(raw) as BackupRecord[];
  } catch { return []; }
}

export function addBackupRecord(companyId: string, record: BackupRecord): void {
  const history = [record, ...getBackupHistory(companyId)].slice(0, MAX_HISTORY);
  localStorage.setItem(lsHistory(companyId), JSON.stringify(history));
}

export function deleteBackupRecord(companyId: string, id: string): void {
  const filtered = getBackupHistory(companyId).filter((r) => r.id !== id);
  localStorage.setItem(lsHistory(companyId), JSON.stringify(filtered));
}

export function clearBackupHistory(companyId: string): void {
  localStorage.removeItem(lsHistory(companyId));
}

// ── Schedule ──────────────────────────────────────────────────────────────────

const DEFAULT_SCHEDULE: BackupScheduleConfig = {
  enabled: false, interval: "24h", format: "json",
  lastRunAt: null, nextRunAt: null,
};

export function getScheduleConfig(companyId: string): BackupScheduleConfig {
  try {
    const raw = localStorage.getItem(lsSchedule(companyId));
    if (!raw) return { ...DEFAULT_SCHEDULE };
    return JSON.parse(raw) as BackupScheduleConfig;
  } catch { return { ...DEFAULT_SCHEDULE }; }
}

export function setScheduleConfig(companyId: string, config: BackupScheduleConfig): void {
  localStorage.setItem(lsSchedule(companyId), JSON.stringify(config));
}

export function computeNextRun(config: BackupScheduleConfig): number | null {
  if (!config.enabled) return null;
  const base = config.lastRunAt ?? Date.now();
  return base + INTERVAL_MS[config.interval];
}

// ── Data collection ───────────────────────────────────────────────────────────

export async function createBackupData(companyId: string): Promise<BackupData> {
  const company = await getCompany(companyId);
  const [checkpoints, patrolLogs, alerts, guards] = await Promise.all([
    getCheckpoints(companyId),
    getPatrolLogs(companyId),
    getAlertHistory(companyId, 1_000),
    getCompanyGuards(companyId),
  ]);
  return {
    version:     "2.0",
    createdAt:   Date.now(),
    companyId,
    companyName: company?.name ?? companyId,
    adapterMode: getAdapterMode(),
    collections: { checkpoints, patrolLogs, alerts, guards },
  };
}

// ── Export helpers ────────────────────────────────────────────────────────────

function isoFilename(companyId: string, createdAt: number, ext: string): string {
  const ts = new Date(createdAt).toISOString().slice(0, 19).replace(/:/g, "-");
  return `arc-guard-backup-${companyId}-${ts}.${ext}`;
}

export function exportAsJson(data: BackupData): { blob: Blob; filename: string } {
  const blob     = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const filename = isoFilename(data.companyId, data.createdAt, "json");
  return { blob, filename };
}

export async function exportAsZip(data: BackupData): Promise<{ blob: Blob; filename: string }> {
  const JSZip    = (await import("jszip")).default;
  const zip      = new JSZip();
  const ts       = new Date(data.createdAt).toISOString();

  zip.file("backup.json",       JSON.stringify(data, null, 2));
  zip.file("checkpoints.json",  JSON.stringify(data.collections.checkpoints, null, 2));
  zip.file("patrol-logs.json",  JSON.stringify(data.collections.patrolLogs,  null, 2));
  zip.file("alerts.json",       JSON.stringify(data.collections.alerts,      null, 2));
  zip.file("guards.json",       JSON.stringify(data.collections.guards,      null, 2));
  zip.file("README.txt", [
    "ARC Guard Enterprise Backup",
    `Created  : ${ts}`,
    `Company  : ${data.companyName} (${data.companyId})`,
    `Adapter  : ${data.adapterMode}`,
    `Version  : ${data.version}`,
    "",
    "Files:",
    "  backup.json       — full backup (all collections)",
    "  checkpoints.json  — patrol checkpoints",
    "  patrol-logs.json  — guard scan logs",
    "  alerts.json       — SOS / missed alerts",
    "  guards.json       — guard user profiles",
  ].join("\n"));

  const blob     = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const filename = isoFilename(data.companyId, data.createdAt, "zip");
  return { blob, filename };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 15_000);
}

// ── Full backup orchestration ─────────────────────────────────────────────────

export interface RunBackupResult {
  record:   BackupRecord;
  blob:     Blob;
  filename: string;
  data:     BackupData;
}

export async function runBackup(
  companyId: string,
  format:    BackupFormat,
  trigger:   BackupTrigger,
): Promise<RunBackupResult> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  let data: BackupData;
  let blob: Blob;
  let filename: string;
  let status: BackupStatus = "success";
  let errorMsg: string | undefined;

  try {
    data = await createBackupData(companyId);
    if (format === "zip") {
      ({ blob, filename } = await exportAsZip(data));
    } else {
      ({ blob, filename } = exportAsJson(data));
    }
  } catch (err) {
    status   = "error";
    errorMsg = String(err);
    data     = {
      version: "2.0", createdAt: Date.now(), companyId,
      companyName: companyId, adapterMode: getAdapterMode(),
      collections: { checkpoints: [], patrolLogs: [], alerts: [], guards: [] },
    };
    blob     = new Blob([JSON.stringify({ error: errorMsg })], { type: "application/json" });
    filename = isoFilename(companyId, Date.now(), "json");
  }

  const stats: BackupCollectionStats = {
    checkpoints: data.collections.checkpoints.length,
    patrolLogs:  data.collections.patrolLogs.length,
    alerts:      data.collections.alerts.length,
    guards:      data.collections.guards.length,
  };

  const record: BackupRecord = {
    id, createdAt: Date.now(), format, sizeBytes: blob.size,
    stats, trigger, status, filename,
    ...(errorMsg ? { error: errorMsg } : {}),
  };

  addBackupRecord(companyId, record);

  // If scheduled: update lastRunAt / nextRunAt
  if (trigger === "scheduled") {
    const cfg = getScheduleConfig(companyId);
    const next = cfg.enabled ? Date.now() + INTERVAL_MS[cfg.interval] : null;
    setScheduleConfig(companyId, { ...cfg, lastRunAt: Date.now(), nextRunAt: next });
  }

  return { record, blob, filename, data };
}

// ── Scheduled backup check ────────────────────────────────────────────────────

export async function checkAndRunScheduledBackup(
  companyId: string,
): Promise<boolean> {
  const cfg = getScheduleConfig(companyId);
  if (!cfg.enabled) return false;

  const now    = Date.now();
  const lastRun = cfg.lastRunAt ?? 0;
  if (now - lastRun < INTERVAL_MS[cfg.interval]) return false;

  console.log("[backup] scheduled backup due — running...");
  const { blob, filename } = await runBackup(companyId, cfg.format, "scheduled");
  downloadBlob(blob, filename);
  return true;
}

// ── Restore ───────────────────────────────────────────────────────────────────

export async function parseBackupFile(file: File): Promise<BackupData> {
  if (file.name.toLowerCase().endsWith(".zip")) {
    const JSZip = (await import("jszip")).default;
    const zip   = await JSZip.loadAsync(file);
    const entry = zip.file("backup.json");
    if (!entry) throw new Error("Invalid ZIP: backup.json not found");
    const text  = await entry.async("string");
    return JSON.parse(text) as BackupData;
  }
  const text = await file.text();
  return JSON.parse(text) as BackupData;
}

export function validateBackupData(data: BackupData, companyId: string): string | null {
  if (!data || typeof data !== "object")    return "Invalid backup file format";
  if (data.version !== "2.0")               return `Unsupported backup version: ${data.version}`;
  if (!data.companyId)                      return "Backup is missing companyId";
  if (data.companyId !== companyId)
    return `Company mismatch — backup belongs to "${data.companyId}", current is "${companyId}"`;
  if (!data.collections)                    return "Backup has no collections";
  return null;
}

export async function restoreBackup(
  companyId: string,
  data:      BackupData,
): Promise<RestoreResult> {
  if (!db) throw new Error("Firebase not configured — restore requires Firebase mode");

  const { doc, setDoc } = await import("firebase/firestore");
  const errors:  string[] = [];
  let checkpointsRestored = 0;
  let patrolLogsRestored  = 0;
  let alertsRestored      = 0;
  let guardsRestored      = 0;

  // ── Checkpoints ──
  for (const cp of data.collections.checkpoints ?? []) {
    try {
      await setDoc(doc(db, "companies", companyId, "checkpoints", cp.id), { ...cp });
      checkpointsRestored++;
    } catch (e) { errors.push(`checkpoint ${cp.id}: ${e}`); }
  }

  // ── Patrol logs ──
  for (const log of data.collections.patrolLogs ?? []) {
    try {
      const id = log.id ?? `log_${log.guardId}_${log.scanTime}`;
      await setDoc(doc(db, "companies", companyId, "patrolLogs", id), { ...log });
      patrolLogsRestored++;
    } catch (e) { errors.push(`patrolLog: ${e}`); }
  }

  // ── Alerts ──
  for (const alert of data.collections.alerts ?? []) {
    try {
      const id = alert.id ?? `alert_${alert.alertedAt}`;
      await setDoc(doc(db, "companies", companyId, "alerts", id), { ...alert });
      alertsRestored++;
    } catch (e) { errors.push(`alert ${alert.id}: ${e}`); }
  }

  // ── Guards (root 'users' collection) ──
  for (const guard of data.collections.guards ?? []) {
    try {
      await setDoc(doc(db, "users", guard.uid), { ...guard });
      guardsRestored++;
    } catch (e) { errors.push(`guard ${guard.uid}: ${e}`); }
  }

  return { checkpointsRestored, patrolLogsRestored, alertsRestored, guardsRestored, errors };
}
