import {
  collection, addDoc, getDocs, onSnapshot, query,
  orderBy, where, doc, setDoc, updateDoc, limit, deleteDoc, getDoc,
} from 'firebase/firestore';
import { db } from '@/firebase';
import type { Checkpoint, PatrolLog, Alert, GuardSession, CompanyRecord, UserProfile, PlanId } from '@/types';
import { getQueue, removeFromQueue } from './offline';

// ── Company-scoped collection helpers ─────────────────────────────────────────
const col = (companyId: string, name: string) =>
  collection(db!, 'companies', companyId, name);

// ── Checkpoints ───────────────────────────────────────────────────────────────

/** Firestore path helper — single source of truth so save & load always match */
export function checkpointPath(companyId: string): string {
  return `companies/${companyId}/checkpoints`;
}

/**
 * Creates a new checkpoint, pre-generating its Firestore doc ID so the QR code
 * can embed it: `ARCG|{companyId}|{checkpointId}`.
 * The qrCode field in `cp` is IGNORED — it is always generated here.
 */
export async function saveCheckpoint(
  companyId: string,
  cp: Omit<Checkpoint, 'id' | 'createdAt' | 'companyId' | 'qrCode'>,
): Promise<string> {
  if (!db) throw new Error('Firebase پیکربندی نشده');
  // Pre-generate document reference so we know the ID before writing
  const newRef = doc(col(companyId, 'checkpoints'));
  const checkpointId = newRef.id;
  const qrCode = `ARCG|${companyId}|${checkpointId}`;
  const path = checkpointPath(companyId);
  console.log(`[firestore] saveCheckpoint → ${path}/${checkpointId}`, { name: cp.name, companyId, qrCode });
  try {
    await setDoc(newRef, { ...cp, qrCode, companyId, createdAt: Date.now() });
    console.log(`[firestore] saveCheckpoint ✓ id=${checkpointId} path=${path}/${checkpointId}`);
    return checkpointId;
  } catch (err) {
    console.error(`[firestore] saveCheckpoint ✗ path=${path}`, err);
    throw err;
  }
}

export async function updateCheckpoint(
  companyId: string,
  id: string,
  data: Partial<Checkpoint>,
): Promise<void> {
  if (!db) throw new Error('Firebase پیکربندی نشده');
  const path = `${checkpointPath(companyId)}/${id}`;
  console.log(`[firestore] updateCheckpoint → ${path}`);
  try {
    await updateDoc(doc(db, 'companies', companyId, 'checkpoints', id), data);
    console.log(`[firestore] updateCheckpoint ✓ ${path}`);
  } catch (err) {
    console.error(`[firestore] updateCheckpoint ✗ ${path}`, err);
    throw err;
  }
}

export async function deleteCheckpoint(companyId: string, id: string): Promise<void> {
  if (!db) throw new Error('Firebase پیکربندی نشده');
  const path = `${checkpointPath(companyId)}/${id}`;
  console.log(`[firestore] deleteCheckpoint → ${path}`);
  try {
    await deleteDoc(doc(db, 'companies', companyId, 'checkpoints', id));
    console.log(`[firestore] deleteCheckpoint ✓ ${path}`);
  } catch (err) {
    console.error(`[firestore] deleteCheckpoint ✗ ${path}`, err);
    throw err;
  }
}

/**
 * Real-time subscription to checkpoints.
 *
 * NOTE: Uses only `orderBy('createdAt')` — no composite index needed.
 * `active` filtering is done client-side to avoid Firestore composite-index
 * errors on fresh projects that haven't run the Console index builder yet.
 */
