import {
  collection, addDoc, getDocs, onSnapshot, query,
  orderBy, where, doc, setDoc, serverTimestamp, Timestamp,
  limit, updateDoc,
} from 'firebase/firestore';
import { db } from '@/firebase';
import type { Checkpoint, PatrolLog, MissedAlert, GuardSession } from '@/types';
import { getQueue, removeFromQueue } from './offline';

// ── Collections ─────────────────────────────────────────────────────────────
const col = (name: string) => collection(db!, name);

// ── Checkpoints ─────────────────────────────────────────────────────────────
export async function saveCheckpoint(cp: Omit<Checkpoint, 'id' | 'createdAt'>): Promise<string> {
  if (!db) throw new Error('Firebase not configured');
  const ref = await addDoc(col('arc_checkpoints'), { ...cp, createdAt: Date.now() });
  return ref.id;
}

export async function getCheckpoints(): Promise<Checkpoint[]> {
  if (!db) return [];
  const snap = await getDocs(query(col('arc_checkpoints'), where('active', '==', true)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Checkpoint));
}

export function subscribeCheckpoints(cb: (cps: Checkpoint[]) => void): () => void {
  if (!db) return () => {};
  return onSnapshot(
    query(col('arc_checkpoints'), where('active', '==', true), orderBy('createdAt', 'asc')),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Checkpoint)))
  );
}

export async function updateCheckpoint(id: string, data: Partial<Checkpoint>): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  await updateDoc(doc(db, 'arc_checkpoints', id), data);
}

export async function deleteCheckpoint(id: string): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'arc_checkpoints', id));
}

// ── Patrol Logs ─────────────────────────────────────────────────────────────
export async function savePatrolLog(log: PatrolLog): Promise<string> {
  if (!db) throw new Error('Firebase not configured');
  const ref = await addDoc(col('arc_patrol_logs'), { ...log, synced: true });
  return ref.id;
}

export function subscribePatrolLogs(
  cb: (logs: PatrolLog[]) => void,
  limitCount = 50
): () => void {
  if (!db) return () => {};
  return onSnapshot(
    query(col('arc_patrol_logs'), orderBy('scannedAt', 'desc'), limit(limitCount)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PatrolLog)))
  );
}

export async function getPatrolLogs(guardId?: string): Promise<PatrolLog[]> {
  if (!db) return [];
  const q = guardId
    ? query(col('arc_patrol_logs'), where('guardId', '==', guardId), orderBy('scannedAt', 'desc'), limit(100))
    : query(col('arc_patrol_logs'), orderBy('scannedAt', 'desc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PatrolLog));
}

// ── Guard Sessions ───────────────────────────────────────────────────────────
export async function updateGuardSession(session: GuardSession): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, 'arc_guard_sessions', session.guardId), session, { merge: true });
}

export function subscribeGuardSessions(cb: (sessions: GuardSession[]) => void): () => void {
  if (!db) return () => {};
  return onSnapshot(col('arc_guard_sessions'), (snap) =>
    cb(snap.docs.map((d) => d.data() as GuardSession))
  );
}

// ── Missed Alerts ────────────────────────────────────────────────────────────
export async function saveMissedAlert(alert: Omit<MissedAlert, 'id'>): Promise<void> {
  if (!db) return;
  await addDoc(col('arc_missed_alerts'), alert);
}

export function subscribeMissedAlerts(cb: (alerts: MissedAlert[]) => void): () => void {
  if (!db) return () => {};
  return onSnapshot(
    query(col('arc_missed_alerts'), where('resolved', '==', false), orderBy('alertedAt', 'desc'), limit(20)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MissedAlert)))
  );
}

export async function resolveAlert(id: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'arc_missed_alerts', id), { resolved: true });
}

// ── Offline Sync ─────────────────────────────────────────────────────────────
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
      // Will retry next time
    }
  }
  return synced;
}
