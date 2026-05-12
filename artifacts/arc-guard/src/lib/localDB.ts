/**
 * ARC Guard — Local IndexedDB Layer (v4.0)
 *
 * Uses the `idb` library to provide a typed, promise-based IndexedDB interface.
 * Two stores:
 *   - offlineQueue   — patrol logs + SOS alerts queued while offline
 *   - cachedCheckpoints — last-known checkpoint list per company (offline scanning)
 *
 * Also provides one-time migration from the legacy localStorage queue.
 */

import { openDB, type IDBPDatabase } from "idb";
import type { Checkpoint, PatrolLog, Alert } from "@/types";

// ── DB config ─────────────────────────────────────────────────────────────────
const DB_NAME    = "arc-guard-offline";
const DB_VERSION = 5; // v5 — add cachedManagerData for manager dashboard offline

export type QueueItemType = "patrol_log" | "sos_alert";

export interface QueuedItem {
  id:            string;
  type:          QueueItemType;
  companyId:     string;
  payload:       Record<string, unknown>;
  createdAt:     number;
  attempts:      number;
  lastAttemptAt: number | null;
}

interface CachedCheckpointRecord {
  companyId: string;
  data:      Checkpoint[];
  updatedAt: number;
}

interface CachedManagerDataRecord {
  key:       string; // `{companyId}:{type}`
  companyId: string;
  type:      string;
  data:      unknown[];
  updatedAt: number;
}

// ── IDB schema type ───────────────────────────────────────────────────────────
type ArcDB = {
  offlineQueue: {
    key:     string;
    value:   QueuedItem;
    indexes: { byCompany: string; byType: QueueItemType; byCreatedAt: number };
  };
  cachedCheckpoints: {
    key:   string; // companyId
    value: CachedCheckpointRecord;
  };
  cachedManagerData: {
    key:   string; // `{companyId}:{type}`
    value: CachedManagerDataRecord;
  };
};

// ── Singleton DB promise ──────────────────────────────────────────────────────
let _db: Promise<IDBPDatabase<ArcDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ArcDB>> {
  if (!_db) {
    _db = openDB<ArcDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Drop old stores from previous schema versions
        if (oldVersion < 4) {
          for (const name of Array.from(db.objectStoreNames)) {
            db.deleteObjectStore(name);
          }
        }
        // offlineQueue
        if (!db.objectStoreNames.contains("offlineQueue")) {
          const s = db.createObjectStore("offlineQueue", { keyPath: "id" });
          s.createIndex("byCompany",   "companyId");
          s.createIndex("byType",      "type");
          s.createIndex("byCreatedAt", "createdAt");
        }
        // cachedCheckpoints
        if (!db.objectStoreNames.contains("cachedCheckpoints")) {
          db.createObjectStore("cachedCheckpoints", { keyPath: "companyId" });
        }
        // v5: manager dashboard data cache (patrolLogs, sessions, alerts, checkpoints)
        if (!db.objectStoreNames.contains("cachedManagerData")) {
          db.createObjectStore("cachedManagerData", { keyPath: "key" });
        }
      },
    });
  }
  return _db;
}

// ── Offline queue ─────────────────────────────────────────────────────────────

export async function enqueueItem(
  item: Omit<QueuedItem, "attempts" | "lastAttemptAt">,
): Promise<void> {
  const db = await getDB();
  await db.put("offlineQueue", { ...item, attempts: 0, lastAttemptAt: null });
}

/** Add a patrol log to the offline queue. Returns the generated queue ID. */
export async function enqueuePatrolLog(companyId: string, log: PatrolLog): Promise<string> {
  const id = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await enqueueItem({ id, type: "patrol_log", companyId, payload: log as unknown as Record<string, unknown>, createdAt: Date.now() });
  return id;
}

