/**
 * ARC Guard — Sync Manager (v5.0)
 *
 * Bridges the IndexedDB offline queue and the remote data adapter.
 *
 * - queuePatrolLog / queueSosAlert  — write to IndexedDB when offline / on error
 * - syncAll(companyId)              — flush pending queue to the active remote adapter
 * - useSyncManager(companyId)       — React hook providing reactive sync state
 *
 * Sync routing by adapter mode:
 *   firebase   → syncs to firebaseAdapter (cloud)
 *   local      → syncs to localAdapter (company LAN server)
 *   indexeddb  → data is already local; just clears the queue
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getQueuedItems, removeQueuedItem, getDBQueueCount,
  enqueuePatrolLog, enqueueSosAlert, migrateLocalStorageQueue,
  type QueuedItem,
} from "@/lib/localDB";
import { firebaseAdapter, localAdapter, getAdapterMode } from "@/lib/adapter";
import { isFirebaseReady } from "@/firebase";
import type { PatrolLog, Alert } from "@/types";

// ── Sync metadata ─────────────────────────────────────────────────────────────
const lastSyncKey = (cid: string) => `arc_guard_v5_last_sync_${cid}`;

export function getLastSyncAt(companyId: string): number | null {
  const raw = localStorage.getItem(lastSyncKey(companyId));
  return raw ? Number(raw) : null;
}

function persistLastSyncAt(companyId: string): void {
  localStorage.setItem(lastSyncKey(companyId), String(Date.now()));
}

// ── Queue helpers ─────────────────────────────────────────────────────────────

export async function queuePatrolLog(companyId: string, log: PatrolLog): Promise<string> {
  return enqueuePatrolLog(companyId, log);
}

export async function queueSosAlert(companyId: string, alert: Omit<Alert, "id">): Promise<string> {
  return enqueueSosAlert(companyId, alert);
}

// ── Sync a single item to the active remote adapter ───────────────────────────

async function syncItem(item: QueuedItem): Promise<boolean> {
  const mode = getAdapterMode();

  // IndexedDB mode — data already on device, nothing to push remotely
  if (mode === "indexeddb") return true;

  // Local server mode
  if (mode === "local") {
    try {
      if (item.type === "patrol_log") {
        await localAdapter.savePatrolLog(item.payload as unknown as PatrolLog);
      } else if (item.type === "sos_alert") {
        await localAdapter.saveAlert(item.payload as unknown as Alert);
      }
      return true;
    } catch (e) {
      console.error(`[syncManager] local server sync failed for ${item.type} ${item.id}:`, e);
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
    return true;
  } catch (e) {
    console.error(`[syncManager] firebase sync failed for ${item.type} ${item.id}:`, e);
    return false;
  }
}

// ── Sync all queued items for a company ───────────────────────────────────────

export interface SyncAllResult {
  synced: number;
  failed: number;
}

export async function syncAll(companyId: string): Promise<SyncAllResult> {
  const mode = getAdapterMode();

  // IndexedDB mode — flush queue (data already saved locally)
  if (mode === "indexeddb") {
    const items = await getQueuedItems(companyId);
    for (const item of items) await removeQueuedItem(item.id);
    if (items.length > 0) persistLastSyncAt(companyId);
    return { synced: items.length, failed: 0 };
  }

  // Remote modes — need network
  if (!navigator.onLine) return { synced: 0, failed: 0 };
  if (mode === "firebase" && !isFirebaseReady) return { synced: 0, failed: 0 };

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
    console.log(`[syncManager] synced ${synced} items (${mode}) for company ${companyId.slice(-6)}`);
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
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    const n = await getDBQueueCount(companyId);
    setPendingCount(n);
  }, [companyId]);

  const doSync = useCallback(async () => {
    const mode = getAdapterMode();
    // Only wait for network in non-indexeddb modes
    if (mode !== "indexeddb" && !navigator.onLine) return;
    if (syncingRef.current) return;
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

  useEffect(() => {
    if (migrated.current) return;
    migrated.current = true;
    migrateLocalStorageQueue()
      .then(() => refreshCount())
      .catch(console.error);
  }, [refreshCount]);

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

  useEffect(() => {
    const id = setInterval(refreshCount, 30_000);
    return () => clearInterval(id);
  }, [refreshCount]);

  useEffect(() => {
    const mode = getAdapterMode();
    const canSync = mode === "indexeddb" || online;
    if (canSync && pendingCount > 0 && !syncingRef.current) doSync();
  }, [online, pendingCount, doSync]);

  return { online, pendingCount, lastSyncAt, isSyncing, syncNow: doSync };
}
