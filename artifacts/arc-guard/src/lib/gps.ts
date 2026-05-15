import type { GpsCoords } from '@/types';

export function getCurrentPosition(): Promise<GpsCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatCoords(gps: GpsCoords): string {
  return `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`;
}

// ── Anti-fraud GPS anomaly detection ──────────────────────────────────────────

/**
 * GPS fraud flag codes:
 *   low_accuracy     — GPS accuracy worse than 150 m (likely indoor/mocked)
 *   impossible_speed — guard moved faster than 30 m/s (~108 km/h) since last scan
 *   static_position  — guard GPS hasn't moved at all between two different checkpoints
 */
export type GpsFraudFlag = 'low_accuracy' | 'impossible_speed' | 'static_position';

const LAST_GPS_KEY = "arc_guard_last_scan_gps";
const MAX_ACCURACY_M = 150;   // worse than 150 m = suspect
const MAX_SPEED_MS   = 30;    // 30 m/s = 108 km/h — physically impossible on foot patrol

interface LastScanGps {
  lat: number;
  lng: number;
  accuracy: number;
  ts: number;           // timestamp ms
  checkpointId: string;
}

function loadLastScanGps(): LastScanGps | null {
  try { return JSON.parse(localStorage.getItem(LAST_GPS_KEY) ?? "null"); } catch { return null; }
}

function saveLastScanGps(data: LastScanGps) {
  try { localStorage.setItem(LAST_GPS_KEY, JSON.stringify(data)); } catch {}
}

/**
 * Detect GPS anomalies for anti-fraud.
 * Call before saving a patrol log.
 * @param coords  — current scan GPS coords
 * @param checkpointId — checkpoint being scanned (to detect static-position across checkpoints)
 * @returns array of fraud flag strings (empty = clean)
 */
export function detectGpsFraud(
  coords: GpsCoords,
  checkpointId: string,
): GpsFraudFlag[] {
  const flags: GpsFraudFlag[] = [];

  // 1. Low accuracy check
  if (coords.accuracy > MAX_ACCURACY_M) {
    flags.push('low_accuracy');
  }

  const last = loadLastScanGps();
  if (last) {
    const distM = haversineDistance(last.lat, last.lng, coords.lat, coords.lng);
    const dtSec = (Date.now() - last.ts) / 1000;

    // 2. Impossible speed: only flag if a meaningful time has passed (> 2 s to avoid GPS jitter)
    if (dtSec > 2 && dtSec < 3600) {
      const speedMs = distM / dtSec;
      if (speedMs > MAX_SPEED_MS) {
        flags.push('impossible_speed');
      }
    }

    // 3. Static position: guard reports same GPS for a DIFFERENT checkpoint
    if (checkpointId !== last.checkpointId && distM < 2) {
      flags.push('static_position');
    }
  }

  return flags;
}

/**
 * Record a successful scan's GPS for future fraud detection comparisons.
 * Call after a successful scan is saved.
 */
export function recordScanGps(coords: GpsCoords, checkpointId: string) {
  saveLastScanGps({
    lat: coords.lat,
    lng: coords.lng,
    accuracy: coords.accuracy,
    ts: Date.now(),
    checkpointId,
  });
}
