/**
 * Step 1: Central notification manager
 * - Browser push permission
 * - Show browser notification for incoming alerts
 * - Mobile vibration patterns
 * - Works in demo mode (no Firebase needed)
 */

import type { Alert, AlertKind } from '@/types';

// ── Permission ────────────────────────────────────────────────────────────────

export type NotifPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function getPermissionStatus(): NotifPermission {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission as NotifPermission;
}

export async function requestPermission(): Promise<NotifPermission> {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    const result = await Notification.requestPermission();
    return result as NotifPermission;
  } catch {
    return 'denied';
  }
}

// ── Vibration patterns ────────────────────────────────────────────────────────

const VIBRATE_PATTERNS: Record<AlertKind, number[]> = {
  sos:     [300, 100, 300, 100, 300, 100, 500],  // urgent repeated
  missed:  [150, 80, 150, 80, 150],              // medium triple
  outside: [80, 40, 80, 40, 80],                 // short triple
};

export function vibrateForAlert(kind: AlertKind): void {
  // On Android/iOS native: use Capacitor Haptics for richer motor feedback.
  // On web: fall back to navigator.vibrate.
  const hapticType = kind === 'sos' ? 'heavy' : kind === 'outside' ? 'warning' : 'error';
  import('@/lib/platform')
    .then(({ triggerHaptic }) => triggerHaptic(hapticType))
    .catch(() => {
      // platform module unavailable — fall back to web vibrate
      try {
        navigator.vibrate?.(VIBRATE_PATTERNS[kind]);
      } catch {
        // vibration not supported
      }
    });
}

// ── Browser notification ──────────────────────────────────────────────────────

const KIND_TITLES: Record<AlertKind, string> = {
  sos:     '🚨 اضطراری SOS',
  missed:  '⏰ ایستگاه از دست رفت',
  outside: '⚠️ خارج از محدوده',
};

/**
 * Show a browser notification for an incoming alert.
 * Falls back gracefully if permission not granted.
 * Works in demo mode — no Firebase required.
 */
export async function showAlertNotification(alert: Alert): Promise<void> {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const title = KIND_TITLES[alert.kind];
  let body = alert.guardName;

  if (alert.checkpointName) body += ` · ایستگاه: ${alert.checkpointName}`;
  if (alert.message) body += `\n${alert.message}`;

  const options: NotificationOptions = {
    body,
    icon: '/arc-guard/icon-192.png',
    badge: '/arc-guard/icon-96.png',
    tag: `arc-guard-alert-${alert.id ?? alert.kind}`,
    requireInteraction: alert.kind === 'sos',
    dir: 'rtl',
    silent: false,
  };

  try {
    // Prefer service worker notification (shows even when app is minimized)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration('/arc-guard/');
      if (reg) {
        await reg.showNotification(title, options);
        return;
      }
    }
    // Fallback: direct Notification API
    new Notification(title, options);
  } catch {
    // Silently fail — app UI already shows the alert
  }
}

// ── Seen tracking (localStorage) ─────────────────────────────────────────────

const SEEN_KEY = 'arc_guard_seen_alerts';

export function getSeenAlertIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function markAlertsAsSeen(ids: string[]): void {
  if (ids.length === 0) return;
  const seen = getSeenAlertIds();
  ids.forEach((id) => seen.add(id));
  // Keep max 500 entries to avoid unbounded growth
  const arr = [...seen];
  const trimmed = arr.slice(-500);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full — ignore
  }
}

export function isAlertSeen(id: string): boolean {
  return getSeenAlertIds().has(id);
}
