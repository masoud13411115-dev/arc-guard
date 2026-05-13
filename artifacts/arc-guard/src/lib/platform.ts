/**
 * Platform detection for Capacitor native vs. web.
 *
 * All functions return safe defaults when running in a web browser — they never
 * throw. Import this module anywhere; it adds near-zero bundle weight on web
 * because Capacitor.getPlatform() is a simple string comparison.
 *
 * Usage:
 *   import { isAndroid, isCapacitor } from '@/lib/platform';
 *   if (isAndroid()) { /* use native API *\/ } else { /* use web API *\/ }
 */

import { Capacitor } from '@capacitor/core';

/** True when running inside a Capacitor native shell (iOS or Android). */
export const isCapacitor = (): boolean => Capacitor.isNativePlatform();

/** True when running on Android (native Capacitor shell). */
export const isAndroid = (): boolean => Capacitor.getPlatform() === 'android';

/** True when running on iOS (native Capacitor shell). */
export const isIosNative = (): boolean => Capacitor.getPlatform() === 'ios';

/** True when running in a browser (web or PWA). */
export const isWeb = (): boolean => Capacitor.getPlatform() === 'web';

// ── Native haptics ─────────────────────────────────────────────────────────────
//
// On Android/iOS native: uses @capacitor/haptics for real motor feedback.
// On web: falls back to navigator.vibrate().
// All calls are fire-and-forget — never throw.

export type HapticType = 'success' | 'warning' | 'error' | 'heavy' | 'light';

const VIBRATE_MAP: Record<HapticType, number | number[]> = {
  success: [50, 30, 50],
  warning: [80, 40, 80, 40, 80],
  error:   [120, 60, 120],
  heavy:   [300, 100, 300, 100, 300, 100, 500],
  light:   30,
};

/**
 * Trigger haptic feedback.
 * Automatically routes to Capacitor Haptics on native, navigator.vibrate on web.
 */
export async function triggerHaptic(type: HapticType): Promise<void> {
  if (isCapacitor()) {
    try {
      const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
      switch (type) {
        case 'success': await Haptics.notification({ type: NotificationType.Success });  break;
        case 'warning': await Haptics.notification({ type: NotificationType.Warning });  break;
        case 'error':   await Haptics.notification({ type: NotificationType.Error });    break;
        case 'heavy':   await Haptics.impact({ style: ImpactStyle.Heavy });              break;
        case 'light':   await Haptics.impact({ style: ImpactStyle.Light });              break;
      }
    } catch {
      // Haptics plugin not available — silently skip
    }
    return;
  }

  // Web fallback
  try {
    const pattern = VIBRATE_MAP[type];
    navigator.vibrate?.(pattern);
  } catch {
    // vibration API not supported
  }
}

// ── Native geolocation ─────────────────────────────────────────────────────────
//
// On Android native: uses @capacitor/geolocation which prompts the proper
// system permission dialog and gives access to background GPS.
// On web: delegates to the browser navigator.geolocation API.
//
// Returns a Promise<GeolocationPosition>-compatible object so call sites
// remain unchanged. Accuracy is intentionally HIGH (enableHighAccuracy: true).

export type NativeGeoPosition = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null | undefined;
    altitudeAccuracy: number | null | undefined;
    heading: number | null | undefined;
    speed: number | null | undefined;
  };
  timestamp: number;
};

/**
 * Request the Android/iOS GPS location permission and return current position.
 * On web, delegates to navigator.geolocation.getCurrentPosition.
 */
export async function getCurrentPositionNative(
  timeoutMs = 20_000,
): Promise<NativeGeoPosition> {
  if (isCapacitor()) {
    const { Geolocation } = await import('@capacitor/geolocation');
    // Request permissions first (no-op if already granted)
    await Geolocation.requestPermissions();
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: timeoutMs,
    });
    return pos;
  }

  // Web: wrap in a Promise
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: timeoutMs,
    });
  });
}

/**
 * Watch position — returns an unsubscribe function.
 * On web uses navigator.geolocation.watchPosition.
 * On native uses @capacitor/geolocation watchPosition.
 */
export async function watchPositionNative(
  onUpdate: (pos: NativeGeoPosition) => void,
  onError: (err: unknown) => void,
): Promise<() => void> {
  if (isCapacitor()) {
    const { Geolocation } = await import('@capacitor/geolocation');
    await Geolocation.requestPermissions().catch(() => {/* ignore */});
    const callbackId = await Geolocation.watchPosition(
      { enableHighAccuracy: true },
      (pos, err) => {
        if (err) { onError(err); return; }
        if (pos)  onUpdate(pos);
      },
    );
    return () => { Geolocation.clearWatch({ id: callbackId }); };
  }

  // Web fallback
  if (!navigator.geolocation) {
    onError(new Error('Geolocation not supported'));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    onUpdate as PositionCallback,
    onError as PositionErrorCallback,
    { enableHighAccuracy: true, maximumAge: 5000 },
  );
  return () => { navigator.geolocation.clearWatch(id); };
}
