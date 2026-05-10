import {
  collection, addDoc, getDocs, onSnapshot, query,
  orderBy, where, doc, setDoc, updateDoc, limit, deleteDoc,
} from 'firebase/firestore';
import { db } from '@/firebase';
import type { Checkpoint, PatrolLog, Alert, GuardSession } from '@/types';
import { getQueue, removeFromQueue } from './offline';

// ── Company-scoped collection helpers ────────────────────────────────────────
const col = (companyId: string, name: string) =>
  collection(db!, 'companies', companyId, name);

// ── Checkpoints ──────────────────────────────────────────────────────────────
export async function saveCheckpoint(
  companyId: string,
  cp: Omit<Checkpoint, 'id' | 'createdAt' | 'companyId'>,
): Promise<string> {
  if (!db) throw new Error('Firebase پیکربندی نشده');
  const ref = await addDoc(col(companyId, 'checkpoints'), {
    ...cp, companyId, createdAt: Date.now(),
  });
  return ref.id;
}

export async function updateCheckpoint(
  companyId: string,
  id: string,
  data: Partial<Checkpoint>,
): Promise<void> {
  if (!db) throw new Error('Firebase پیکربندی نشده');
  await updateDoc(doc(db, 'companies', companyId, 'checkpoints', id), data);
}

export async function deleteCheckpoint(companyId: string, id: string): Promise<void> {
  if (!db) throw new Error('Firebase پیکربندی نشده');
  await deleteDoc(doc(db, 'companies', companyId, 'checkpoints', id));
}

export function subscribeCheckpoints(
  companyId: string,
  cb: (cps: Checkpoint[]) => void,
): () => void {
  if (!db) return () => {};
  return onSnapshot(
    query(col(companyId, 'checkpoints'), where('active', '==', true), orderBy('createdAt', 'asc')),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Checkpoint))),
  );
}

export async function getCheckpoints(companyId: string): Promise<Checkpoint[]> {
  if (!db) return [];
  const snap = await getDocs(
    query(col(companyId, 'checkpoints'), where('active', '==', true)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Checkpoint));
}

// ── Patrol Logs ──────────────────────────────────────────────────────────────
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

// ── Guard Sessions ────────────────────────────────────────────────────────────
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

// ── Alerts (SOS, Missed, Outside) ─────────────────────────────────────────────
export async function saveAlert(alert: Omit<Alert, 'id'>): Promise<string> {
  if (!db) throw new Error('Firebase پیکربندی نشده');
  const ref = await addDoc(col(alert.companyId, 'alerts'), alert);
  return ref.id;
}

/** @deprecated use saveAlert with kind:'missed' */
export async function saveMissedAlert(alert: Omit<Alert, 'id'>): Promise<void> {
  await saveAlert({ ...alert, kind: alert.kind ?? 'missed' });
}

export function subscribeAlerts(
  companyId: string,
  cb: (alerts: Alert[]) => void,
): () => void {
  if (!db) return () => {};
  return onSnapshot(
    query(col(companyId, 'alerts'), where('resolved', '==', false), orderBy('alertedAt', 'desc'), limit(30)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Alert))),
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

// ── Offline Sync ──────────────────────────────────────────────────────────────
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
      // Retry on next sync
    }
  }
  return synced;
}