/** Add a SOS alert to the offline queue. Returns the generated queue ID. */
export async function enqueueSosAlert(companyId: string, alert: Omit<Alert, "id">): Promise<string> {
  const id = `sos_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await enqueueItem({ id, type: "sos_alert", companyId, payload: alert as unknown as Record<string, unknown>, createdAt: Date.now() });
  return id;
}

/** Get all queued items for a company, oldest first. */
export async function getQueuedItems(companyId: string): Promise<QueuedItem[]> {
  const db  = await getDB();
  const all = await db.getAllFromIndex("offlineQueue", "byCompany", companyId);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeQueuedItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("offlineQueue", id);
}

export async function getDBQueueCount(companyId?: string): Promise<number> {
  const db = await getDB();
  if (companyId) {
    const items = await db.getAllFromIndex("offlineQueue", "byCompany", companyId);
    return items.length;
  }
  return db.count("offlineQueue");
}

export async function clearOfflineQueue(companyId: string): Promise<void> {
  const items = await getQueuedItems(companyId);
  const db    = await getDB();
  const tx    = db.transaction("offlineQueue", "readwrite");
  await Promise.all([...items.map((i) => tx.store.delete(i.id)), tx.done]);
}

// ── Checkpoint cache ──────────────────────────────────────────────────────────

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1_000; // 24 hours

/** Persist current checkpoint list to IndexedDB for offline scanning. */
export async function cacheCheckpoints(companyId: string, data: Checkpoint[]): Promise<void> {
  const db = await getDB();
  await db.put("cachedCheckpoints", { companyId, data, updatedAt: Date.now() });
}

/**
 * Load cached checkpoints. Returns null if never cached or older than 24 hours.
 * In offline mode the 24-hour limit is relaxed — stale is better than empty.
 */
export async function getCachedCheckpoints(
  companyId: string,
  { allowStale = false }: { allowStale?: boolean } = {},
): Promise<Checkpoint[] | null> {
  const db  = await getDB();
  const rec = await db.get("cachedCheckpoints", companyId);
  if (!rec || !rec.data.length) return null;
  if (!allowStale && Date.now() - rec.updatedAt > CACHE_MAX_AGE_MS) return null;
  return rec.data;
}

export async function getCheckpointCacheAge(companyId: string): Promise<number | null> {
  const db  = await getDB();
  const rec = await db.get("cachedCheckpoints", companyId);
  return rec?.updatedAt ?? null;
}

// ── Local storage size estimate ────────────────────────────────────────────────

export async function estimateLocalDBSize(): Promise<{ bytes: number; formatted: string }> {
  try {
    if ("storage" in navigator && "estimate" in navigator.storage) {
      const est  = await navigator.storage.estimate();
      const used = est.usage ?? 0;
      return { bytes: used, formatted: fmtBytes(used) };
    }
    // Fallback: sum localStorage values
    let size = 0;
    for (const key of Object.keys(localStorage)) {
      size += (localStorage.getItem(key) ?? "").length * 2;
    }
    return { bytes: size, formatted: fmtBytes(size) };
  } catch {
    return { bytes: 0, formatted: "—" };
  }
}

function fmtBytes(b: number): string {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1_024)     return `${(b / 1_024).toFixed(0)} KB`;
  return `${b} B`;
}

// ── Manager dashboard data cache (v5) ─────────────────────────────────────────

/** Persist manager dashboard collection data for offline access. */
export async function cacheManagerData(
  companyId: string,
  type: string,
  data: unknown[],
): Promise<void> {
  const db = await getDB();
  const key = `${companyId}:${type}`;
  await db.put("cachedManagerData", { key, companyId, type, data, updatedAt: Date.now() });
}

/**
 * Load cached manager dashboard data for a given type.
 * Returns null if no cache exists yet.
 */
export async function getCachedManagerData(
  companyId: string,
  type: string,
): Promise<unknown[] | null> {
  const db = await getDB();
  const rec = await db.get("cachedManagerData", `${companyId}:${type}`);
  return rec?.data ?? null;
}

// ── One-time migration from legacy localStorage queue ─────────────────────────

const MIGRATED_KEY = "arc_guard_v4_migrated";

export async function migrateLocalStorageQueue(): Promise<number> {
  if (localStorage.getItem(MIGRATED_KEY)) return 0;
  const LEGACY_KEY = "arc_guard_offline_queue";
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) { localStorage.setItem(MIGRATED_KEY, "1"); return 0; }
    const items = JSON.parse(raw) as Array<{
      id: string; payload: Record<string, unknown>; createdAt: number;
    }>;
    let migrated = 0;
    for (const item of items) {
      const cid = (item.payload?.companyId as string) ?? "unknown";
      await enqueueItem({
        id: item.id, type: "patrol_log", companyId: cid,
        payload: item.payload, createdAt: item.createdAt,
      });
      migrated++;
    }
    localStorage.removeItem(LEGACY_KEY);
    localStorage.setItem(MIGRATED_KEY, "1");
    if (migrated > 0) console.log(`[localDB] migrated ${migrated} items from localStorage → IndexedDB`);
    return migrated;
  } catch (e) {
    console.error("[localDB] migration error:", e);
    localStorage.setItem(MIGRATED_KEY, "1"); // don't retry on error
    return 0;
  }
}
