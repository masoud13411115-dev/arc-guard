import type { OfflineQueueItem, PatrolLog } from '@/types';

const QUEUE_KEY = 'arc_guard_offline_queue';

// ── Queue management ──────────────────────────────────────────────────────────
export function getQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToQueue(log: PatrolLog): string {
  const queue = getQueue();
  const id = `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  queue.push({ id, type: 'patrol_log', payload: { ...log, offlineQueued: true }, createdAt: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  // Request background sync tag
  requestBgSync();
  return id;
}

export function removeFromQueue(id: string): void {
  const queue = getQueue().filter((item) => item.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function getQueueCount(): number {
  return getQueue().length;
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

// ── Background Sync ───────────────────────────────────────────────────────────
async function requestBgSync(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    // @ts-ignore — SyncManager not in all TS libs
    await reg.sync?.register('arc-patrol-sync');
  } catch {
    // Background sync not supported — sync will happen when app is opened
  }
}

// ── Sync listener (triggered by SW message) ───────────────────────────────────
export function listenForSyncTrigger(syncFn: () => Promise<void>): () => void {
  const handler = (e: Event) => {
    if ((e as CustomEvent).type === 'arc-guard:sync-offline') syncFn();
  };
  window.addEventListener('arc-guard:sync-offline', handler);
  // Also sync on online event
  const onOnline = () => { if (getQueueCount() > 0) syncFn(); };
  window.addEventListener('online', onOnline);
  return () => {
    window.removeEventListener('arc-guard:sync-offline', handler);
    window.removeEventListener('online', onOnline);
  };
}

// ── Network status ────────────────────────────────────────────────────────────
export function isOnline(): boolean {
  return navigator.onLine;
}

export function subscribeToNetworkStatus(cb: (online: boolean) => void): () => void {
  const onOnline = () => cb(true);
  const onOffline = () => cb(false);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
