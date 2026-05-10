/// <reference types="vite-plugin-pwa/client" />
import { registerSW } from 'virtual:pwa-register';

let swRegistration: ServiceWorkerRegistration | null = null;
let updateAvailableCb: (() => void) | null = null;

// ── Register Service Worker ───────────────────────────────────────────────────
export function initPWA(onUpdateAvailable?: () => void) {
  if (!('serviceWorker' in navigator)) return;

  updateAvailableCb = onUpdateAvailable ?? null;

  registerSW({
    immediate: true,
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      swRegistration = r ?? null;
      if (r) setInterval(() => r.update(), 60 * 60 * 1000);
    },
    onNeedRefresh() {
      updateAvailableCb?.();
    },
    onOfflineReady() {
      // App is ready to work offline
    },
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    const { type } = event.data ?? {};
    if (type === 'SYNC_PATROL_LOGS') window.dispatchEvent(new CustomEvent('arc-guard:sync-offline'));
    if (type === 'SYNC_COMPLETE') window.dispatchEvent(new CustomEvent('arc-guard:sync-done'));
  });
}

// ── Apply pending SW update ───────────────────────────────────────────────────
export function applyUpdate() {
  if (swRegistration?.waiting) {
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  }
}

// ── Request background sync tag ───────────────────────────────────────────────
export async function requestBackgroundSync(): Promise<boolean> {
  if (!swRegistration) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (swRegistration as any).sync?.register('arc-patrol-sync');
    return true;
  } catch {
    return false;
  }
}

// ── Notification permission ───────────────────────────────────────────────────
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  return await Notification.requestPermission();
}

export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

/** Show a local notification via the service worker */
export async function showLocalNotification(title: string, body: string, options?: {
  tag?: string;
  requireInteraction?: boolean;
  kind?: 'sos' | 'missed' | 'outside';
}): Promise<void> {
  const perm = await requestNotificationPermission();
  if (perm !== 'granted') return;

  const notifOptions: NotificationOptions = {
    body,
    icon: '/arc-guard/icon-192.png',
    badge: '/arc-guard/icon-96.png',
    tag: options?.tag ?? 'arc-guard',
    requireInteraction: options?.kind === 'sos' || (options?.requireInteraction ?? false),
    dir: 'rtl',
  };

  if (swRegistration) {
    await swRegistration.showNotification(title, notifOptions);
  } else if ('Notification' in window) {
    new Notification(title, notifOptions);
  }
}

// ── Install prompt (BeforeInstallPromptEvent) ────────────────────────────────
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function captureInstallPrompt(cb: (e: BeforeInstallPromptEvent) => void) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    cb(deferredPrompt);
  });
}

export async function triggerInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome;
}

export function isPWAInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
