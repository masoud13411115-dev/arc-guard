/**
 * ARC Guard — Sync Manager (v6.0)
 *
 * Bridges the IndexedDB offline queue and the remote data adapter.
 *
 * New in v6:
 *   - Exponential backoff: 2s → 4s → 8s → 16s → 32s → 64s (6 retries max)
 *   - Dead letter queue: items failing > MAX_RETRIES moved automatically
 *   - Sync lock: prevents concurrent sync runs
 *   - Idempotency dedup: synced keys cached in localStorage to skip duplicate uploads
 *   - Transition log: last 50 events persisted in localStorage for diagnostics
 *   - useSyncManager hook exposes deadLetterCount + queueItems for admin UI
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getQueuedItems, removeQueuedItem, getDBQueueCount,
  enqueuePatrolLog, enqueueSosAlert, migrateLocalStorageQueue,
  updateQueuedItem, moveToDeadLetter, getDeadLetterCount,
  type QueuedItem,
} from "@/lib/localDB";
import { firebaseAdapter, localAdapter, getAdapterMode } from "@/lib/adapter";
import { isFirebaseReady } from "@/firebase";
import type { PatrolLog, Alert } from "@/types";

// ── Retry / backoff config ────────────────────────────────────────────────────

const BACKOFF_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 32_000, 64_000];
const MAX_RETRIES       = BACKOFF_DELAYS_MS.length;

function getBackoffDelay(attempts: number): number {
  const idx = Math.min(attempts, BACKOFF_DELAYS_MS.length - 1);
  return BACKOFF_DELAYS_MS[idx];
}

function isItemReadyToRetry(item: QueuedItem): boolean {
  if (item.attempts === 0) return true;
  if (!item.lastAttemptAt) return true;
  const delay = getBackoffDelay(item.attempts);
  return Date.now() - item.lastAttemptAt >= delay;
}

// ── Idempotency tracking (localStorage set of recently synced keys) ────────────

const SYNCED_KEYS_LS = "arc_guard_v6_synced_keys";
const MAX_SYNCED_KEYS = 200;

function getSyncedKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(SYNCED_KEYS_LS);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

function markAsSynced(key: string): void {
  try {
    const keys = getSyncedKeys();
    keys.add(key);
    const arr = Array.from(keys);
    if (arr.length > MAX_SYNCED_KEYS) arr.splice(0, arr.length - MAX_SYNCED_KEYS);
    localStorage.setItem(SYNCED_KEYS_LS, JSON.stringify(arr));
  } catch { /* private browsing */ }
}

function wasAlreadySynced(key: string): boolean {
  if (!key) return false;
  return getSyncedKeys().has(key);
}

// ── Transition log ─────────────────────────────────────────────────────────────

export type TransitionEvent =
  | "enqueued" | "sync_start" | "sync_ok" | "sync_failed"
  | "item_ok" | "item_failed" | "item_dead" | "item_dedup"
  | "online" | "offline" | "dead_letter_requeued";

export interface TransitionEntry {
  ts:      number;
  event:   TransitionEvent;
  detail?: string;
}

const TRANSITION_LOG_LS  = "arc_guard_v6_sync_log";
const MAX_TRANSITION_ENTRIES = 50;

export function getTransitionLog(): TransitionEntry[] {
  try {
    const raw = localStorage.getItem(TRANSITION_LOG_LS);
    return raw ? (JSON.parse(raw) as TransitionEntry[]) : [];
  } catch { return []; }
}

export function logTransition(event: TransitionEvent, detail?: string): void {
  try {
    const entries = getTransitionLog();
    entries.unshift({ ts: Date.now(), event, detail });
    if (entries.length > MAX_TRANSITION_ENTRIES) entries.splice(MAX_TRANSITION_ENTRIES);
    localStorage.setItem(TRANSITION_LOG_LS, JSON.stringify(entries));
  } catch { /* private browsing */ }
}

export function clearTransitionLog(): void {
  try { localStorage.removeItem(TRANSITION_LOG_LS); } catch { /* ok */ }
}

// ── Sync metadata ─────────────────────────────────────────────────────────────
const lastSyncKey = (cid: string) => `arc_guard_v5_last_sync_${cid}`;

export function getLastSyncAt(companyId: string): number | null {
  const raw = localStorage.getItem(lastSyncKey(companyId));
  return raw ? Number(raw) : null;
}

