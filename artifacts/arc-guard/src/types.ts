export interface GpsCoords {
  lat: number;
  lng: number;
  accuracy: number;
}

export type PlanId = 'basic' | 'professional' | 'enterprise';

/**
 * Verification mode for a company (default) or individual checkpoint (override).
 *  gpsOnly   — guard checks in using GPS location only, no QR scan required
 *  fixedQr   — guard scans a static printed QR + GPS radius check (default)
 *  dynamicQr — guard scans a time-rotating HMAC-signed QR + GPS radius check
 */
export type VerificationMode = 'gpsOnly' | 'fixedQr' | 'dynamicQr';

/**
 * Per-checkpoint scan mode — which physical verification methods are required.
 *  qr       — QR code scan only (no GPS distance check)
 *  gps      — GPS proximity check only (no QR scan)
 *  nfc      — NFC tap only
 *  qr+gps   — QR scan + GPS distance check (classic patrol mode)
 *  qr+nfc   — QR scan + NFC tap
 *  gps+nfc  — GPS proximity + NFC tap
 *  all      — QR scan + GPS distance + NFC tap
 */
export type ScanMode = 'qr' | 'gps' | 'nfc' | 'qr+gps' | 'qr+nfc' | 'gps+nfc' | 'all';

export interface Company {
  id: string;
  name: string;
  adminUid: string;
  adminUsername: string;
  createdAt: number;
}

export interface CompanyRecord {
  id: string;
  name: string;
  adminUid: string;
  adminUsername: string;
  plan: PlanId;
  active: boolean;
  suspended: boolean;
  inviteCode: string;
  guardCount: number;
  checkpointCount: number;
  createdAt: number;
  trialEndsAt?: number;
  notes?: string;
  /** Company-wide default verification mode; individual checkpoints may override. */
  verificationMode?: VerificationMode;
}

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  role: 'manager' | 'guard' | 'super_admin';
  companyId: string;
  companyName?: string;
  guardCode?: string;
  active: boolean;
  createdAt: number;
}

export interface Checkpoint {
  id: string;
  name: string;
  location: string;
  qrCode: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  /** Patrol interval in minutes — e.g. 17, 30, 120 */
  patrolIntervalMinutes: number;
  active: boolean;
  companyId: string;
  createdAt: number;
  /** Per-checkpoint mode override; falls back to company default when absent. */
  verificationMode?: VerificationMode;
  /**
   * Scan mode — which verification methods are required for this checkpoint.
   * Takes precedence over verificationMode when set.
   */
  scanMode?: ScanMode;
  /** HMAC-SHA-256 secret for dynamicQr mode — auto-generated on checkpoint creation. */
  dynamicQrSecret?: string;
}

export type ScanStatus = 'valid' | 'outside' | 'failed';

export interface PatrolLog {
  id?: string;
  guardId: string;
  guardName: string;
  checkpointId: string;
  checkpointName: string;
  qrScanned: string;
  gps: GpsCoords | null;
  distanceMeters: number | null;
  withinRadius: boolean;
  status: ScanStatus;
  scanTime: number;
  scannedAt: number;
  scannedAtText: string;
  companyId: string;
  synced: boolean;
  offlineQueued?: boolean;
  /** Which scan mode was used for this log entry */
  scanMode?: string;
  /** Anti-fraud anomaly flags detected at scan time */
  fraudFlags?: string[];
}

export type AlertKind = 'sos' | 'missed' | 'outside';
export type AlertStatus = 'unread' | 'read' | 'resolved';

export interface Alert {
  id?: string;
  kind: AlertKind;
  /** read/unread/resolved — separate from resolved boolean for compatibility */
  status?: AlertStatus;
  guardId: string;
  guardName: string;
  checkpointId?: string;
  checkpointName?: string;
  /** Nested GPS object (legacy) */
  gps?: GpsCoords | null;
  /** Flat GPS fields — written alongside gps object so Firestore rules can index them */
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAccuracy?: number | null;
  distanceMeters?: number | null;
  scheduledAt?: number;
  alertedAt: number;
  companyId: string;
  resolved: boolean;
  resolvedAt?: number;
  message?: string;
}

/** @deprecated use Alert */
export type MissedAlert = Alert;

export interface GuardSession {
  guardId: string;
  guardName: string;
  lastSeen: number;
  lastCheckpoint: string;
  lastGps: GpsCoords | null;
  status: 'active' | 'idle' | 'offline';
  companyId: string;
}

export interface OfflineQueueItem {
  id: string;
  type: 'patrol_log';
  payload: PatrolLog;
  createdAt: number;
}
