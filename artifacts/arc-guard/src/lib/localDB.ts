/**
 * ARC Guard — Local IndexedDB Layer (v7.0)
 *
 * Uses the `idb` library to provide a typed, promise-based IndexedDB interface.
 *
 * Stores:
 *   offlineQueue       — patrol logs + SOS alerts queued for sync (with retry tracking)
 *   deadLetter         — items that failed > MAX_RETRIES and are parked for manual review (v7)
 *   cachedCheckpoints  — last-known checkpoint list per company (offline scanning)
 *   cachedManagerData  — manager dashboard cache (v5)
 *   localCheckpoints   — primary checkpoint storage for indexeddb adapter mode (v6)
 *   localPatrolLogs    — primary patrol log storage for indexeddb adapter mode (v6)
 *   localGuardSessions — primary guard session storage for indexeddb adapter mode (v6)
 *   localAlerts        — primary alert storage for indexeddb adapter mode (v6)
 *   localCompanies     — company records for indexeddb adapter mode (v6)
 *
 * v7 changes:
 *   - QueuedItem gains: status, lastError, idempotencyKey
 *   - New `deadLetter` store for items that exhausted retries
 *   - New helpers: updateQueuedItem, moveToDeadLetter, getDeadLetterItems,
 *     deleteDeadLetterItem, requeueDeadLetterItem, getDeadLetterCount
 */

import { openDB, type IDBPDatabase } from "idb";
import type { Checkpoint, PatrolLog, Alert, GuardSession, CompanyRecord } from "@/types";

// ── DB config ─────────────────────────────────────────────────────────────────
const DB_NAME    = "arc-guard-offline";
const DB_VERSION = 7;

export type QueueItemType   = "patrol_log" | "sos_alert";
export type QueueItemStatus = "pending" | "syncing" | "failed" | "dead";

export interface QueuedItem {
  id:               string;
  type:             QueueItemType;
  companyId:        string;
  payload:          Record<string, unknown>;
  createdAt:        number;
  attempts:         number;
  lastAttemptAt:    number | null;
  status:           QueueItemStatus;
  lastError:        string | null;
  idempotencyKey:   string;
}

export interface DeadLetterItem extends QueuedItem {
  diedAt: number;
}

interface CachedCheckpointRecord {
  companyId: string;
  data:      Checkpoint[];
  updatedAt: number;
}

interface CachedManagerDataRecord {
  key:       string;
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
  deadLetter: {
    key:     string;
    value:   DeadLetterItem;
    indexes: { byCompany: string; byDiedAt: number };
  };
  cachedCheckpoints: {
    key:   string;
    value: CachedCheckpointRecord;
  };
  cachedManagerData: {
    key:   string;
    value: CachedManagerDataRecord;
  };
  localCheckpoints: {
    key:     string;
    value:   Checkpoint;
    indexes: { byCompany: string };
  };
  localPatrolLogs: {
    key:     string;
    value:   PatrolLog & { id: string };
    indexes: { byCompany: string; byCreatedAt: number };
  };
  localGuardSessions: {
    key:     string;
    value:   GuardSession;
    indexes: { byCompany: string };
  };
  localAlerts: {
    key:     string;
    value:   Alert & { id: string };
    indexes: { byCompany: string; byCreatedAt: number };
  };
  localCompanies: {
    key:   string;
    value: CompanyRecord;
  };
};

// ── Singleton DB promise ──────────────────────────────────────────────────────
let _db: Promise<IDBPDatabase<ArcDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ArcDB>> {
  if (!_db) {
    _db = openDB<ArcDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Full wipe for pre-v4 schemas (incompatible store layout)
        if (oldVersion < 4) {
          for (const name of Array.from(db.objectStoreNames)) {
            db.deleteObjectStore(name);
          }
        }
        if (!db.objectStoreNames.contains("offlineQueue")) {
          const s = db.createObjectStore("offlineQueue", { keyPath: "id" });
          s.createIndex("byCompany",   "companyId");
          s.createIndex("byType",      "type");
          s.createIndex("byCreatedAt", "createdAt");
        }
        if (!db.objectStoreNames.contains("cachedCheckpoints")) {
          db.createObjectStore("cachedCheckpoints", { keyPath: "companyId" });
        }
        if (!db.objectStoreNames.contains("cachedManagerData")) {
          db.createObjectStore("cachedManagerData", { keyPath: "key" });
        }
        // v6 — local data stores for indexeddb adapter mode
        if (!db.objectStoreNames.contains("localCheckpoints")) {
          const s = db.createObjectStore("localCheckpoints", { keyPath: "id" });
          s.createIndex("byCompany", "companyId");
        }
        if (!db.objectStoreNames.contains("localPatrolLogs")) {
          const s = db.createObjectStore("localPatrolLogs", { keyPath: "id" });
          s.createIndex("byCompany",   "companyId");
          s.createIndex("byCreatedAt", "scannedAt");
        }
        if (!db.objectStoreNames.contains("localGuardSessions")) {
          const s = db.createObjectStore("localGuardSessions", { keyPath: "guardId" });
          s.createIndex("byCompany", "companyId");
        }
        if (!db.objectStoreNames.contains("localAlerts")) {
          const s = db.createObjectStore("localAlerts", { keyPath: "id" });
          s.createIndex("byCompany",   "companyId");
          s.createIndex("byCreatedAt", "alertedAt");
        }
        if (!db.objectStoreNames.contains("localCompanies")) {
          db.createObjectStore("localCompanies", { keyPath: "id" });
        }
        // v7 — dead letter queue for items that exhausted all retries
        if (!db.objectStoreNames.contains("deadLetter")) {
          const s = db.createObjectStore("deadLetter", { keyPath: "id" });
          s.createIndex("byCompany", "companyId");
          s.createIndex("byDiedAt",  "diedAt");
        }
      },
    });
  }
  return _db;
}

