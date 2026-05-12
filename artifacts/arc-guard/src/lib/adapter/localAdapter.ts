/**
 * Local-server adapter — Phase 1 placeholder.
 *
 * Every method logs a warning and returns safe empty values.
 * Phase 2 will replace these stubs with real HTTP/WebSocket calls
 * to a LAN server running the ARC Guard local backend.
 *
 * QR codes follow the same ARCG|{companyId}|{id} format so they stay
 * compatible with the guard scanner without any UI changes.
 */
import type { DataAdapter } from "./types";

const TAG = "[localAdapter]";

function warn(fn: string) {
  console.warn(
    `${TAG} ${fn}: local server not yet implemented — returning empty data (Phase 1 placeholder)`,
  );
}

function localId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const localAdapter: DataAdapter = {

  // ── Checkpoints ──────────────────────────────────────────────────────────────
  async saveCheckpoint(companyId, _cp) {
    warn("saveCheckpoint");
    const id = localId();
    console.info(`${TAG} saveCheckpoint → would POST /api/checkpoints  qr=ARCG|${companyId}|${id}`);
    return id;
  },

  async updateCheckpoint(_companyId, id, _data) {
    warn("updateCheckpoint");
    console.info(`${TAG} updateCheckpoint → would PATCH /api/checkpoints/${id}`);
  },

  async deleteCheckpoint(_companyId, id) {
    warn("deleteCheckpoint");
    console.info(`${TAG} deleteCheckpoint → would DELETE /api/checkpoints/${id}`);
  },

  subscribeCheckpoints(_companyId, cb, _onError) {
    warn("subscribeCheckpoints");
    cb([]);
    return () => {};
  },

  async getCheckpoints(_companyId) {
    warn("getCheckpoints");
    return [];
  },

  // ── Patrol Logs ───────────────────────────────────────────────────────────────
  async savePatrolLog(_log) {
    warn("savePatrolLog");
    const id = localId();
    console.info(`${TAG} savePatrolLog → would POST /api/patrol-logs`);
    return id;
  },

  subscribePatrolLogs(_companyId, cb, _limitCount) {
    warn("subscribePatrolLogs");
    cb([]);
    return () => {};
  },

  async getPatrolLogs(_companyId, _guardId) {
    warn("getPatrolLogs");
    return [];
  },

  // ── Guard Sessions ────────────────────────────────────────────────────────────
  async updateGuardSession(_session) {
    warn("updateGuardSession");
    console.info(`${TAG} updateGuardSession → would PUT /api/guard-sessions`);
  },

  subscribeGuardSessions(_companyId, cb) {
    warn("subscribeGuardSessions");
    cb([]);
    return () => {};
  },

  // ── Alerts ────────────────────────────────────────────────────────────────────
  async saveAlert(_alert) {
    warn("saveAlert");
    const id = localId();
    console.info(`${TAG} saveAlert → would POST /api/alerts`);
    return id;
  },

  async saveMissedAlert(_alert) {
    warn("saveMissedAlert");
    console.info(`${TAG} saveMissedAlert → would POST /api/alerts (kind=missed)`);
  },

  subscribeAlerts(_companyId, cb, _onError) {
    warn("subscribeAlerts");
    cb([]);
    return () => {};
  },

  async getAlertHistory(_companyId, _limitCount) {
    warn("getAlertHistory");
    return [];
  },

  async resolveAlert(_companyId, id) {
    warn("resolveAlert");
    console.info(`${TAG} resolveAlert → would PATCH /api/alerts/${id}/resolve`);
  },

  // ── Company ───────────────────────────────────────────────────────────────────
  async getCompany(_companyId) {
    warn("getCompany");
    return null;
  },

  async updateCompany(_companyId, _data) {
    warn("updateCompany");
    console.info(`${TAG} updateCompany → would PATCH /api/company`);
  },

  async regenerateInviteCode(_companyId) {
    warn("regenerateInviteCode");
    const code = `LOCAL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    console.info(`${TAG} regenerateInviteCode → would POST /api/company/invite-code → ${code}`);
    return code;
  },

  async getAllCompanies() {
    warn("getAllCompanies");
    return [];
  },

  subscribeAllCompanies(cb) {
    warn("subscribeAllCompanies");
    cb([]);
    return () => {};
  },

  async setCompanyPlan(_companyId, _plan) {
    warn("setCompanyPlan");
  },

  async setCompanySuspended(_companyId, _suspended) {
    warn("setCompanySuspended");
  },

  // ── Company guards ────────────────────────────────────────────────────────────
  async getCompanyGuards(_companyId) {
    warn("getCompanyGuards");
    return [];
  },

  async setGuardActive(uid, _active) {
    warn("setGuardActive");
    console.info(`${TAG} setGuardActive → would PATCH /api/guards/${uid}/active`);
  },

  // ── Offline sync ──────────────────────────────────────────────────────────────
  async syncOfflineQueue() {
    warn("syncOfflineQueue");
    return 0;
  },
};
