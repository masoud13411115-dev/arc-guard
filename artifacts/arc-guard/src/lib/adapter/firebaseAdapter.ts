/**
 * Firebase adapter — delegates every call to the existing firestore.ts
 * implementation.  No logic lives here; it is purely a mapping layer.
 */
import * as fb from "@/lib/firestore";
import type { DataAdapter } from "./types";

export const firebaseAdapter: DataAdapter = {
  // ── Checkpoints ──────────────────────────────────────────────────────────────
  saveCheckpoint:       (c, cp)       => fb.saveCheckpoint(c, cp),
  updateCheckpoint:     (c, id, d)    => fb.updateCheckpoint(c, id, d),
  deleteCheckpoint:     (c, id)       => fb.deleteCheckpoint(c, id),
  subscribeCheckpoints: (c, cb, onE)  => fb.subscribeCheckpoints(c, cb, onE),
  getCheckpoints:       (c)           => fb.getCheckpoints(c),

  // ── Patrol Logs ───────────────────────────────────────────────────────────────
  savePatrolLog:       (log)          => fb.savePatrolLog(log),
  subscribePatrolLogs: (c, cb, lim)   => fb.subscribePatrolLogs(c, cb, lim),
  getPatrolLogs:       (c, gId)       => fb.getPatrolLogs(c, gId),

  // ── Guard Sessions ────────────────────────────────────────────────────────────
  updateGuardSession:    (s)          => fb.updateGuardSession(s),
  subscribeGuardSessions:(c, cb)      => fb.subscribeGuardSessions(c, cb),

  // ── Alerts ────────────────────────────────────────────────────────────────────
  saveAlert:       (a)                => fb.saveAlert(a),
  saveMissedAlert: (a)                => fb.saveMissedAlert(a),
  subscribeAlerts: (c, cb, onE)       => fb.subscribeAlerts(c, cb, onE),
  getAlertHistory: (c, lim)           => fb.getAlertHistory(c, lim),
  resolveAlert:    (c, id)            => fb.resolveAlert(c, id),

  // ── Company ───────────────────────────────────────────────────────────────────
  getCompany:           (c)           => fb.getCompany(c),
  updateCompany:        (c, d)        => fb.updateCompany(c, d),
  regenerateInviteCode: (c)           => fb.regenerateInviteCode(c),
  getAllCompanies:       ()            => fb.getAllCompanies(),
  subscribeAllCompanies:(cb)          => fb.subscribeAllCompanies(cb),
  setCompanyPlan:       (c, p)        => fb.setCompanyPlan(c, p),
  setCompanySuspended:  (c, s)        => fb.setCompanySuspended(c, s),

  // ── Company guards ────────────────────────────────────────────────────────────
  getCompanyGuards: (c)               => fb.getCompanyGuards(c),
  setGuardActive:   (uid, a)          => fb.setGuardActive(uid, a),

  // ── Offline sync ──────────────────────────────────────────────────────────────
  syncOfflineQueue: ()                => fb.syncOfflineQueue(),
};
