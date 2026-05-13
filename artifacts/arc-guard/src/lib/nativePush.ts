/**
 * Android native push notifications via @capacitor/push-notifications.
 *
 * This module handles FCM on Android Capacitor apps — the web Firebase
 * Messaging SDK (service workers) does NOT work in Capacitor WebViews.
 * On web, this module is a no-op and initNativePush() returns null.
 *
 * Flow:
 *  1. initNativePush(companyId, uid) — call from Dashboard after login
 *  2. Plugin registers with FCM → gets token
 *  3. Token saved to Firestore companies/{companyId}/fcmTokens/{uid}
 *  4. Foreground alerts shown via @capacitor/local-notifications
 *  5. Background alerts handled natively by Capacitor FCM bridge
 *
 * In-app realtime alerts (Firestore subscribeAlerts) run independently
 * and continue to work on all platforms.
 */

import { isAndroid } from '@/lib/platform';
import { saveFcmToken, deleteFcmToken } from '@/lib/firestore';

let _initialized = false;
let _listenerCleanup: (() => void) | null = null;

export type NativePushState = {
  token: string | null;
  permission: 'granted' | 'denied' | 'prompt';
  error: string | null;
};

/**
 * Initialize native push for Android.
 * Returns null on web (caller should use initFcmMessaging() instead).
 * Returns NativePushState on Android.
 */
export async function initNativePush(
  companyId: string,
  uid: string,
): Promise<NativePushState | null> {
  if (!isAndroid()) return null;
  if (_initialized) return null;
  _initialized = true;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    // ── Request permission ───────────────────────────────────────────────────
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      return { token: null, permission: 'denied', error: null };
    }

    // ── Register for push (triggers FCM token generation) ───────────────────
    await PushNotifications.register();

    // ── Token received ───────────────────────────────────────────────────────
    let resolveToken: (token: string) => void;
    const tokenPromise = new Promise<string>((res) => { resolveToken = res; });

    const regListener = await PushNotifications.addListener('registration', async (token) => {
      resolveToken(token.value);
      // Save token to Firestore so server can target this device
      try {
        await saveFcmToken(companyId, uid, token.value);
      } catch {
        // Non-fatal — in-app alerts still work
      }
    });

    const regErrListener = await PushNotifications.addListener('registrationError', (err) => {
      console.warn('[nativePush] registration error', err);
    });

    // ── Foreground push handler ──────────────────────────────────────────────
    // On Android, FCM messages received while the app is OPEN are passed here.
    // We re-display them via LocalNotifications so the user sees the popup.
    const fgListener = await PushNotifications.addListener(
      'pushNotificationReceived',
      async (notification) => {
        const data = notification.data ?? {};
        const kind = data['kind'] ?? '';

        const title = notification.title ?? (
          kind === 'sos'     ? '🚨 اضطراری SOS'          :
          kind === 'outside' ? '⚠️ خارج از محدوده'        :
          kind === 'missed'  ? '⏰ ایستگاه از دست رفت'    :
                               '🔔 هشدار جدید'
        );
        const body = notification.body ?? (data['guardName'] ?? 'هشدار جدید دریافت شد');

        try {
          await LocalNotifications.schedule({
            notifications: [{
              id:        Math.floor(Math.random() * 10_000),
              title,
              body,
              sound:     kind === 'sos' ? 'default' : undefined,
              channelId: 'arc-guard-alerts',
            }],
          });
        } catch {
          // LocalNotifications might not be available — in-app alert still fires
        }
      },
    );

    // ── Notification tap handler ─────────────────────────────────────────────
    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (_action) => {
        // Navigate to alerts tab — post a custom event the app can listen to
        window.dispatchEvent(new CustomEvent('arc-guard:navigate', {
          detail: { tab: 'alerts' },
        }));
      },
    );

    // Cleanup function for component unmount / logout
    _listenerCleanup = () => {
      regListener.remove();
      regErrListener.remove();
      fgListener.remove();
      _initialized = false;
    };

    // Create alert notification channel (Android 8+)
    try {
      await PushNotifications.createChannel({
        id:          'arc-guard-alerts',
        name:        'ARC Guard Alerts',
        description: 'Security patrol alerts — SOS, missed checkpoints, radius violations',
        importance:  5,   // IMPORTANCE_HIGH
        sound:       'default',
        vibration:   true,
        lights:      true,
        lightColor:  '#EF4444',
      });
    } catch {
      // Channel API might not be available on older Android
    }

    const token = await Promise.race([
      tokenPromise,
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('FCM token timeout')), 10_000),
      ),
    ]).catch(() => null);

    return { token, permission: 'granted', error: null };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { token: null, permission: 'prompt', error: msg };
  }
}

/**
 * Remove FCM token and clean up listeners on logout.
 */
export async function teardownNativePush(
  companyId: string,
  uid: string,
): Promise<void> {
  if (!isAndroid()) return;
  _listenerCleanup?.();
  _listenerCleanup = null;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.removeAllDeliveredNotifications();
    await deleteFcmToken(companyId, uid);
  } catch {
    // Non-fatal
  }
}
