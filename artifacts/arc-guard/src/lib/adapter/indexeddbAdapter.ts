/**
 * IndexedDB Adapter — full offline-first local storage implementation.
 *
 * All data lives on this device in IndexedDB (arc-guard-offline v6).
 * No Firebase, no internet required.
 *
 * Subscriptions use setInterval polling (IndexedDB has no real-time push).
 * QR codes follow ARCG|{companyId}|{id} format — compatible with guard scanner.
 */

import type { DataAdapter } from "./types";
import type { PlanId } from "@/types";
import {
  localId,
  putLocalCheckpoint,
  getLocalCheckpoints,
  deleteLocalCheckpoint,
  putLocalPatrolLog,
  getLocalPatrolLogs,
  putLocalGuardSession,
  getLocalGuardSessions,
  putLocalAlert,
  getLocalAlerts,
  updateLocalAlertField,
  putLocalCompany,
  getLocalCompany,
  getAllLocalCompanies,
} from "@/lib/localDB";

const POLL_INTERVAL_MS = 3_000;

// ── ID / QR helpers ───────────────────────────────────────────────────────────

function newId(): string {
  return localId();
}

function buildQrCode(companyId: string, id: string): string {
  return `ARCG|${companyId}|${id}`;
}

function randomInviteCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── Polling subscription factory ─────────────────────────────────────────────

function poll<T>(
  fetch: () => Promise<T>,
  cb: (data: T) => void,
  onError?: (e: Error) => void,
): () => void {
  let active = true;

  function run() {
    fetch()
      .then((data) => { if (active) cb(data); })
      .catch((e) => { if (active) onError?.(e as Error); });
  }

  run();
  const id = setInterval(run, POLL_INTERVAL_MS);
  return () => { active = false; clearInterval(id); };
}

// ── Adapter implementation ────────────────────────────────────────────────────

export const indexeddbAdapter: DataAdapter = {

  // ── Checkpoints ──────────────────────────────────────────────────────────────

  async saveCheckpoint(companyId, cp) {
    const id      = newId();
    const qrCode  = buildQrCode(companyId, id);
    const record  = {
      ...cp,
      id,
      companyId,
      qrCode,
      createdAt: Date.now(),
      active: cp.active ?? true,
    };
    await putLocalCheckpoint(record);
    return id;
  },

  async updateCheckpoint(companyId, id, data) {
    const all = await getLocalCheckpoints(companyId);
    const existing = all.find((c) => c.id === id);
    if (!existing) throw new Error(`[indexeddbAdapter] checkpoint ${id} not found`);
    await putLocalCheckpoint({ ...existing, ...data, id, companyId });
  },

  async deleteCheckpoint(_companyId, id) {
    await deleteLocalCheckpoint(id);
  },

  subscribeCheckpoints(companyId, cb, onError) {
    return poll(() => getLocalCheckpoints(companyId), cb, onError);
  },

  async getCheckpoints(companyId) {
    return getLocalCheckpoints(companyId);
  },

  // ── Patrol Logs ───────────────────────────────────────────────────────────────

  async savePatrolLog(log) {
    const id      = log.id ?? newId();
    const record  = { ...log, id, synced: true };
    await putLocalPatrolLog(record);
    return id;
  },

  subscribePatrolLogs(companyId, cb, limitCount = 200) {
    return poll(
      () => getLocalPatrolLogs(companyId, undefined, limitCount),
      (logs) => cb(logs),
    );
  },

  async getPatrolLogs(companyId, guardId) {
    return getLocalPatrolLogs(companyId, guardId);
  },

  // ── Guard Sessions ────────────────────────────────────────────────────────────

  async updateGuardSession(session) {
    await putLocalGuardSession(session);
  },

  subscribeGuardSessions(companyId, cb) {
    return poll(() => getLocalGuardSessions(companyId), cb);
  },

  // ── Alerts ────────────────────────────────────────────────────────────────────

  async saveAlert(alert) {
    const id     = newId();
    const record = { ...alert, id, resolved: alert.resolved ?? false };
    await putLocalAlert(record);
    return id;
  },

  async saveMissedAlert(alert) {
    const id     = newId();
    const record = { ...alert, id, resolved: false };
    await putLocalAlert(record);
  },

  subscribeAlerts(companyId, cb, onError) {
    return poll(
      () => getLocalAlerts(companyId),
      (alerts) => cb(alerts),
      onError,
    );
  },

  async getAlertHistory(companyId, limitCount = 100) {
    return getLocalAlerts(companyId, limitCount);
  },

  async resolveAlert(_companyId, id) {
    await updateLocalAlertField(id, { resolved: true, resolvedAt: Date.now(), status: "resolved" });
  },

  // ── Company ───────────────────────────────────────────────────────────────────

  async getCompany(companyId) {
    return getLocalCompany(companyId);
  },

  async updateCompany(companyId, data) {
    const existing = await getLocalCompany(companyId);
    if (!existing) {
      const blank = {
        id:               companyId,
        name:             "شرکت",
        adminUid:         "local",
        adminUsername:    "local",
        plan:             "starter" as PlanId,
        active:           true,
        suspended:        false,
        inviteCode:       randomInviteCode(),
        guardCount:       0,
        checkpointCount:  0,
        createdAt:        Date.now(),
      };
      await putLocalCompany({ ...blank, ...data });
    } else {
      await putLocalCompany({ ...existing, ...data });
    }
  },

  async regenerateInviteCode(companyId) {
    const code     = randomInviteCode();
    const existing = await getLocalCompany(companyId);
    if (existing) await putLocalCompany({ ...existing, inviteCode: code });
    return code;
  },

  async getAllCompanies() {
    return getAllLocalCompanies();
  },

  subscribeAllCompanies(cb) {
    return poll(() => getAllLocalCompanies(), cb);
  },

  async setCompanyPlan(companyId, plan) {
    const existing = await getLocalCompany(companyId);
    if (existing) await putLocalCompany({ ...existing, plan });
  },

  async setCompanySuspended(companyId, suspended) {
    const existing = await getLocalCompany(companyId);
    if (existing) await putLocalCompany({ ...existing, suspended });
  },

  // ── Company guards ────────────────────────────────────────────────────────────

  async getCompanyGuards(_companyId) {
    return [];
  },

  async setGuardActive(_uid, _active) {
    // guards are managed separately in user profiles; noop for pure local mode
  },

  // ── Offline sync ──────────────────────────────────────────────────────────────

  async syncOfflineQueue() {
    // In indexeddb mode data is already local — nothing to sync remotely
    return 0;
  },
};