export function subscribeCheckpoints(
  companyId: string,
  cb: (cps: Checkpoint[]) => void,
  onError?: (err: Error) => void,
): () => void {
  if (!db) return () => {};
  const path = checkpointPath(companyId);
  console.log(`[firestore] subscribeCheckpoints → ${path}`);
  return onSnapshot(
    query(col(companyId, 'checkpoints'), orderBy('createdAt', 'asc')),
    (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Checkpoint));
      // Filter active client-side — avoids needing a composite index
      const active = all.filter((c) => c.active !== false);
      console.log(`[firestore] subscribeCheckpoints snapshot: ${all.length} total, ${active.length} active — ${path}`);
      cb(active);
    },
    (err) => {
      console.error(`[firestore] subscribeCheckpoints ERROR at ${path}:`, err.code, err.message);
      onError?.(err);
    },
  );
}

export async function getCheckpoints(companyId: string): Promise<Checkpoint[]> {
  if (!db) return [];
  const snap = await getDocs(query(col(companyId, 'checkpoints'), orderBy('createdAt', 'asc')));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Checkpoint))
    .filter((c) => c.active !== false);
}

// ── Patrol Logs ───────────────────────────────────────────────────────────────
export async function savePatrolLog(log: PatrolLog): Promise<string> {
  if (!db) throw new Error('Firebase پیکربندی نشده');
  const ref = await addDoc(col(log.companyId, 'patrolLogs'), { ...log, synced: true });
  return ref.id;
}

export function subscribePatrolLogs(
  companyId: string,
  cb: (logs: PatrolLog[]) => void,
  limitCount = 50,
): () => void {
  if (!db) return () => {};
  return onSnapshot(
    query(col(companyId, 'patrolLogs'), orderBy('scanTime', 'desc'), limit(limitCount)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PatrolLog))),
  );
}

export async function getPatrolLogs(companyId: string, guardId?: string): Promise<PatrolLog[]> {
  if (!db) return [];
  const q = guardId
    ? query(col(companyId, 'patrolLogs'), where('guardId', '==', guardId), orderBy('scanTime', 'desc'), limit(100))
    : query(col(companyId, 'patrolLogs'), orderBy('scanTime', 'desc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PatrolLog));
}

// ── Guard Sessions ─────────────────────────────────────────────────────────────
export async function updateGuardSession(session: GuardSession): Promise<void> {
  if (!db) return;
  await setDoc(
    doc(db, 'companies', session.companyId, 'guardSessions', session.guardId),
    session,
    { merge: true },
  );
}

export function subscribeGuardSessions(
  companyId: string,
  cb: (sessions: GuardSession[]) => void,
): () => void {
  if (!db) return () => {};
  return onSnapshot(
    col(companyId, 'guardSessions'),
    (snap) => cb(snap.docs.map((d) => d.data() as GuardSession)),
  );
}

// ── Alerts ─────────────────────────────────────────────────────────────────────
export async function saveAlert(alert: Omit<Alert, 'id'>): Promise<string> {
  if (!db) throw new Error('Firebase پیکربندی نشده');
  const ref = await addDoc(col(alert.companyId, 'alerts'), alert);
  return ref.id;
}

/** @deprecated use saveAlert with kind */
export async function saveMissedAlert(alert: Omit<Alert, 'id'>): Promise<void> {
  await saveAlert({ ...alert, kind: alert.kind ?? 'missed' });
}

export function subscribeAlerts(
  companyId: string,
  cb: (alerts: Alert[]) => void,
  onError?: (err: Error) => void,
): () => void {
  if (!db) return () => {};
  const path = `companies/${companyId}/alerts`;
  console.log(`[firestore] subscribeAlerts → ${path}`);
  return onSnapshot(
    // Only orderBy — NO where clause → no composite index needed.
    // Filtering resolved/unread is done client-side to avoid silent index errors.
    query(col(companyId, 'alerts'), orderBy('alertedAt', 'desc'), limit(50)),
    (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Alert));
      console.log(`[firestore] subscribeAlerts snapshot: ${all.length} docs — ${path}`);
      cb(all);
    },
    (err) => {
      console.error(`[firestore] subscribeAlerts ERROR at ${path}:`, err.code, err.message);
      onError?.(err);
    },
  );
}