function persistLastSyncAt(companyId: string): void {
  localStorage.setItem(lastSyncKey(companyId), String(Date.now()));
}

// ── Sync lock (prevents concurrent runs) ──────────────────────────────────────

let _syncLocked = false;

function acquireSyncLock(): boolean {
  if (_syncLocked) return false;
  _syncLocked = true;
  return true;
}

function releaseSyncLock(): void {
  _syncLocked = false;
}

// ── Queue helpers ─────────────────────────────────────────────────────────────

export async function queuePatrolLog(companyId: string, log: PatrolLog): Promise<string> {
  const id = await enqueuePatrolLog(companyId, log);
  logTransition("enqueued", `patrol_log id=${id.slice(-8)} cp=${log.checkpointId ?? "?"}`);
  return id;
}

export async function queueSosAlert(companyId: string, alert: Omit<Alert, "id">): Promise<string> {
  const id = await enqueueSosAlert(companyId, alert);
  logTransition("enqueued", `sos_alert id=${id.slice(-8)} guard=${alert.guardId ?? "?"}`);
  return id;
}

// ── Sync a single item to the active remote adapter ───────────────────────────

async function syncItem(item: QueuedItem): Promise<boolean> {
  const mode = getAdapterMode();

  // IndexedDB mode — data already on device, nothing to push remotely
  if (mode === "indexeddb") return true;

  // Idempotency guard — if this exact operation was already uploaded, just remove it
  if (item.idempotencyKey && wasAlreadySynced(item.idempotencyKey)) {
    logTransition("item_dedup", `${item.type} ${item.id.slice(-8)} key=${item.idempotencyKey.slice(-16)}`);
    return true;
  }

  // Local server mode
  if (mode === "local") {
    try {
      if (item.type === "patrol_log") {
        await localAdapter.savePatrolLog(item.payload as unknown as PatrolLog);
      } else if (item.type === "sos_alert") {
        await localAdapter.saveAlert(item.payload as unknown as Alert);
      }
      if (item.idempotencyKey) markAsSynced(item.idempotencyKey);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[syncManager] local server sync failed for ${item.type} ${item.id}:`, msg);
      return false;
    }
  }

  // Firebase mode (default)
  if (!isFirebaseReady) return false;
  try {
    if (item.type === "patrol_log") {
      await firebaseAdapter.savePatrolLog(item.payload as unknown as PatrolLog);
    } else if (item.type === "sos_alert") {
      await firebaseAdapter.saveAlert(item.payload as unknown as Alert);
    }
    if (item.idempotencyKey) markAsSynced(item.idempotencyKey);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[syncManager] firebase sync failed for ${item.type} ${item.id}:`, msg);
    return false;
  }
}

// ── Sync all queued items for a company ───────────────────────────────────────

export interface SyncAllResult {
  synced:    number;
  failed:    number;
  skipped:   number;
  deadMoved: number;
}

