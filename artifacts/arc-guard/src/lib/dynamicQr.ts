/**
 * Dynamic QR — rotating HMAC-SHA-256 codes for ARC Guard checkpoints.
 *
 * Format:  ARCG_DYN|{checkpointId}|{windowNum}|{hmac8}
 *   windowNum  = Math.floor(Date.now() / 1000 / WINDOW_SECS)   (changes every 10 min)
 *   hmac8      = first 8 hex chars of HMAC-SHA-256(secret, "{checkpointId}|{windowNum}")
 *
 * Validation accepts ±TOLERANCE_WINDOWS for clock skew between guard device and display.
 *
 * Anti-replay: each windowNum per checkpoint can only be used ONCE. Validated window
 * numbers are stored in localStorage and rejected on subsequent scans.
 */

import { useState, useEffect } from "react";

export const WINDOW_SECS       = 600;  // QR rotates every 10 minutes
export const TOLERANCE_WINDOWS = 1;    // accept ±1 window (~10 min clock skew tolerance)

const REPLAY_KEY = "arc_guard_used_dyn_windows";

// ── Crypto helpers ─────────────────────────────────────────────────────────────

function getCurrentWindow(): number {
  return Math.floor(Date.now() / 1000 / WINDOW_SECS);
}

async function computeHmac8(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 8);
}

// ── Anti-replay store ──────────────────────────────────────────────────────────

type ReplayRecord = Record<string, number>; // key: "cpId:windowNum" → timestamp stored

function loadReplayRecord(): ReplayRecord {
  try { return JSON.parse(localStorage.getItem(REPLAY_KEY) ?? "{}"); } catch { return {}; }
}

function saveReplayRecord(rec: ReplayRecord) {
  try { localStorage.setItem(REPLAY_KEY, JSON.stringify(rec)); } catch {}
}

function pruneOldWindows(rec: ReplayRecord): ReplayRecord {
  const minWindow = getCurrentWindow() - TOLERANCE_WINDOWS - 2;
  const pruned: ReplayRecord = {};
  for (const [key, val] of Object.entries(rec)) {
    const winNum = parseInt(key.split(":")[1] ?? "0", 10);
    if (winNum >= minWindow) pruned[key] = val;
  }
  return pruned;
}

/** Returns true if this windowNum for this checkpoint has already been used (replay attack). */
export function isDynamicWindowUsed(checkpointId: string, windowNum: number): boolean {
  const rec = loadReplayRecord();
  return `${checkpointId}:${windowNum}` in rec;
}

/** Mark a windowNum as used for this checkpoint (call after a successful scan). */
export function markDynamicWindowUsed(checkpointId: string, windowNum: number) {
  const rec = pruneOldWindows(loadReplayRecord());
  rec[`${checkpointId}:${windowNum}`] = Date.now();
  saveReplayRecord(rec);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Generate a 32-char random hex secret for a new Dynamic QR checkpoint. */
export function generateDynamicQrSecret(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Build the current QR string for display (manager side). */
export async function generateDynamicQr(
  checkpointId: string,
  secret: string,
): Promise<string> {
  const win  = getCurrentWindow();
  const hmac = await computeHmac8(secret, `${checkpointId}|${win}`);
  return `ARCG_DYN|${checkpointId}|${win}|${hmac}`;
}

/**
 * Validate a scanned Dynamic QR string.
 * Returns { valid: true, windowNum } on success, or { valid: false, reason } on failure.
 */
export async function validateDynamicQr(
  qrText:       string,
  checkpointId: string,
  secret:       string,
): Promise<boolean> {
  if (!qrText.startsWith("ARCG_DYN|")) return false;
  const parts = qrText.split("|");
  if (parts.length !== 4) return false;

  const [, qrCpId, winStr, qrHmac] = parts;
  if (qrCpId !== checkpointId) return false;

  const qrWin  = parseInt(winStr, 10);
  if (isNaN(qrWin)) return false;

  const curWin = getCurrentWindow();
  if (Math.abs(curWin - qrWin) > TOLERANCE_WINDOWS) return false;

  const expected = await computeHmac8(secret, `${checkpointId}|${qrWin}`);
  return qrHmac === expected;
}

/**
 * Extract the windowNum from a validated Dynamic QR string, for anti-replay marking.
 * Returns null if parsing fails.
 */
export function extractDynamicQrWindow(qrText: string): number | null {
  const parts = qrText.split("|");
  if (parts.length !== 4) return null;
  const win = parseInt(parts[2], 10);
  return isNaN(win) ? null : win;
}

/** How many seconds until the current window expires (for countdown display). */
export function secondsUntilWindowExpiry(): number {
  const elapsed = Math.floor(Date.now() / 1000) % WINDOW_SECS;
  return WINDOW_SECS - elapsed;
}

// ── React hook ─────────────────────────────────────────────────────────────────

/**
 * Hook that returns a live-updating Dynamic QR string and a countdown.
 * QR text updates every second (for countdown accuracy); underlying window changes every 10 min.
 */
export function useDynamicQrText(
  checkpointId: string | undefined,
  secret:       string | undefined,
): { qrText: string; secondsLeft: number } {
  const [qrText, setQrText]     = useState("");
  const [secondsLeft, setSecondsLeft] = useState(secondsUntilWindowExpiry());

  useEffect(() => {
    if (!checkpointId || !secret) { setQrText(""); return; }

    let cancelled = false;

    const update = async () => {
      const text = await generateDynamicQr(checkpointId, secret);
      if (!cancelled) {
        setQrText(text);
        setSecondsLeft(secondsUntilWindowExpiry());
      }
    };

    update();
    const id = setInterval(update, 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [checkpointId, secret]);

  return { qrText, secondsLeft };
}