// ── Idempotency key builder ───────────────────────────────────────────────────
// Prevents duplicate uploads when a sync request times out but the server saved it.
// Same guard + checkpoint + 30s time bucket = same idempotency key.

export function buildIdempotencyKey(
  type: QueueItemType,
  payload: Record<string, unknown>,
): string {
  if (type === "patrol_log") {
    const cid       = (payload.companyId   as string) ?? "";
    const cpId      = (payload.checkpointId as string) ?? "";
    const guardId   = (payload.guardId     as string) ?? "";
    const scannedAt = (payload.scannedAt   as number) ?? Date.now();
    const bucket    = Math.floor(scannedAt / 30_000);  // 30-second buckets
    return `pl|${cid}|${cpId}|${guardId}|${bucket}`;
  }
  if (type === "sos_alert") {
    const cid       = (payload.companyId as string) ?? "";
    const guardId   = (payload.guardId   as string) ?? "";
    const alertedAt = (payload.alertedAt as number) ?? Date.now();
    const bucket    = Math.floor(alertedAt / 60_000); // 1-minute buckets for SOS
    return `sos|${cid}|${guardId}|${bucket}`;
  }
  return `${type}|${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── Offline queue ─────────────────────────────────────────────────────────────

export async function enqueueItem(
  item: Omit<QueuedItem, "attempts" | "lastAttemptAt" | "status" | "lastError">,
): Promise<void> {
  const db = await getDB();
  await db.put("offlineQueue", {
    ...item,
    attempts:      0,
    lastAttemptAt: null,
    status:        "pending",
    lastError:     null,
  });
}

export async function enqueuePatrolLog(companyId: string, log: PatrolLog): Promise<string> {
  const id              = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const idempotencyKey  = buildIdempotencyKey("patrol_log", log as unknown as Record<string, unknown>);
  await enqueueItem({
    id, type: "patrol_log", companyId,
    payload: log as unknown as Record<string, unknown>,
    createdAt: Date.now(),
    idempotencyKey,
  });
  return id;
}

export async function enqueueSosAlert(companyId: string, alert: Omit<Alert, "id">): Promise<string> {
  const id             = `sos_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const idempotencyKey = buildIdempotencyKey("sos_alert", alert as unknown as Record<string, unknown>);
  await enqueueItem({
    id, type: "sos_alert", companyId,
    payload: alert as unknown as Record<string, unknown>,
    createdAt: Date.now(),
    idempotencyKey,
  });
  return id;
}

