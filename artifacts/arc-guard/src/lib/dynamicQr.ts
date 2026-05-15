/**
 * Dynamic QR — rotating HMAC-SHA-256 codes for ARC Guard checkpoints.
 *
 * Format:  ARCG_DYN|{checkpointId}|{windowNum}|{hmac8}
 *   windowNum  = Math.floor(Date.now() / 1000 / WINDOW_SECS)   (changes every 60 s)
 *   hmac8      = first 8 hex chars of HMAC-SHA-256(secret, "{checkpointId}|{windowNum}")
 *
 * Validation accepts ±TOLERANCE_WINDOWS for clock skew between guard device and display.
 */

import { useState, useEffect } from "react";

export const WINDOW_SECS       = 60;   // QR rotates every 60 seconds
export const TOLERANCE_WINDOWS = 2;    // accept ±2 windows (2 min clock skew)

// ── Crypto helpers ────────────────────────────────────────────────────────────

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

// ── Public API ────────────────────────────────────────────────────────────────

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
 * Returns true if the QR is fresh and the HMAC matches.
 */
export async function validateDynamicQr(
  qrText:     string,
  checkpointId: string,
  secret:     string,
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

// ── React hook ────────────────────────────────────────────────────────────────

/**
 * Hook that returns a live-updating Dynamic QR string, refreshing every second.
 * Returns empty string when checkpointId or secret is missing.
 */
export function useDynamicQrText(
  checkpointId: string | undefined,
  secret:       string | undefined,
): string {
  const [qrText, setQrText] = useState("");

  useEffect(() => {
    if (!checkpointId || !secret) { setQrText(""); return; }

    let cancelled = false;
    const update = async () => {
      const text = await generateDynamicQr(checkpointId, secret);
      if (!cancelled) setQrText(text);
    };

    update();
    const id = setInterval(update, 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [checkpointId, secret]);

  return qrText;
}
