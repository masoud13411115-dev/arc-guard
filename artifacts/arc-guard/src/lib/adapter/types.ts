import type {
  Checkpoint, PatrolLog, Alert, GuardSession,
  CompanyRecord, UserProfile, PlanId,
} from "@/types";

// ── Adapter mode ───────────────────────────────────────────────────────────────
/**
 * firebase   — cloud Firebase Firestore (default)
 * indexeddb  — fully local IndexedDB on this device; works offline forever
 * local      — company LAN server via HTTP REST API
 */
export type AdapterMode = "firebase" | "indexeddb" | "local";

// ── Unified data-access interface ──────────────────────────────────────────────
export interface DataAdapter {

  // ── Checkpoints ──────────────────────────────────────────────────────────────
  saveCheckpoint(
    companyId: string,
    cp: Omit<Checkpoint, "id" | "createdAt" | "companyId" | "qrCode">,
  ): Promise<string>;

  updateCheckpoint(
    companyId: string,
    id: string,
    data: Partial<Checkpoint>,
  ): Promise<void>;

  deleteCheckpoint(companyId: string, id: string): Promise<void>;

  subscribeCheckpoints(
    companyId: string,
    cb: (cps: Checkpoint[]) => void,
    onError?: (err: Error) => void,
  ): () => void;

  getCheckpoints(companyId: string): Promise<Checkpoint[]>;

  // ── Patrol Logs ───────────────────────────────────────────────────────────────
  savePatrolLog(log: PatrolLog): Promise<string>;

  subscribePatrolLogs(
    companyId: string,
    cb: (logs: PatrolLog[]) => void,
    limitCount?: number,
  ): () => void;

  getPatrolLogs(companyId: string, guardId?: string): Promise<PatrolLog[]>;

  // ── Guard Sessions ────────────────────────────────────────────────────────────
  updateGuardSession(session: GuardSession): Promise<void>;

  subscribeGuardSessions(
    companyId: string,
    cb: (sessions: GuardSession[]) => void,
  ): () => void;

  // ── Alerts ────────────────────────────────────────────────────────────────────
  saveAlert(alert: Omit<Alert, "id">): Promise<string>;

  saveMissedAlert(alert: Omit<Alert, "id">): Promise<void>;

  subscribeAlerts(
    companyId: string,
    cb: (alerts: Alert[]) => void,
    onError?: (err: Error) => void,
  ): () => void;

  getAlertHistory(companyId: string, limitCount?: number): Promise<Alert[]>;

  resolveAlert(companyId: string, id: string): Promise<void>;

  // ── Company ───────────────────────────────────────────────────────────────────
  getCompany(companyId: string): Promise<CompanyRecord | null>;

  updateCompany(companyId: string, data: Partial<CompanyRecord>): Promise<void>;

  regenerateInviteCode(companyId: string): Promise<string>;

  getAllCompanies(): Promise<CompanyRecord[]>;

  subscribeAllCompanies(cb: (companies: CompanyRecord[]) => void): () => void;

  setCompanyPlan(companyId: string, plan: PlanId): Promise<void>;

  setCompanySuspended(companyId: string, suspended: boolean): Promise<void>;

  // ── Company guards ────────────────────────────────────────────────────────────
  getCompanyGuards(companyId: string): Promise<UserProfile[]>;

  setGuardActive(uid: string, active: boolean): Promise<void>;

  // ── Offline sync ──────────────────────────────────────────────────────────────
  syncOfflineQueue(): Promise<number>;
}
