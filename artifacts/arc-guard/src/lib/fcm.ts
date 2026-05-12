/**
 * ARC Guard — Firebase Cloud Messaging (FCM) client utilities
 *
 * Handles:
 *  - Registering the firebase-messaging-sw.js service worker
 *  - Requesting an FCM push token (requires VAPID key from Firebase Console)
 *  - Persisting/revoking the token
 *  - Foreground message handler (in-app FCM messages while tab is focused)
 *
 * Architecture note:
 *  Receiving pushes when the app is CLOSED requires a backend (Cloud Function)
 *  to call the FCM HTTP v1 API with the manager's token.
 *  This module sets up the entire client side; add a Firestore-triggered
 *  Cloud Function to complete the loop for fully-closed-app delivery.
 */

import { getToken, deleteToken, onMessage } from 'firebase/messaging';
import type { Messaging, MessagePayload } from 'firebase/messaging';

// ── Constants ─────────────────────────────────────────────────────────────────

const SW_PATH   = '/arc-guard/firebase-messaging-sw.js';
const TOKEN_KEY = 'arc_guard_fcm_token';

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

/** Check whether any service worker is active for the /arc-guard/ scope. */
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
  permission: 'granted' | 'denied' | 'default' | 'unsupported';
  swActive:   boolean;
  tokenSaved: boolean;
  vapidSet:   boolean;
  tokenHint:  string | null;  // first 24 chars for safe display
}

export function buildFcmDiagState(
  tokenSaved: boolean,
  vapidKey:   string,
  swActive:   boolean,
): FcmDiagState {
  const raw = getCachedFcmToken();
  const perm: FcmDiagState['permission'] =
    !('Notification' in window) ? 'unsupported'
    : Notification.permission === 'granted' ? 'granted'
    : Notification.permission === 'denied'  ? 'denied'
    : 'default';
  return {
    permission: perm,
    swActive,
    tokenSaved,
    vapidSet:  !!vapidKey,
    tokenHint: raw ? raw.slice(0, 24) + '…' : null,
  };
}
