/**
 * ARC Guard — Sync Manager (v4.0)
 *
 * Bridges the IndexedDB offline queue and the Firebase adapter.
 * - queuePatrolLog / queueSosAlert  — write to IndexedDB when offline (or on Firebase error)
 * - syncAll(companyId)              — flush pending queue to Firebase
 * - useSyncManager(companyId)       — React hook providing reactive sync state
 *
 * Always syncs to Firebase directly (bypass the local adapter), because we
 * want cloud persistence regardless of which adapter mode is selected.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getQueuedItems, removeQueuedItem, getDBQueueCount,
  enqueuePatrolLog, enqueueSosAlert, migrateLocalStorageQueue,
  type QueuedItem,
} from "@/lib/localDB";
import { firebaseAdapter } from "@/lib/adapter";
import { isFirebaseReady } from "@/firebase";
import type { PatrolLog, Alert } from "@/types";

// ── Sync metadata (localStorage — tiny data, just timestamps) ─────────────────
const lastSyncKey = (cid: string) => `arc_guard_v4_last_sync_${cid}`;

export function getLastSyncAt(companyId: string): number | null {
  const raw = localStorage.getItem(lastSyncKey(companyId));
  return raw ? Number(raw) : null;
}

function persistLastSyncAt(companyId: string): void {
  localStorage.setItem(lastSyncKey(companyId), String(Date.now()));
}

// ── Queue helpers ─────────────────────────────────────────────────────────────

/** Queue a patrol log to IndexedDB for later sync. */
export async function queuePatrolLog(companyId: string, log: PatrolLog): Promise<string> {
  return enqueuePatrolLog(companyId, log);
}

/** Queue an SOS alert to IndexedDB for later sync. */
export async function queueSosAlert(companyId: string, alert: Omit<Alert, "id">): Promise<string> {
  return enqueueSosAlert(companyId, alert);
}

// ── Sync a single item to Firebase ───────────────────────────────────────────

async function syncItem(item: QueuedItem): Promise<boolean> {
  if (!isFirebaseReady) return false;
  try {
    if (item.type === "patrol_log") {
      await firebaseAdapter.savePatrolLog(item.payload as unknown as PatrolLog);
    } else if (item.type === "sos_alert") {
      await firebaseAdapter.saveAlert(item.payload as unknown as Alert);
    }
    return true;
  } catch (e) {
    console.error(`[syncManager] failed to sync ${item.type} ${item.id}:`, e);
    return false;
  }
}

// ── Sync all queued items for a company ───────────────────────────────────────

export interface SyncAllResult {
  synced: number;
  failed: number;
}

export async function syncAll(companyId: string): Promise<SyncAllResult> {
  if (!navigator.onLine || !isFirebaseReady) return { synced: 0, failed: 0 };
  const items = await getQueuedItems(companyId);
  if (items.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of items) {
    const ok = await syncItem(item);
    if (ok) {
      await removeQueuedItem(item.id);
      synced++;
    } else {
      failed++;
    }
  }

  if (synced > 0) {
    persistLastSyncAt(companyId);
    console.log(`[syncManager] synced ${synced} items for company ${companyId.slice(-6)}`);
  }
  return { synced, failed };
}

// ── React hook ────────────────────────────────────────────────────────────────

export interface SyncState {
  online:       boolean;
  pendingCount: number;
  lastSyncAt:   number | null;
  isSyncing:    boolean;
  syncNow:      () => void;
}

export function useSyncManager(companyId: string): SyncState {
  const [online,       setOnline]       = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt,   setLastSyncAtSt] = useState<number | null>(() => getLastSyncAt(companyId));
  const [isSyncing,    setIsSyncing]    = useState(false);

  const migrated   = useRef(false);
  const syncingRef = useRef(false); // avoid concurrent syncs

  // Refresh pending count from IndexedDB
  const refreshCount = useCallback(async () => {
    const n = await getDBQueueCount(companyId);
    setPendingCount(n);
  }, [companyId]);

  // Run full sync
  const doSync = useCallback(async () => {
    if (!navigator.onLine || syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      await syncAll(companyId);
      setLastSyncAtSt(getLastSyncAt(companyId));
      await refreshCount();
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [companyId, refreshCount]);

  // Init: one-time localStorage migration + initial count
  useEffect(() => {
    if (migrated.current) return;
    migrated.current = true;
    migrateLocalStorageQueue()
      .then(() => refreshCount())
      .catch(console.error);
  }, [refreshCount]);

  // Network events
  useEffect(() => {
    const onOnline  = () => { setOnline(true);  doSync(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [doSync]);

  // Poll count every 30 s
  useEffect(() => {
    const id = setInterval(refreshCount, 30_000);
    return () => clearInterval(id);
  }, [refreshCount]);

  // Auto-sync when online and items are waiting
  useEffect(() => {
    if (online && pendingCount > 0 && !syncingRef.current) doSync();
  }, [online, pendingCount, doSync]);

  return {
    online,
    pendingCount,
    lastSyncAt,
    isSyncing,
    syncNow: doSync,
  };
}
