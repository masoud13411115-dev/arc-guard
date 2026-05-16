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

// ── Anti-fraud GPS anomaly detection ──────────────────────────────────────

/**
 * GPS fraud flag codes:
 *   low_accuracy           — accuracy worse than 150 m (indoor/mocked)
 *   impossible_speed       — guard moved faster than 30 m/s (108 km/h)
 *   static_position        — exact same GPS across different checkpoints
 *   mock_location_suspected — zero-variance pattern across 3+ readings
 *   tampered_timestamp     — GPS timestamp jumps backwards or impossibly fast
 */
export type GpsFraudFlag =
  | 'low_accuracy'
  | 'impossible_speed'
  | 'static_position'
  | 'mock_location_suspected'
  | 'tampered_timestamp';

const LAST_GPS_KEY       = 'arc_guard_last_scan_gps';
const GPS_HISTORY_KEY    = 'arc_guard_gps_history';
const MAX_ACCURACY_M     = 150;
const MAX_SPEED_MS       = 30;       // 30 m/s = 108 km/h
const HISTORY_SIZE       = 6;        // readings kept for variance analysis
const ZERO_VARIANCE_M    = 0.5;      // < 0.5 m movement across 3+ readings = mock
const MIN_VARIANCE_READS = 3;

interface LastScanGps {
  lat: number;
  lng: number;
  accuracy: number;
  ts: number;
  checkpointId: string;
}

interface GpsHistoryEntry {
  lat: number;
  lng: number;
  ts: number;
}

function loadLastScanGps(): LastScanGps | null {
  try { return JSON.parse(localStorage.getItem(LAST_GPS_KEY) ?? 'null'); } catch { return null; }
}

function saveLastScanGps(data: LastScanGps) {
  try { localStorage.setItem(LAST_GPS_KEY, JSON.stringify(data)); } catch {}
}

function loadGpsHistory(): GpsHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(GPS_HISTORY_KEY) ?? '[]'); } catch { return []; }
}

function appendGpsHistory(entry: GpsHistoryEntry) {
  try {
    const hist = loadGpsHistory();
    hist.push(entry);
    // Keep only the last HISTORY_SIZE entries
    if (hist.length > HISTORY_SIZE) hist.splice(0, hist.length - HISTORY_SIZE);
    localStorage.setItem(GPS_HISTORY_KEY, JSON.stringify(hist));
  } catch {}
}

/**
 * Analyse GPS reading history for the zero-variance pattern.
 * Mock location apps often return the exactly same (or nearly identical)
 * coordinate for every reading.
 */
function checkZeroVariance(current: GpsCoords): boolean {
  const hist = loadGpsHistory();
  if (hist.length < MIN_VARIANCE_READS) return false;

  // Check the last MIN_VARIANCE_READS entries against the current reading
  const recent = hist.slice(-MIN_VARIANCE_READS);
  const allClose = recent.every(h => {
    const d = haversineDistance(h.lat, h.lng, current.lat, current.lng);
    return d < ZERO_VARIANCE_M;
  });

  return allClose;
}

/**
 * Detect GPS anomalies for anti-fraud.
 * Call BEFORE saving a patrol log.
 *
 * @param coords       — current GPS reading
 * @param checkpointId — checkpoint being scanned
 * @returns array of fraud flags (empty = clean)
 */
export function detectGpsFraud(
  coords: GpsCoords,
  checkpointId: string,
): GpsFraudFlag[] {
  const flags: GpsFraudFlag[] = [];

  // 1. Low accuracy
  if (coords.accuracy > MAX_ACCURACY_M) {
    flags.push('low_accuracy');
  }

  // 2. Zero-variance (mock location pattern across multiple readings)
  if (checkZeroVariance(coords)) {
    flags.push('mock_location_suspected');
  }

  const last = loadLastScanGps();
  if (last) {
    const distM = haversineDistance(last.lat, last.lng, coords.lat, coords.lng);
    const dtSec = (Date.now() - last.ts) / 1000;

    // 3. Impossible speed
    if (dtSec > 2 && dtSec < 3600) {
      const speedMs = distM / dtSec;
      if (speedMs > MAX_SPEED_MS) {
        flags.push('impossible_speed');
      }
    }

    // 4. Static position across different checkpoints
    if (checkpointId !== last.checkpointId && distM < 2) {
      flags.push('static_position');
    }

    // 5. Tampered timestamp: system clock jumped backward since last scan
    if (Date.now() < last.ts) {
      flags.push('tampered_timestamp');
    }
  }

  return flags;
}

/**
 * Record a successful scan's GPS for future fraud detection comparisons.
 * Also appends the reading to the rolling variance-detection history.
 * Call AFTER a successful scan is saved.
 */
export function recordScanGps(coords: GpsCoords, checkpointId: string) {
  const now = Date.now();
  saveLastScanGps({
    lat: coords.lat,
    lng: coords.lng,
    accuracy: coords.accuracy,
    ts: now,
    checkpointId,
  });
  appendGpsHistory({ lat: coords.lat, lng: coords.lng, ts: now });
}

/**
 * Feed a background GPS reading into the variance history without
 * updating the "last scan" record. Call from watchPosition handler
 * so the history is built up between scans.
 */
export function recordBackgroundGps(coords: GpsCoords) {
  appendGpsHistory({ lat: coords.lat, lng: coords.lng, ts: Date.now() });
}
