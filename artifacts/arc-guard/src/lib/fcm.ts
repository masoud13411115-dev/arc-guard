/**
 * ARC Guard — Firebase Cloud Messaging (FCM) client utilities
 *
 * Background push delivery requires:
 *  - Chrome / Edge / Samsung Browser (Android, Desktop): works without PWA install
 *  - iOS Safari 16.4+: ONLY works when app is installed to home screen (standalone PWA)
 *  - Firefox: FCM Web Push not supported (isSupported() returns false)
 *
 * Architecture note:
 *  Closed-app push delivery requires a backend (Cloud Function / server) to
 *  call the FCM HTTP v1 API with the manager's saved token.  This module
 *  sets up the full client side; the server side completes the loop.
 */

import { getToken, deleteToken, onMessage } from 'firebase/messaging';
import type { Messaging, MessagePayload } from 'firebase/messaging';
import { Capacitor } from '@capacitor/core';

// ── Constants ─────────────────────────────────────────────────────────────────

const SW_PATH   = '/arc-guard/firebase-messaging-sw.js';
const TOKEN_KEY = 'arc_guard_fcm_token';

// ── PWA / platform detection ──────────────────────────────────────────────────

/** Returns true when the app is running as an installed PWA (standalone display). */
export function isPwaInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari sets navigator.standalone when added to home screen
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

/** Returns true when the current device is running iOS / iPadOS. */
export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iP(hone|ad|od)/.test(navigator.userAgent);
}

/**
 * Returns true when background push (closed-tab/closed-app delivery) is
 * likely to work on this device, based on platform heuristics:
 *
 *  - iOS: requires FCM support + standalone PWA installation
 *  - Other: requires FCM support + ServiceWorker + PushManager + Notification
 */
export function isBgPushLikelySuppressed(): boolean {
  if (typeof window === 'undefined') return true;
  const ios = isIosDevice();
  if (ios && !isPwaInstalled()) return true;   // iOS + not installed → suppressed
  return false;
}

/** Whether this browser API set (SW + PushManager) can support background push. */
export function hasBgPushApis(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager'   in window &&
    'Notification'  in window
  );
}

/**
 * Returns true when background push should be SKIPPED entirely — either because
 * the platform doesn't support it or the runtime context makes it unreliable:
 *
 *  - iOS Safari not in standalone mode (iOS requires PWA install for any push)
 *  - Iframe context (Replit preview, embedded webview) — SW/push unreliable
 *  - Missing browser APIs (no ServiceWorker / PushManager)
 *
 * When this returns true, initFcmMessaging() exits immediately without touching
 * the Firebase Messaging SDK — so no crashes, no error logs, no token requests.
 * In-app realtime alerts (Firestore subscriptions) continue to work normally.
 */
export function isBgPushContextUnsupported(): boolean {
  if (typeof window === 'undefined') return true;

  // Capacitor native (Android / iOS) — web Firebase Messaging SDK and service
  // workers don't work inside a Capacitor WebView. Native push is handled by
  // @capacitor/push-notifications (see nativePush.ts).
  if (Capacitor.isNativePlatform()) return true;

  // iOS requires PWA installation for ANY background push
  if (isIosDevice() && !isPwaInstalled()) return true;

  // Iframe context — service workers registered inside an iframe are unreliable;
  // Replit's dev preview and many webviews run the app in a sandboxed iframe.
  try {
    if (window.self !== window.top) return true;
  } catch {
    // Cross-origin iframe — access to window.top throws; definitely an iframe
    return true;
  }

  // Missing browser APIs
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return true;

  return false;
}

// ── Service Worker registration ───────────────────────────────────────────────

/**
 * Register the Firebase Messaging service worker.
 * Returns the ServiceWorkerRegistration or null if unsupported / failed.
 */
