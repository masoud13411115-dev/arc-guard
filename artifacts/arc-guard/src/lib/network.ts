/**
 * Network monitoring and auto-reconnect for ARC Guard.
 * - Monitors online/offline browser events
 * - Exponential backoff health pings when connection is uncertain
 * - Notifies listeners with accurate online state
 * - Works alongside Firebase's own internal reconnection
 */

import { logger } from './logger';

export type NetworkState = 'online' | 'offline' | 'slow';

type Listener = (state: NetworkState) => void;

// ── Internal state ────────────────────────────────────────────────────────────
let currentState: NetworkState = navigator.onLine ? 'online' : 'offline';
let pingTimer: ReturnType<typeof setTimeout> | null = null;
let backoffMs = 2000;
const MAX_BACKOFF = 30_000;
const listeners = new Set<Listener>();

function notify(state: NetworkState) {
  if (state === currentState) return;
  currentState = state;
  logger.info('network', `State → ${state}`);
  listeners.forEach((l) => l(state));
}

// ── Connectivity ping ─────────────────────────────────────────────────────────
// Pings Google's DNS-over-HTTPS endpoint (fast, no-auth, returns JSON)
const PING_URL = 'https://dns.google/resolve?name=firebase.google.com&type=A';
const PING_TIMEOUT = 5000;

async function ping(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), PING_TIMEOUT);
    const res = await fetch(PING_URL, { method: 'HEAD', mode: 'no-cors', signal: ctrl.signal });
    clearTimeout(t);
    return true; // no-cors request only succeeds if network is up
  } catch {
    return false;
  }
}

// ── Backoff ping loop ─────────────────────────────────────────────────────────
async function schedulePing() {
  if (pingTimer) clearTimeout(pingTimer);
  const alive = await ping();
  if (alive) {
    notify('online');
    backoffMs = 2000;
    // stop pinging — rely on events again
  } else {
    notify('offline');
    backoffMs = Math.min(backoffMs * 1.5, MAX_BACKOFF);
    pingTimer = setTimeout(schedulePing, backoffMs);
  }
}

// ── Browser event listeners ───────────────────────────────────────────────────
function handleOnline() {
  // Browser says online — verify with a real ping before trusting
  schedulePing();
}

function handleOffline() {
  notify('offline');
  if (pingTimer) { clearTimeout(pingTimer); pingTimer = null; }
  // Start polling to detect when back online
  pingTimer = setTimeout(schedulePing, backoffMs);
}

window.addEventListener('online', handleOnline);
window.addEventListener('offline', handleOffline);

// ── Public API ────────────────────────────────────────────────────────────────

/** Subscribe to network state changes. Returns an unsubscribe function. */
export function onNetworkChange(cb: Listener): () => void {
  listeners.add(cb);
  // Immediately notify with current state
  cb(currentState);
  return () => listeners.delete(cb);
}

/** Current network state */
export function getNetworkState(): NetworkState {
  return currentState;
}

/** Manually trigger a connectivity check */
export async function checkConnectivity(): Promise<NetworkState> {
  const alive = await ping();
  const state: NetworkState = alive ? 'online' : 'offline';
  notify(state);
  return state;
}

/** True if the network is currently considered online */
export function isNetworkOnline(): boolean {
  return currentState === 'online' || currentState === 'slow';
}
