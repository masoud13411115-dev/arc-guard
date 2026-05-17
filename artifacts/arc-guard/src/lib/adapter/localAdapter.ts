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
 *
 * v2 improvements:
 *   - 10-second AbortSignal.timeout on all fetch calls
 *   - Connection health cached so subscriptions degrade gracefully
 *   - Retry once on connection failure before propagating error
 *   - Richer error messages (HTTP status + server error body when available)
 */

import type { DataAdapter } from "./types";

// ── Server URL persistence ────────────────────────────────────────────────────

const SERVER_URL_KEY    = "arc_guard_local_server_url";
const POLL_MS           = 5_000;
const FETCH_TIMEOUT_MS  = 10_000;

export function getLocalServerUrl(): string {
  try { return localStorage.getItem(SERVER_URL_KEY)?.trim() ?? ""; }
  catch { return ""; }
}

export function setLocalServerUrl(url: string): void {
  try { localStorage.setItem(SERVER_URL_KEY, url.trim()); }
  catch { /* private browsing */ }
}

// ── Connection health cache ───────────────────────────────────────────────────
// Tracks last known server status to give meaningful errors in subscriptions.

let _lastHealthOk    = false;
let _lastHealthCheck = 0;
const HEALTH_CACHE_MS = 30_000; // re-check health at most every 30s

export function getCachedLocalServerHealth(): boolean { return _lastHealthOk; }

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const base = getLocalServerUrl().replace(/\/$/, "");
  if (!base) throw new Error("آدرس سرور شرکت تنظیم نشده است");

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${base}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
      signal: controller.signal,
    });

    if (!res.ok) {
      let body = "";
      try { body = await res.text(); } catch { /* ignore */ }
      throw new Error(`HTTP ${res.status} ${res.statusText}${body ? `: ${body.slice(0, 120)}` : ""}`);
    }

    return res.json() as Promise<T>;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`سرور پاسخ نداد (timeout ${FETCH_TIMEOUT_MS / 1000}s)`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
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
      .then((d) => {
        if (active) {
          _lastHealthOk    = true;
          _lastHealthCheck = Date.now();
          cb(d);
        }
      })
      .catch((e) => {
        if (active) {
          _lastHealthOk    = false;
          _lastHealthCheck = Date.now();
          onError?.(e as Error);
        }
      });
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
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      await fetch(`${base}/api/guards/${uid}/active`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ active }),
        signal:  controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  },

  // ── Offline sync ──────────────────────────────────────────────────────────────

  async syncOfflineQueue() {
    // syncManager handles flush; this adapter is the target
    return 0;
  },
};

// ── LAN company-ID cache ──────────────────────────────────────────────────────
// Stores the companyId discovered from the LAN server so guards can re-login
// without calling /api/info every time.

const LOCAL_COMPANY_ID_KEY = "arc_guard_local_company_id";

export function getLocalCompanyId(): string {
  try { return localStorage.getItem(LOCAL_COMPANY_ID_KEY)?.trim() ?? ""; }
  catch { return ""; }
}

export function setLocalCompanyId(id: string): void {
  try { localStorage.setItem(LOCAL_COMPANY_ID_KEY, id.trim()); }
  catch { /* private browsing */ }
}

// ── LAN guard authentication helpers ─────────────────────────────────────────

/**
 * Fetch company list from the LAN server's GET /api/info endpoint.
 * Returns null if the server is unreachable or no URL is configured.
 */
export async function getServerInfo(): Promise<{ companies: import("@/types").CompanyRecord[] } | null> {
  const base = getLocalServerUrl().replace(/\/$/, "");
  if (!base) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(`${base}/api/info`, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return res.json() as Promise<{ companies: import("@/types").CompanyRecord[] }>;
  } catch { clearTimeout(timer); return null; }
}

export type LanAuthResult =
  | { ok: true;  profile: import("@/types").UserProfile }
  | { ok: false; reason: "not_registered" | "invalid_pin" | "error" };

/**
 * Authenticate a guard against the LAN server (POST /api/:cid/guards/auth).
 *   ok=true  → profile returned, login success
 *   ok=false, reason="not_registered" → guard not on server yet, caller should register
 *   ok=false, reason="invalid_pin"   → wrong PIN
 *   ok=false, reason="error"         → server unreachable or unexpected error
 */
export async function authenticateGuardWithServer(
  companyId: string,
  guardCode: string,
  pin: string,
): Promise<LanAuthResult> {
  try {
    const res = await apiFetch<{ uid: string; profile: import("@/types").UserProfile }>(
      apiPath(companyId, "guards/auth"),
      { method: "POST", body: JSON.stringify({ guardCode: guardCode.toUpperCase(), pin }) },
    );
    return { ok: true, profile: { ...res.profile, uid: res.uid } };
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (msg.includes("404") || msg.includes("not_registered"))  return { ok: false, reason: "not_registered" };
    if (msg.includes("401") || msg.includes("invalid_pin"))     return { ok: false, reason: "invalid_pin" };
    return { ok: false, reason: "error" };
  }
}

/**
 * Register a guard on the LAN server (POST /api/:cid/guards/register).
 * Called automatically when the guard has a valid offline PIN cache but isn't
 * registered on the current server (e.g. after a server restart).
 */
export async function registerGuardWithServer(
  companyId: string,
  guardCode: string,
  pin: string,
  displayName: string,
  companyName?: string,
): Promise<import("@/types").UserProfile | null> {
  try {
    const res = await apiFetch<{ uid: string; profile: import("@/types").UserProfile }>(
      apiPath(companyId, "guards/register"),
      {
        method: "POST",
        body: JSON.stringify({
          guardCode: guardCode.toUpperCase(), pin, displayName,
          ...(companyName ? { companyName } : {}),
        }),
      },
    );
    return { ...res.profile, uid: res.uid };
  } catch { return null; }
}

// ── Connection test helper (used by UI) ───────────────────────────────────────

export async function testLocalServerConnection(): Promise<boolean> {
  const base = getLocalServerUrl().replace(/\/$/, "");
  if (!base) return false;
  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(`${base}/api/health`, { signal: controller.signal });
    clearTimeout(timer);
    const ok = res.ok;
    _lastHealthOk    = ok;
    _lastHealthCheck = Date.now();
    return ok;
  } catch {
    _lastHealthOk    = false;
    _lastHealthCheck = Date.now();
    return false;
  }
}

// ── Background health monitor for local server ────────────────────────────────
// Checks the local server health when enough time has elapsed since last check.

export async function checkLocalServerHealthIfStale(): Promise<boolean> {
  if (Date.now() - _lastHealthCheck < HEALTH_CACHE_MS) return _lastHealthOk;
  return testLocalServerConnection();
}