export async function registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, {
      scope: '/arc-guard/',
    });
    console.log('[FCM] Service worker registered, scope:', reg.scope);
    return reg;
  } catch (err) {
    console.warn('[FCM] SW registration failed:', err);
    return null;
  }
}

/** Check whether the FCM service worker is active for /arc-guard/ scope. */
export async function isFcmSwActive(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.some((r) => r.scope.includes('/arc-guard/'));
  } catch { return false; }
}

// ── FCM Token ─────────────────────────────────────────────────────────────────

/**
 * Request an FCM registration token.
 * Requires:
 *  - A VAPID key from Firebase Console → Project Settings → Cloud Messaging
 *  - The firebase-messaging-sw.js service worker already registered
 *
 * Returns the token string or null on failure / missing VAPID key.
 */
export async function requestFcmToken(
  messaging: Messaging,
  vapidKey:  string,
  swReg:     ServiceWorkerRegistration,
): Promise<string | null> {
  if (!vapidKey) {
    console.warn('[FCM] VAPID key not configured — token request skipped');
    return null;
  }
  try {
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    });
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      console.log('[FCM] Token acquired:', token.slice(0, 24) + '…');
    }
    return token || null;
  } catch (err) {
    console.warn('[FCM] getToken failed:', err);
    return null;
  }
}

/** Delete the FCM token from FCM and local cache (call on logout). */
export async function revokeFcmToken(messaging: Messaging): Promise<void> {
  try {
    await deleteToken(messaging);
    localStorage.removeItem(TOKEN_KEY);
    console.log('[FCM] Token revoked');
  } catch { /* already gone — ok */ }
}

/** Return the last token stored locally (may be stale). */
export function getCachedFcmToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// ── Foreground message handler ────────────────────────────────────────────────

/**
 * Listen for FCM messages while the tab is focused (foreground).
 * Background / closed-app messages are handled by firebase-messaging-sw.js.
 * Returns an unsubscribe function.
 */
export function onForegroundMessage(
  messaging: Messaging,
  handler:   (payload: MessagePayload) => void,
): () => void {
  return onMessage(messaging, handler);
}

// ── Diagnostic state ──────────────────────────────────────────────────────────

export interface FcmDiagState {
  /** Whether FCM Web Push is supported in this browser (from isSupported()). */
  fcmSupported:  boolean;
  /** Whether app is running as installed PWA (standalone display mode). */
  pwaInstalled:  boolean;
  /** Whether background push is likely to work end-to-end on this device. */
  bgPushActive:  boolean;
  /** Whether this is an iOS device. */
  iosDevice:     boolean;
  permission:    'granted' | 'denied' | 'default' | 'unsupported';
  swActive:      boolean;
  tokenSaved:    boolean;
  vapidSet:      boolean;
  tokenHint:     string | null;  // first 24 chars for safe display
}

export function buildFcmDiagState(
  tokenSaved:   boolean,
  vapidKey:     string,
  swActive:     boolean,
  fcmSupported: boolean,
): FcmDiagState {
  const raw  = getCachedFcmToken();
  const perm: FcmDiagState['permission'] =
    !('Notification' in window) ? 'unsupported'
    : Notification.permission === 'granted' ? 'granted'
    : Notification.permission === 'denied'  ? 'denied'
    : 'default';

  const pwaInstalled = isPwaInstalled();
  const iosDevice    = isIosDevice();

  // Background push is active when:
  //  - FCM is supported in this browser
  //  - The SW is registered
  //  - Notification permission is granted
  //  - On iOS: app must be installed as PWA
  const bgPushActive =
    fcmSupported &&
    swActive &&
    perm === 'granted' &&
    !isBgPushLikelySuppressed();

  return {
    fcmSupported,
    pwaInstalled,
    bgPushActive,
    iosDevice,
    permission: perm,
    swActive,
    tokenSaved,
    vapidSet:  !!vapidKey,
    tokenHint: raw ? raw.slice(0, 24) + '…' : null,
  };
}
