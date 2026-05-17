/**
 * ARC Guard — Offline Manager Authentication
 *
 * Provides credential caching (SHA-256 hash) and profile caching so
 * managers can log in on a device that has been used before, even without
 * an active internet connection.
 *
 * Security model:
 *  - Stores SHA-256("arc_guard_offline_v1|{username}|{password}") in localStorage.
 *  - The hash is DEVICE-LOCAL and never transmitted anywhere.
 *  - A credential is persisted ONLY after a verified Firebase sign-in.
 *  - Online login always goes through Firebase Auth; this never replaces it.
 *  - If the user changes their password online the old cached hash becomes invalid,
 *    and offline login will fail until they log in online again.
 */

import type { UserProfile } from "@/types";

// ── Storage keys ──────────────────────────────────────────────────────────────
const credKey    = (u: string) => `arc_guard_offline_cred_${u.toLowerCase()}`;
const profileKey = (uid: string) => `arc_guard_mgr_profile_${uid}`;

// ── SHA-256 via Web Crypto API ────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function makeHash(username: string, password: string): Promise<string> {
  return sha256(`arc_guard_offline_v1|${username.toLowerCase()}|${password}`);
}

// ── Credential cache ──────────────────────────────────────────────────────────

export interface OfflineManagerCred {
  uid:     string;
  hash:    string;
  savedAt: number;
}

/**
 * Save an offline credential after a successful Firebase sign-in.
 * Call this every time the manager logs in online so the hash stays current.
 */
export async function saveOfflineManagerCred(
  username: string,
  password: string,
  uid:      string,
): Promise<void> {
  const hash = await makeHash(username, password);
  const cred: OfflineManagerCred = { uid, hash, savedAt: Date.now() };
  try {
    localStorage.setItem(credKey(username), JSON.stringify(cred));
  } catch {
    // storage quota — not critical
  }
}

/** True if this username has a stored offline credential on this device. */
export function hasOfflineManagerCred(username: string): boolean {
  return !!localStorage.getItem(credKey(username.toLowerCase()));
}

/**
 * Verify username + password against the locally stored hash.
 * Returns the cached uid on success, null on wrong password or no cache.
 */
export async function verifyOfflineManagerCred(
  username: string,
  password: string,
): Promise<string | null> {
  const raw = localStorage.getItem(credKey(username));
  if (!raw) return null;
  try {
    const cred = JSON.parse(raw) as OfflineManagerCred;
    const hash = await makeHash(username, password);
    return hash === cred.hash ? cred.uid : null;
  } catch {
    return null;
  }
}

/** Remove the stored offline credential (call on explicit logout). */
export function clearOfflineManagerCred(username: string): void {
  try { localStorage.removeItem(credKey(username)); } catch { /* ok */ }
}

// ── Profile cache ─────────────────────────────────────────────────────────────
// Shared between ManagerApp (auth-change restoration) and LoginPage (offline login).

/** Persist a UserProfile to localStorage for offline access. */
export function saveProfileCache(p: UserProfile): void {
  try {
    localStorage.setItem(profileKey(p.uid), JSON.stringify(p));
  } catch { /* storage full */ }
}

/** Load a cached UserProfile from localStorage. Returns null if not found. */
export function loadProfileCache(uid: string): UserProfile | null {
  try {
    const raw = localStorage.getItem(profileKey(uid));
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch { return null; }
}

/** Remove cached profile (call on explicit logout if desired). */
export function clearProfileCache(uid: string): void {
  try { localStorage.removeItem(profileKey(uid)); } catch { /* ok */ }
}

// ── Guard offline credential cache ────────────────────────────────────────────
// Same SHA-256 pattern as manager creds, keyed by guardCode.
// Saved after every successful Firebase guard login so the guard can
// re-authenticate on the same device when offline (IndexedDB mode).

const guardCredKey = (code: string) =>
  `arc_guard_offline_guard_cred_${code.toLowerCase()}`;

async function makeGuardHash(guardCode: string, pin: string): Promise<string> {
  return sha256(`arc_guard_offline_guard_v1|${guardCode.toLowerCase()}|${pin}`);
}

export interface OfflineGuardCred {
  uid:       string;
  companyId: string;
  hash:      string;
  savedAt:   number;
}

/**
 * Save a guard's offline credential after a successful Firebase login.
 * Call this every login so the hash stays current with the guard's PIN.
 */
export async function saveGuardOfflineCred(
  guardCode: string,
  pin:       string,
  uid:       string,
  companyId: string,
): Promise<void> {
  const hash = await makeGuardHash(guardCode, pin);
  const cred: OfflineGuardCred = { uid, companyId, hash, savedAt: Date.now() };
  try { localStorage.setItem(guardCredKey(guardCode), JSON.stringify(cred)); } catch { /* quota */ }
}

/** True if this guardCode has a stored offline credential on this device. */
export function hasGuardOfflineCred(guardCode: string): boolean {
  return !!localStorage.getItem(guardCredKey(guardCode.toLowerCase()));
}

/**
 * Verify guardCode + PIN against the locally stored hash.
 * Returns { uid, companyId } on success, null on wrong PIN or no cache.
 */
export async function verifyGuardOfflineCred(
  guardCode: string,
  pin:       string,
): Promise<{ uid: string; companyId: string } | null> {
  const raw = localStorage.getItem(guardCredKey(guardCode));
  if (!raw) return null;
  try {
    const cred = JSON.parse(raw) as OfflineGuardCred;
    const hash = await makeGuardHash(guardCode, pin);
    return hash === cred.hash ? { uid: cred.uid, companyId: cred.companyId } : null;
  } catch { return null; }
}

/** Remove the stored guard offline credential (call on explicit logout). */
export function clearGuardOfflineCred(guardCode: string): void {
  try { localStorage.removeItem(guardCredKey(guardCode)); } catch { /* ok */ }
}

// ── Last-session profile cache (uid-agnostic) ─────────────────────────────────
// Stored under fixed keys so the app can restore the last session on startup
// without knowing the uid — essential when Firebase isn't configured
// (IndexedDB-only setups) and onAuthChange never fires.

const LAST_MGR_KEY   = "arc_guard_last_mgr_profile";
const LAST_GUARD_KEY = "arc_guard_last_guard_profile";

export function saveLastManagerProfile(p: UserProfile): void {
  try { localStorage.setItem(LAST_MGR_KEY, JSON.stringify(p)); } catch { /* quota */ }
}
export function loadLastManagerProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(LAST_MGR_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch { return null; }
}
export function clearLastManagerProfile(): void {
  try { localStorage.removeItem(LAST_MGR_KEY); } catch { /* ok */ }
}

export function saveLastGuardProfile(p: UserProfile): void {
  try { localStorage.setItem(LAST_GUARD_KEY, JSON.stringify(p)); } catch { /* quota */ }
}
export function loadLastGuardProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(LAST_GUARD_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch { return null; }
}
export function clearLastGuardProfile(): void {
  try { localStorage.removeItem(LAST_GUARD_KEY); } catch { /* ok */ }
}