export async function syncAll(companyId: string): Promise<SyncAllResult> {
  const mode = getAdapterMode();

  // IndexedDB mode — flush queue (data already saved locally)
  if (mode === "indexeddb") {
    const items = await getQueuedItems(companyId);
    for (const item of items) await removeQueuedItem(item.id);
    if (items.length > 0) persistLastSyncAt(companyId);
    return { synced: items.length, failed: 0, skipped: 0, deadMoved: 0 };
  }

  // Remote modes — need network
  if (!navigator.onLine) return { synced: 0, failed: 0, skipped: 0, deadMoved: 0 };
  if (mode === "firebase" && !isFirebaseReady) return { synced: 0, failed: 0, skipped: 0, deadMoved: 0 };

  const items = await getQueuedItems(companyId);
  if (items.length === 0) return { synced: 0, failed: 0, skipped: 0, deadMoved: 0 };

  logTransition("sync_start", `${items.length} items, mode=${mode}`);

  let synced    = 0;
  let failed    = 0;
  let skipped   = 0;
  let deadMoved = 0;

  for (const item of items) {
    // Dead letter check — exhausted all retries
    if (item.attempts >= MAX_RETRIES) {
      await moveToDeadLetter(item.id);
      deadMoved++;
      logTransition("item_dead", `${item.type} ${item.id.slice(-8)} after ${item.attempts} attempts`);
      continue;
    }

    // Backoff check — not ready to retry yet
    if (!isItemReadyToRetry(item)) {
      skipped++;
      continue;
    }

    // Mark as syncing
    await updateQueuedItem(item.id, { status: "syncing" });

    const ok = await syncItem(item);
    if (ok) {
      await removeQueuedItem(item.id);
      synced++;
      logTransition("item_ok", `${item.type} ${item.id.slice(-8)}`);
    } else {
      const newAttempts = item.attempts + 1;
      const isDead      = newAttempts >= MAX_RETRIES;

      if (isDead) {
        await moveToDeadLetter(item.id);
        deadMoved++;
        logTransition("item_dead", `${item.type} ${item.id.slice(-8)} after ${newAttempts} attempts`);
      } else {
        await updateQueuedItem(item.id, {
          status:        "failed",
          attempts:      newAttempts,
          lastAttemptAt: Date.now(),
          lastError:     `Attempt ${newAttempts} failed`,
        });
        failed++;
        logTransition("item_failed", `${item.type} ${item.id.slice(-8)} attempt=${newAttempts} backoff=${getBackoffDelay(newAttempts) / 1000}s`);
      }
    }
  }

  if (synced > 0) {
    persistLastSyncAt(companyId);
    logTransition("sync_ok", `synced=${synced} failed=${failed} dead=${deadMoved} mode=${mode}`);
    console.log(`[syncManager] synced ${synced} items (${mode}) for company ${companyId.slice(-6)}`);
  } else if (failed > 0) {
    logTransition("sync_failed", `all ${failed} item(s) failed`);
  }

  return { synced, failed, skipped, deadMoved };
}

// ── React hook ────────────────────────────────────────────────────────────────

export interface SyncState {
  online:          boolean;
  pendingCount:    number;
  deadLetterCount: number;
  queueItems:      QueuedItem[];
  lastSyncAt:      number | null;
  isSyncing:       boolean;
  syncNow:         () => void;
}

export function useSyncManager(companyId: string): SyncState {
  const [online,          setOnline]          = useState(navigator.onLine);
  const [pendingCount,    setPendingCount]     = useState(0);
  const [deadLetterCount, setDeadLetterCount]  = useState(0);
  const [queueItems,      setQueueItems]       = useState<QueuedItem[]>([]);
  const [lastSyncAt,      setLastSyncAtSt]     = useState<number | null>(() => getLastSyncAt(companyId));
  const [isSyncing,       setIsSyncing]        = useState(false);

  const migrated   = useRef(false);
  const syncingRef = useRef(false);

  const refreshState = useCallback(async () => {
    const [items, dlCount] = await Promise.all([
      getQueuedItems(companyId),
      getDeadLetterCount(companyId),
    ]);
    setPendingCount(items.length);
    setQueueItems(items);
    setDeadLetterCount(dlCount);
  }, [companyId]);

  const doSync = useCallback(async () => {
    const mode = getAdapterMode();
    if (mode !== "indexeddb" && !navigator.onLine) return;
    if (syncingRef.current) return;
    if (!acquireSyncLock()) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      await syncAll(companyId);
      setLastSyncAtSt(getLastSyncAt(companyId));
      await refreshState();
    } finally {
      syncingRef.current = false;
      releaseSyncLock();
      setIsSyncing(false);
    }
  }, [companyId, refreshState]);

  // One-time migration from legacy localStorage queue
  useEffect(() => {
    if (migrated.current) return;
    migrated.current = true;
    migrateLocalStorageQueue()
      .then(() => refreshState())
      .catch(console.error);
  }, [refreshState]);

  // Online / offline event listeners
  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      logTransition("online");
      doSync();
    };
    const onOffline = () => {
      setOnline(false);
      logTransition("offline");
    };
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [doSync]);

  // Periodic refresh (poll queue state every 15s)
  useEffect(() => {
    const id = setInterval(refreshState, 15_000);
    return () => clearInterval(id);
  }, [refreshState]);

  // Auto-sync when online and there are pending items
  useEffect(() => {
    const mode   = getAdapterMode();
    const canSync = mode === "indexeddb" || online;
    if (canSync && pendingCount > 0 && !syncingRef.current) doSync();
  }, [online, pendingCount, doSync]);

  return { online, pendingCount, deadLetterCount, queueItems, lastSyncAt, isSyncing, syncNow: doSync };
}
