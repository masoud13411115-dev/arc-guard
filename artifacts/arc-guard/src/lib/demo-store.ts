/**
 * Real Test Mode — localStorage-backed reactive data store.
 *
 * Provides the same subscribe/CRUD API shape as firestore.ts so that
 * components can swap between Firebase ↔ demo mode with minimal branching.
 *
 * Data is persisted under `arc_guard_v1:demo_*` keys and survives page refresh.
 * Pub/sub listeners fire synchronously on the same tick as mutations.
 */

import type {
  Checkpoint, UserProfile, PatrolLog, GuardSession, Alert,
} from '@/types';
import {
  DEMO_CHECKPOINTS, DEMO_GUARDS, DEMO_LOGS, DEMO_SESSIONS, DEMO_ALERTS,
} from './demo';

// ── Storage helpers ───────────────────────────────────────────────────────────
const P = 'arc_guard_v1:demo_';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(P + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function save<T>(key: string, data: T): void {
  try { localStorage.setItem(P + key, JSON.stringify(data)); } catch {}
}

// ── First-run seed ────────────────────────────────────────────────────────────
if (!localStorage.getItem(P + 'initialized')) {
  save('checkpoints', DEMO_CHECKPOINTS);
  save('guards', DEMO_GUARDS);
  save('logs', DEMO_LOGS);
  save('sessions', DEMO_SESSIONS);
  save('alerts', DEMO_ALERTS);
  localStorage.setItem(P + 'initialized', '1');
}

// ── Pub/Sub ───────────────────────────────────────────────────────────────────
type StoreKey = 'checkpoints' | 'guards' | 'logs' | 'sessions' | 'alerts';
const listeners = new Map<StoreKey, Set<() => void>>();

function emit(key: StoreKey) {
  listeners.get(key)?.forEach((fn) => fn());
}

function sub(key: StoreKey, fn: () => void): () => void {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(fn);
  return () => listeners.get(key)?.delete(fn);
}

/** Subscribe and immediately call cb with current data. Returns unsubscribe fn. */
function makeSubscribe<T>(
  storeKey: StoreKey,
  getData: () => T,
) {
  return function subscribe(cb: (v: T) => void): () => void {
    cb(getData());
    return sub(storeKey, () => cb(getData()));
  };
}

// ── QR code generation ────────────────────────────────────────────────────────
// v2 format: ARCG|{companyId}|{checkpointId}
// Embeds both IDs so guard scanner can validate company ownership.
export function generateQrCode(companyId: string, checkpointId: string): string {
  return `ARCG|${companyId}|${checkpointId}`;
}

// ── Unique ID helper ──────────────────────────────────────────────────────────
function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

export function getCheckpoints(): Checkpoint[] {
  return load<Checkpoint[]>('checkpoints', []);
}

export function addCheckpoint(
  cp: Omit<Checkpoint, 'id' | 'createdAt' | 'companyId' | 'qrCode'>,
): Checkpoint {
  const id = uid('cp');
  const companyId = 'demo-company';
  const item: Checkpoint = {
    ...cp,
    id,
    companyId,
    qrCode: generateQrCode(companyId, id),
    createdAt: Date.now(),
  };
  save('checkpoints', [...getCheckpoints(), item]);
  emit('checkpoints');
  return item;
}

export function updateCheckpoint(id: string, data: Partial<Checkpoint>): void {
  save('checkpoints', getCheckpoints().map((c) => c.id === id ? { ...c, ...data } : c));
  emit('checkpoints');
}

export function deleteCheckpoint(id: string): void {
  save('checkpoints', getCheckpoints().filter((c) => c.id !== id));
  emit('checkpoints');
}

export const subscribeCheckpoints = makeSubscribe('checkpoints', getCheckpoints);

// ═══════════════════════════════════════════════════════════════════════════════
// GUARDS
// ═══════════════════════════════════════════════════════════════════════════════

export function getGuards(): UserProfile[] {
  return load<UserProfile[]>('guards', []);
}

export function addGuard(
  g: Pick<UserProfile, 'displayName' | 'email' | 'guardCode'>,
): UserProfile {
  const item: UserProfile = {
    uid: uid('guard'),
    role: 'guard',
    companyId: 'demo-company',
    companyName: 'شرکت امنیتی آرک (نمونه)',
    active: true,
    createdAt: Date.now(),
    ...g,
  };
  save('guards', [...getGuards(), item]);
  emit('guards');
  return item;
}

export function updateGuard(uid_: string, data: Partial<UserProfile>): void {
  save('guards', getGuards().map((g) => g.uid === uid_ ? { ...g, ...data } : g));
  emit('guards');
}

export function deleteGuard(uid_: string): void {
  save('guards', getGuards().filter((g) => g.uid !== uid_));
  emit('guards');
}

export const subscribeGuards = makeSubscribe('guards', getGuards);

// ═══════════════════════════════════════════════════════════════════════════════
// PATROL LOGS
// ═══════════════════════════════════════════════════════════════════════════════

export function getLogs(): PatrolLog[] {
  return load<PatrolLog[]>('logs', []);
}

export function addLog(log: PatrolLog): void {
  const entry = { ...log, id: log.id ?? uid('log'), synced: false };
  save('logs', [entry, ...getLogs()].slice(0, 300));
  emit('logs');
}

export const subscribeLogs = makeSubscribe('logs', getLogs);

// ═══════════════════════════════════════════════════════════════════════════════
// GUARD SESSIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function getSessions(): GuardSession[] {
  return load<GuardSession[]>('sessions', []);
}

export function upsertSession(session: GuardSession): void {
  const list = getSessions();
  const idx = list.findIndex((s) => s.guardId === session.guardId);
  if (idx >= 0) list[idx] = session;
  else list.unshift(session);
  save('sessions', list);
  emit('sessions');
}

export const subscribeSessions = makeSubscribe('sessions', getSessions);

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTS
// ═══════════════════════════════════════════════════════════════════════════════

export function getAlerts(): Alert[] {
  return load<Alert[]>('alerts', []);
}

export function addAlert(alert: Omit<Alert, 'id'>): void {
  save('alerts', [{ ...alert, id: uid('alert') }, ...getAlerts()]);
  emit('alerts');
}

export function resolveAlert(id: string): void {
  save('alerts', getAlerts().map((a) =>
    a.id === id ? { ...a, resolved: true, resolvedAt: Date.now() } : a,
  ));
  emit('alerts');
}

export const subscribeAlerts = makeSubscribe('alerts', getAlerts);

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVE GUARD (selected guard for demo patrol)
// ═══════════════════════════════════════════════════════════════════════════════

const ACTIVE_GUARD_KEY = P + 'active_guard';

export function getActiveGuard(): UserProfile | null {
  try {
    const raw = localStorage.getItem(ACTIVE_GUARD_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch { return null; }
}

export function setActiveGuard(g: UserProfile): void {
  try { localStorage.setItem(ACTIVE_GUARD_KEY, JSON.stringify(g)); } catch {}
}

export function clearActiveGuard(): void {
  try { localStorage.removeItem(ACTIVE_GUARD_KEY); } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESET
// ═══════════════════════════════════════════════════════════════════════════════

export function resetDemoData(): void {
  save('checkpoints', DEMO_CHECKPOINTS);
  save('guards', DEMO_GUARDS);
  save('logs', DEMO_LOGS);
  save('sessions', DEMO_SESSIONS);
  save('alerts', DEMO_ALERTS);
  localStorage.setItem(P + 'initialized', '1');
  ((['checkpoints', 'guards', 'logs', 'sessions', 'alerts']) as StoreKey[]).forEach(emit);
}
