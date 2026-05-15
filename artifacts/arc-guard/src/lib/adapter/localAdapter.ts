/**
 * Local-Server Adapter — HTTP REST client for the company's on-premises server.
 *
 * Stores the server base URL in localStorage (arc_guard_local_server_url).
 * Every method calls the REST API at {serverUrl}/api/{companyId}/...
 * Subscriptions poll every 5 seconds.
 *
 * QR codes follow ARCG|{companyId}|{id} format — compatible with guard scanner.
 *
 * Offline fallback: if the server is unreachable, the offline queue
 * (IndexedDB offlineQueue via syncManager) will buffer logs and retry on reconnect.
 */

import type { DataAdapter } from "./types";

// ── Server URL persistence ────────────────────────────────────────────────────

const SERVER_URL_KEY = "arc_guard_local_server_url";
const POLL_MS        = 5_000;

export function getLocalServerUrl(): string {
  try { return localStorage.getItem(SERVER_URL_KEY)?.trim() ?? ""; }
  catch { return ""; }
}

export function setLocalServerUrl(url: string): void {
  try { localStorage.setItem(SERVER_URL_KEY, url.trim()); }
  catch { /* private browsing */ }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const base = getLocalServerUrl().replace(/\/$/, "");
  if (!base) throw new Error("آدرس سرور شرکت تنظیم نشده است");
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

function apiPath(companyId: string, resource: string): string {
  return `/api/${companyId}/${resource}`;
}

// ── Polling subscription factory ─────────────────────────────────────────────

function poll<T>(
  fetchFn: () => Promise<T>,
  cb: (data: T) => void,
  onError?: (e: Error) => void,
): () => void {
  let active = true;

  function run() {
    fetchFn()
      .then((d) => { if (active) cb(d); })
      .catch((e) => { if (active) onError?.(e as Error); });
  }

  run();
  const id = setInterval(run, POLL_MS);
  return () => { active = false; clearInterval(id); };
}

// ── Adapter implementation ────────────────────────────────────────────────────

export const localAdapter: DataAdapter = {

  // ── Checkpoints ──────────────────────────────────────────────────────────────

  async saveCheckpoint(companyId, cp) {
    const res = await apiFetch<{ id: string }>(apiPath(companyId, "checkpoints"), {
      method: "POST",
      body:   JSON.stringify({ companyId, ...cp }),
    });
    return res.id;
  },

  async updateCheckpoint(companyId, id, data) {
    await apiFetch(apiPath(companyId, `checkpoints/${id}`), {
      method: "PATCH",
      body:   JSON.stringify(data),
    });
  },

  async deleteCheckpoint(companyId, id) {
    await apiFetch(apiPath(companyId, `checkpoints/${id}`), { method: "DELETE" });
  },

  subscribeCheckpoints(companyId, cb, onError) {
    return poll(
      () => apiFetch<{ checkpoints: import("@/types").Checkpoint[] }>(apiPath(companyId, "checkpoints"))
              .then((r) => r.checkpoints ?? []),
      cb,
      onError,
    );
  },

  async getCheckpoints(companyId) {
    const r = await apiFetch<{ checkpoints: import("@/types").Checkpoint[] }>(apiPath(companyId, "checkpoints"));
    return r.checkpoints ?? [];
  },

  // ── Patrol Logs ───────────────────────────────────────────────────────────────

  async savePatrolLog(log) {
    const res = await apiFetch<{ id: string }>(apiPath(log.companyId, "patrol-logs"), {
      method: "POST",
      body:   JSON.stringify(log),
    });
    return res.id;
  },

  subscribePatrolLogs(companyId, cb, limitCount = 200) {
    return poll(
      () => apiFetch<{ logs: import("@/types").PatrolLog[] }>(
              apiPath(companyId, `patrol-logs?limit=${limitCount}`))
              .then((r) => r.logs ?? []),
      cb,
    );
  },

  async getPatrolLogs(companyId, guardId) {
    const qs  = guardId ? `?guardId=${encodeURIComponent(guardId)}` : "";
    const res = await apiFetch<{ logs: import("@/types").PatrolLog[] }>(apiPath(companyId, `patrol-logs${qs}`));
    return res.logs ?? [];
  },

  // ── Guard Sessions ────────────────────────────────────────────────────────────

  async updateGuardSession(session) {
    await apiFetch(apiPath(session.companyId, `guard-sessions/${session.guardId}`), {
      method: "PUT",
      body:   JSON.stringify(session),
    });
  },

  subscribeGuardSessions(companyId, cb) {
    return poll(
      () => apiFetch<{ sessions: import("@/types").GuardSession[] }>(apiPath(companyId, "guard-sessions"))
              .then((r) => r.sessions ?? []),
      cb,
    );
  },

  // ── Alerts ────────────────────────────────────────────────────────────────────

  async saveAlert(alert) {
    const res = await apiFetch<{ id: string }>(apiPath(alert.companyId, "alerts"), {
      method: "POST",
      body:   JSON.stringify(alert),
    });
    return res.id;
  },

  async saveMissedAlert(alert) {
    await apiFetch(apiPath(alert.companyId, "alerts"), {
      method: "POST",
      body:   JSON.stringify({ ...alert, kind: "missed" }),
    });
  },

  subscribeAlerts(companyId, cb, onError) {
    return poll(
      () => apiFetch<{ alerts: import("@/types").Alert[] }>(apiPath(companyId, "alerts"))
              .then((r) => r.alerts ?? []),
      cb,
      onError,
    );
  },

  async getAlertHistory(companyId, limitCount = 100) {
    const res = await apiFetch<{ alerts: import("@/types").Alert[] }>(
      apiPath(companyId, `alerts?limit=${limitCount}`),
    );
    return res.alerts ?? [];
  },

  async resolveAlert(companyId, id) {
    await apiFetch(apiPath(companyId, `alerts/${id}/resolve`), { method: "PATCH" });
  },

  // ── Company ───────────────────────────────────────────────────────────────────

  async getCompany(companyId) {
    try {
      const res = await apiFetch<{ company: import("@/types").CompanyRecord }>(apiPath(companyId, "company"));
      return res.company ?? null;
    } catch { return null; }
  },

  async updateCompany(companyId, data) {
    await apiFetch(apiPath(companyId, "company"), {
      method: "PATCH",
      body:   JSON.stringify(data),
    });
  },

  async regenerateInviteCode(companyId) {
    const res = await apiFetch<{ inviteCode: string }>(apiPath(companyId, "company/invite-code"), {
      method: "POST",
    });
    return res.inviteCode;
  },

  async getAllCompanies() {
    try {
      const res = await apiFetch<{ companies: import("@/types").CompanyRecord[] }>("/api/admin/companies");
      return res.companies ?? [];
    } catch { return []; }
  },

  subscribeAllCompanies(cb) {
    return poll(
      () => apiFetch<{ companies: import("@/types").CompanyRecord[] }>("/api/admin/companies")
              .then((r) => r.companies ?? [])
              .catch(() => [] as import("@/types").CompanyRecord[]),
      cb,
    );
  },

  async setCompanyPlan(companyId, plan) {
    await apiFetch(apiPath(companyId, "company/plan"), {
      method: "PATCH",
      body:   JSON.stringify({ plan }),
    });
  },

  async setCompanySuspended(companyId, suspended) {
    await apiFetch(apiPath(companyId, "company/suspended"), {
      method: "PATCH",
      body:   JSON.stringify({ suspended }),
    });
  },

  // ── Company guards ────────────────────────────────────────────────────────────

  async getCompanyGuards(companyId) {
    try {
      const res = await apiFetch<{ guards: import("@/types").UserProfile[] }>(apiPath(companyId, "guards"));
      return res.guards ?? [];
    } catch { return []; }
  },

  async setGuardActive(uid, active) {
    const base = getLocalServerUrl().replace(/\/$/, "");
    if (!base) return;
    await fetch(`${base}/api/guards/${uid}/active`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ active }),
    });
  },

  // ── Offline sync ──────────────────────────────────────────────────────────────

  async syncOfflineQueue() {
    // syncManager handles flush; this adapter is the target
    return 0;
  },
};

// ── Connection test helper (used by UI) ───────────────────────────────────────

export async function testLocalServerConnection(): Promise<boolean> {
  const base = getLocalServerUrl().replace(/\/$/, "");
  if (!base) return false;
  try {
    const res = await fetch(`${base}/api/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch { return false; }
}
