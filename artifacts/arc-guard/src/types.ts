export interface GpsCoords {
  lat: number;
  lng: number;
  accuracy: number;
}

export type PlanId = 'basic' | 'professional' | 'enterprise';

export interface Company {
  id: string;
  name: string;
  adminUid: string;
  adminEmail: string;
  createdAt: number;
}

export interface CompanyRecord {
  id: string;
  name: string;
  adminUid: string;
  adminEmail: string;
  plan: PlanId;
  active: boolean;
  suspended: boolean;
  inviteCode: string;
  guardCount: number;
  checkpointCount: number;
  createdAt: number;
  trialEndsAt?: number;
  notes?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
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
  scheduledMinutes: number[];
  active: boolean;
  companyId: string;
  createdAt: number;
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
}

export type AlertKind = 'sos' | 'missed' | 'outside';

export interface Alert {
  id?: string;
  kind: AlertKind;
  guardId: string;
  guardName: string;
  checkpointId?: string;
  checkpointName?: string;
  gps?: GpsCoords | null;
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
