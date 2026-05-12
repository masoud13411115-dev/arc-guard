/**
 * Adapter index — single import point for all data-access operations.
 *
 * Usage (drop-in replacement for @/lib/firestore):
 *
 *   import { saveCheckpoint, subscribeAlerts, … } from "@/lib/adapter";
 *
 * The active adapter is chosen at runtime by `getAdapterMode()`.
 * Switching mode writes to localStorage and reloads the page.
 *
 * Re-exported helpers (checkpointPath, subscribeMissedAlerts) keep full
 * backwards-compatibility with all existing call-sites.
 */

import type { DataAdapter, AdapterMode } from "./types";
import { firebaseAdapter }              from "./firebaseAdapter";
import { localAdapter }                 from "./localAdapter";

export type { AdapterMode, DataAdapter };
export { firebaseAdapter, localAdapter };

// ── Mode persistence ──────────────────────────────────────────────────────────
const MODE_KEY = "arc_guard_adapter_mode";
const MODE_CHANGE_EVENT = "arc-guard-adapter-mode-change";

/** Returns the persisted adapter mode; defaults to "firebase". */
export function getAdapterMode(): AdapterMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === "local" || v === "firebase") return v;
  } catch { /* SSR / private browsing */ }
  return "firebase";
}

/**
 * Persist the new mode.
 * Fires a `CustomEvent` on `window` so any listener can react,
 * then reloads the page after 200 ms to apply the change cleanly.
 */
export function setAdapterMode(mode: AdapterMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch { /* SSR / private browsing */ }
  window.dispatchEvent(
    new CustomEvent(MODE_CHANGE_EVENT, { detail: { mode } }),
  );
  setTimeout(() => window.location.reload(), 200);
}

/** Returns the active DataAdapter based on the current mode. */
export function getAdapter(): DataAdapter {
  return getAdapterMode() === "local" ? localAdapter : firebaseAdapter;
}

// ── Forwarding exports ────────────────────────────────────────────────────────
// Each export calls `getAdapter()` at invocation time, so switching the mode
// and reloading is all that is needed — no module cache to bust.

export const saveCheckpoint:        DataAdapter["saveCheckpoint"]        = (...a) => getAdapter().saveCheckpoint(...a);
export const updateCheckpoint:      DataAdapter["updateCheckpoint"]      = (...a) => getAdapter().updateCheckpoint(...a);
export const deleteCheckpoint:      DataAdapter["deleteCheckpoint"]      = (...a) => getAdapter().deleteCheckpoint(...a);
export const subscribeCheckpoints:  DataAdapter["subscribeCheckpoints"]  = (...a) => getAdapter().subscribeCheckpoints(...a);
export const getCheckpoints:        DataAdapter["getCheckpoints"]        = (...a) => getAdapter().getCheckpoints(...a);

export const savePatrolLog:         DataAdapter["savePatrolLog"]         = (...a) => getAdapter().savePatrolLog(...a);
export const subscribePatrolLogs:   DataAdapter["subscribePatrolLogs"]   = (...a) => getAdapter().subscribePatrolLogs(...a);
export const getPatrolLogs:         DataAdapter["getPatrolLogs"]         = (...a) => getAdapter().getPatrolLogs(...a);

export const updateGuardSession:    DataAdapter["updateGuardSession"]    = (...a) => getAdapter().updateGuardSession(...a);
export const subscribeGuardSessions:DataAdapter["subscribeGuardSessions"]= (...a) => getAdapter().subscribeGuardSessions(...a);

export const saveAlert:             DataAdapter["saveAlert"]             = (...a) => getAdapter().saveAlert(...a);
export const saveMissedAlert:       DataAdapter["saveMissedAlert"]       = (...a) => getAdapter().saveMissedAlert(...a);
export const subscribeAlerts:       DataAdapter["subscribeAlerts"]       = (...a) => getAdapter().subscribeAlerts(...a);
export const getAlertHistory:       DataAdapter["getAlertHistory"]       = (...a) => getAdapter().getAlertHistory(...a);
export const resolveAlert:          DataAdapter["resolveAlert"]          = (...a) => getAdapter().resolveAlert(...a);

export const getCompany:            DataAdapter["getCompany"]            = (...a) => getAdapter().getCompany(...a);
export const updateCompany:         DataAdapter["updateCompany"]         = (...a) => getAdapter().updateCompany(...a);
export const regenerateInviteCode:  DataAdapter["regenerateInviteCode"]  = (...a) => getAdapter().regenerateInviteCode(...a);
export const getAllCompanies:        DataAdapter["getAllCompanies"]        = ()     => getAdapter().getAllCompanies();
export const subscribeAllCompanies: DataAdapter["subscribeAllCompanies"] = (...a) => getAdapter().subscribeAllCompanies(...a);
export const setCompanyPlan:        DataAdapter["setCompanyPlan"]        = (...a) => getAdapter().setCompanyPlan(...a);
export const setCompanySuspended:   DataAdapter["setCompanySuspended"]   = (...a) => getAdapter().setCompanySuspended(...a);

export const getCompanyGuards:      DataAdapter["getCompanyGuards"]      = (...a) => getAdapter().getCompanyGuards(...a);
export const setGuardActive:        DataAdapter["setGuardActive"]        = (...a) => getAdapter().setGuardActive(...a);

export const syncOfflineQueue:      DataAdapter["syncOfflineQueue"]      = ()     => getAdapter().syncOfflineQueue();

// ── Backwards-compat aliases ──────────────────────────────────────────────────
/** @deprecated alias for subscribeAlerts */
export const subscribeMissedAlerts = subscribeAlerts;

/** Firestore path helper — re-exported for CheckpointManager compatibility */
export { checkpointPath } from "@/lib/firestore";
