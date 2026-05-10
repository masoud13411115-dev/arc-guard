import type { OfflineQueueItem, PatrolLog } from '@/types';

const QUEUE_KEY = 'arc_guard_offline_queue';

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