/** @deprecated use subscribeAlerts */
export const subscribeMissedAlerts = subscribeAlerts;

export async function getAlertHistory(companyId: string, limitCount = 100): Promise<Alert[]> {
  if (!db) return [];
  const snap = await getDocs(
    query(col(companyId, 'alerts'), orderBy('alertedAt', 'desc'), limit(limitCount)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Alert));
}

export async function resolveAlert(companyId: string, id: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'companies', companyId, 'alerts', id), {
    resolved: true,
    resolvedAt: Date.now(),
  });
}

// ── Company management (admin) ─────────────────────────────────────────────────
export async function getCompany(companyId: string): Promise<CompanyRecord | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, 'companies', companyId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as CompanyRecord;
}

export async function updateCompany(companyId: string, data: Partial<CompanyRecord>): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'companies', companyId), data);
}

export async function regenerateInviteCode(companyId: string): Promise<string> {
  const { generateInviteCode } = await import('./plans');
  const code = generateInviteCode();
  await updateCompany(companyId, { inviteCode: code });
  return code;
}

// ── Super admin: all companies ─────────────────────────────────────────────────
export async function getAllCompanies(): Promise<CompanyRecord[]> {
  if (!db) return [];
  const snap = await getDocs(query(collection(db, 'companies'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompanyRecord));
}

export function subscribeAllCompanies(cb: (companies: CompanyRecord[]) => void): () => void {
  if (!db) return () => {};
  return onSnapshot(
    query(collection(db, 'companies'), orderBy('createdAt', 'desc')),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompanyRecord))),
  );
}

export async function setCompanyPlan(companyId: string, plan: PlanId): Promise<void> {
  await updateCompany(companyId, { plan });
}

export async function setCompanySuspended(companyId: string, suspended: boolean): Promise<void> {
  await updateCompany(companyId, { suspended, active: !suspended });
}

// ── Company guards ─────────────────────────────────────────────────────────────
export async function getCompanyGuards(companyId: string): Promise<UserProfile[]> {
  if (!db) return [];
  const snap = await getDocs(
    query(collection(db, 'users'), where('companyId', '==', companyId), where('role', '==', 'guard')),
  );
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
}

export async function setGuardActive(uid: string, active: boolean): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'users', uid), { active });
}

// ── Offline Sync ───────────────────────────────────────────────────────────────
export async function syncOfflineQueue(): Promise<number> {
  if (!db || !navigator.onLine) return 0;
  const queue = getQueue();
  let synced = 0;
  for (const item of queue) {
    try {
      if (item.type === 'patrol_log') {
        await savePatrolLog({ ...item.payload, synced: true, offlineQueued: false });
        removeFromQueue(item.id);
        synced++;
      }
    } catch {
      // retry on next sync
    }
  }
  return synced;
}

// ── FCM Token management ──────────────────────────────────────────────────────
// Stores manager FCM tokens at companies/{companyId}/fcmTokens/{uid}
// so a Cloud Function can fan-out push notifications on new alerts.

export interface FcmTokenRecord {
  uid:       string;
  token:     string;
  savedAt:   number;
  platform:  'web';
}

/** Upsert the FCM token for a manager. */
export async function saveFcmToken(
  companyId: string,
  uid:       string,
  token:     string,
): Promise<void> {
  if (!db) return;
  const record: FcmTokenRecord = { uid, token, savedAt: Date.now(), platform: 'web' };
  await setDoc(
    doc(db, 'companies', companyId, 'fcmTokens', uid),
    record,
    { merge: true },
  );
}

/** Remove the FCM token for a manager (call on logout). */
export async function deleteFcmToken(
  companyId: string,
  uid:       string,
): Promise<void> {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'companies', companyId, 'fcmTokens', uid));
  } catch { /* already removed — ok */ }
}