export async function getQueuedItems(companyId: string): Promise<QueuedItem[]> {
  const db  = await getDB();
  const all = await db.getAllFromIndex("offlineQueue", "byCompany", companyId);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateQueuedItem(id: string, update: Partial<QueuedItem>): Promise<void> {
  const db  = await getDB();
  const rec = await db.get("offlineQueue", id);
  if (!rec) return;
  await db.put("offlineQueue", { ...rec, ...update });
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

// ── Dead letter queue ─────────────────────────────────────────────────────────

export async function moveToDeadLetter(id: string): Promise<void> {
  const db  = await getDB();
  const rec = await db.get("offlineQueue", id);
  if (!rec) return;
  const dead: DeadLetterItem = { ...rec, status: "dead", diedAt: Date.now() };
  await db.put("deadLetter", dead);
  await db.delete("offlineQueue", id);
}

export async function getDeadLetterItems(companyId: string): Promise<DeadLetterItem[]> {
  const db  = await getDB();
  const all = await db.getAllFromIndex("deadLetter", "byCompany", companyId);
  return all.sort((a, b) => b.diedAt - a.diedAt);
}

export async function getDeadLetterCount(companyId?: string): Promise<number> {
  const db = await getDB();
  if (companyId) {
    const items = await db.getAllFromIndex("deadLetter", "byCompany", companyId);
    return items.length;
  }
  return db.count("deadLetter");
}

export async function deleteDeadLetterItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("deadLetter", id);
}

export async function requeueDeadLetterItem(id: string): Promise<void> {
  const db  = await getDB();
  const rec = await db.get("deadLetter", id);
  if (!rec) return;
  const requeued: QueuedItem = {
    ...rec,
    attempts:      0,
    lastAttemptAt: null,
    status:        "pending",
    lastError:     null,
  };
  await db.put("offlineQueue", requeued);
  await db.delete("deadLetter", id);
}

export async function clearDeadLetterQueue(companyId: string): Promise<void> {
  const items = await getDeadLetterItems(companyId);
  const db    = await getDB();
  await Promise.all(items.map((i) => db.delete("deadLetter", i.id)));
}

// ── Checkpoint cache ──────────────────────────────────────────────────────────

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1_000;

export async function cacheCheckpoints(companyId: string, data: Checkpoint[]): Promise<void> {
  const db = await getDB();
  await db.put("cachedCheckpoints", { companyId, data, updatedAt: Date.now() });
}

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

export async function cacheManagerData(
  companyId: string,
  type: string,
  data: unknown[],
): Promise<void> {
  const db  = await getDB();
  const key = `${companyId}:${type}`;
  await db.put("cachedManagerData", { key, companyId, type, data, updatedAt: Date.now() });
}

export async function getCachedManagerData(
  companyId: string,
  type: string,
): Promise<unknown[] | null> {
  const db  = await getDB();
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
      const cid            = (item.payload?.companyId as string) ?? "unknown";
      const idempotencyKey = buildIdempotencyKey("patrol_log", item.payload);
      await enqueueItem({
        id: item.id, type: "patrol_log", companyId: cid,
        payload: item.payload, createdAt: item.createdAt,
        idempotencyKey,
      });
      migrated++;
    }
    localStorage.removeItem(LEGACY_KEY);
    localStorage.setItem(MIGRATED_KEY, "1");
    if (migrated > 0) console.log(`[localDB] migrated ${migrated} items from localStorage → IndexedDB`);
    return migrated;
  } catch (e) {
    console.error("[localDB] migration error:", e);
    localStorage.setItem(MIGRATED_KEY, "1");
    return 0;
  }
}

// ── Local data store helpers (v6 — indexeddb adapter mode) ────────────────────

function localId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export { localId };

// Checkpoints
export async function putLocalCheckpoint(cp: Checkpoint): Promise<void> {
  const db = await getDB();
  await db.put("localCheckpoints", cp);
}

export async function getLocalCheckpoints(companyId: string): Promise<Checkpoint[]> {
  const db  = await getDB();
  const all = await db.getAllFromIndex("localCheckpoints", "byCompany", companyId);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteLocalCheckpoint(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("localCheckpoints", id);
}

// Patrol Logs
export async function putLocalPatrolLog(log: PatrolLog & { id: string }): Promise<void> {
  const db = await getDB();
  await db.put("localPatrolLogs", log);
}

export async function getLocalPatrolLogs(
  companyId: string,
  guardId?: string,
  limitCount = 500,
): Promise<(PatrolLog & { id: string })[]> {
  const db  = await getDB();
  const all = await db.getAllFromIndex("localPatrolLogs", "byCompany", companyId);
  const filtered = guardId ? all.filter((l) => l.guardId === guardId) : all;
  return filtered
    .sort((a, b) => b.scannedAt - a.scannedAt)
    .slice(0, limitCount);
}

// Guard Sessions
export async function putLocalGuardSession(session: GuardSession): Promise<void> {
  const db = await getDB();
  await db.put("localGuardSessions", session);
}

export async function getLocalGuardSessions(companyId: string): Promise<GuardSession[]> {
  const db = await getDB();
  return db.getAllFromIndex("localGuardSessions", "byCompany", companyId);
}

// Alerts
export async function putLocalAlert(alert: Alert & { id: string }): Promise<void> {
  const db = await getDB();
  await db.put("localAlerts", alert);
}

export async function getLocalAlerts(
  companyId: string,
  limitCount = 200,
): Promise<(Alert & { id: string })[]> {
  const db  = await getDB();
  const all = await db.getAllFromIndex("localAlerts", "byCompany", companyId);
  return all
    .sort((a, b) => b.alertedAt - a.alertedAt)
    .slice(0, limitCount);
}

export async function updateLocalAlertField(
  id: string,
  data: Partial<Alert>,
): Promise<void> {
  const db  = await getDB();
  const rec = await db.get("localAlerts", id);
  if (!rec) return;
  await db.put("localAlerts", { ...rec, ...data });
}

// Companies
export async function putLocalCompany(company: CompanyRecord): Promise<void> {
  const db = await getDB();
  await db.put("localCompanies", company);
}

export async function getLocalCompany(id: string): Promise<CompanyRecord | null> {
  const db  = await getDB();
  const rec = await db.get("localCompanies", id);
  return rec ?? null;
}

export async function getAllLocalCompanies(): Promise<CompanyRecord[]> {
  const db = await getDB();
  return db.getAll("localCompanies");
}
