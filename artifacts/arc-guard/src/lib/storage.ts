/**
 * Versioned, validated localStorage wrapper for ARC Guard.
 * - All keys use `arc_guard_v1:` prefix to avoid collisions
 * - Graceful fallback if localStorage is unavailable (private browsing)
 * - Type-safe get/set with schema version migration
 */

const PREFIX = 'arc_guard_v1:';
const MAX_ITEM_BYTES = 512 * 1024; // 512 KB per item limit

function key(k: string): string {
  return PREFIX + k;
}

function available(): boolean {
  try {
    const t = '__arc_guard_test__';
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
    return true;
  } catch {
    return false;
  }
}

const storageOk = available();

// ── Core get/set ──────────────────────────────────────────────────────────────

export function storageGet<T>(k: string, fallback: T): T {
  if (!storageOk) return fallback;
  try {
    const raw = localStorage.getItem(key(k));
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function storageSet<T>(k: string, value: T): boolean {
  if (!storageOk) return false;
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > MAX_ITEM_BYTES) {
      console.warn(`[storage] Item "${k}" exceeds ${MAX_ITEM_BYTES / 1024} KB limit — skipping`);
      return false;
    }
    localStorage.setItem(key(k), serialized);
    return true;
  } catch {
    return false;
  }
}

export function storageRemove(k: string): void {
  if (!storageOk) return;
  try { localStorage.removeItem(key(k)); } catch {}
}

export function storageClear(): void {
  if (!storageOk) return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

// ── Typed store helpers ───────────────────────────────────────────────────────

/** Remember last used screen (manager/guard) for fast re-open */
export function getLastRole(): string | null {
  return storageGet<string | null>('last_role', null);
}
export function setLastRole(role: string): void {
  storageSet('last_role', role);
}

/** Remember seen alert IDs (persisted across page loads) */
const SEEN_ALERTS_KEY = 'seen_alerts';
export function getStoredSeenAlerts(): string[] {
  return storageGet<string[]>(SEEN_ALERTS_KEY, []);
}
export function setStoredSeenAlerts(ids: string[]): void {
  storageSet(SEEN_ALERTS_KEY, ids.slice(-500)); // max 500
}

/** Offline patrol queue */
const QUEUE_KEY = 'offline_queue';
export function getStoredQueue(): unknown[] {
  return storageGet<unknown[]>(QUEUE_KEY, []);
}
export function setStoredQueue(items: unknown[]): void {
  storageSet(QUEUE_KEY, items);
}

/** Install prompt dismissed timestamp */
export function getInstallDismissed(): number {
  return storageGet<number>('install_dismissed', 0);
}
export function setInstallDismissed(): void {
  storageSet('install_dismissed', Date.now());
}

/** User's preferred display settings */
export interface DisplayPrefs {
  compactMode: boolean;
  notifGranted: boolean;
}
const DEFAULT_PREFS: DisplayPrefs = { compactMode: false, notifGranted: false };
export function getDisplayPrefs(): DisplayPrefs {
  return storageGet<DisplayPrefs>('display_prefs', DEFAULT_PREFS);
}
export function setDisplayPrefs(prefs: Partial<DisplayPrefs>): void {
  storageSet('display_prefs', { ...getDisplayPrefs(), ...prefs });
}
