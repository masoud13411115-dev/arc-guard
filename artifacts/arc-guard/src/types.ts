export interface GpsCoords {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface Checkpoint {
  id: string;
  name: string;
  location: string;
  qrCode: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  scheduledMinutes: number[]; // minutes past midnight each visit is due
  active: boolean;
  createdAt: number;
}

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
  scannedAt: number;
  scannedAtText: string;
  synced: boolean;
  offlineQueued?: boolean;
}

export interface MissedAlert {
  id?: string;
  guardId: string;
  guardName: string;
  checkpointId: string;
  checkpointName: string;
  scheduledAt: number;
  alertedAt: number;
  resolved: boolean;
}

export interface GuardSession {
  guardId: string;
  guardName: string;
  lastSeen: number;
  lastCheckpoint: string;
  lastGps: GpsCoords | null;
  status: 'active' | 'idle' | 'offline';
}

export interface OfflineQueueItem {
  id: string;
  type: 'patrol_log';
  payload: PatrolLog;
  createdAt: number;
}
