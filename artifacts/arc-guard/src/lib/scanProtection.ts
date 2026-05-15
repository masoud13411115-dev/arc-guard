// Anti-cheat & scan protection
// Tracks cooldown per checkpoint in localStorage
// Validates QR format to prevent manual/fake input

const STORAGE_KEY = "arc_guard_scan_times";
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes per checkpoint

// ── QR format validation ───────────────────────────────────────────────────────
//
// v2 (current):  ARCG|{companyId}|{checkpointId}
//   - Contains companyId + checkpointId for cross-company security validation
//   - Example: ARCG|abc123|xyz789
//
// v1 (legacy):   ARC_GUARD_CP_{NAME}_{TIMESTAMP}
//   - Older checkpoints printed before the v2 migration
//
// dynamic (v3):  ARCG_DYN|{checkpointId}|{windowNum}|{hmac8}
//   - Time-rotating HMAC-signed code; valid for ±2 windows (±2 min)

const QR_V2_PREFIX  = "ARCG|";
const QR_V1_PREFIX  = "ARC_GUARD_CP_";
const QR_DYN_PREFIX = "ARCG_DYN|";

export function isValidQrFormat(qrText: string): boolean {
  if (!qrText || typeof qrText !== "string") return false;
  if (qrText.length > 300) return false;

  // v2 format: ARCG|{companyId}|{checkpointId}
  if (qrText.startsWith(QR_V2_PREFIX)) {
    const parts = qrText.split("|");
    return parts.length === 3 && parts[1].length > 0 && parts[2].length > 0;
  }

  // Dynamic format: ARCG_DYN|{checkpointId}|{windowNum}|{hmac8}
  if (qrText.startsWith(QR_DYN_PREFIX)) {
    const parts = qrText.split("|");
    return (
      parts.length === 4 &&
      parts[1].length > 0 &&   // checkpointId
      parts[2].length > 0 &&   // windowNum
      parts[3].length === 8    // hmac8 is exactly 8 hex chars
    );
  }

  // v1 legacy format: ARC_GUARD_CP_{NAME}_{TIMESTAMP}
  if (qrText.startsWith(QR_V1_PREFIX)) {
    return qrText.length >= 20 && /^[A-Z0-9_]+$/.test(qrText);
  }

  return false;
}

/** Parse a v2 QR code → {companyId, checkpointId}, or null for v1/dynamic/invalid */
export function parseQrCode(qrText: string): { companyId: string; checkpointId: string } | null {
  if (!qrText.startsWith(QR_V2_PREFIX)) return null;
  const parts = qrText.split("|");
  if (parts.length !== 3 || !parts[1] || !parts[2]) return null;
  return { companyId: parts[1], checkpointId: parts[2] };
}

/** Parse a Dynamic QR code → {checkpointId, windowNum, hmac}, or null for other formats */
export function parseDynamicQrCode(
  qrText: string,
): { checkpointId: string; windowNum: number; hmac: string } | null {
  if (!qrText.startsWith(QR_DYN_PREFIX)) return null;
  const parts = qrText.split("|");
  if (parts.length !== 4) return null;
  const [, checkpointId, winStr, hmac] = parts;
  const windowNum = parseInt(winStr, 10);
  if (!checkpointId || isNaN(windowNum) || !hmac) return null;
  return { checkpointId, windowNum, hmac };
}

// ── Cooldown tracking ─────────────────────────────────────────────────────────
interface ScanRecord {
  [checkpointId: string]: number; // timestamp of last scan
}

function load(): ScanRecord {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch { return {}; }
}

function save(rec: ScanRecord) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rec)); } catch {}
}

/** Returns true if the checkpoint is allowed to be scanned right now */
export function canScan(checkpointId: string): boolean {
  const rec = load();
  const last = rec[checkpointId];
  if (!last) return true;
  return Date.now() - last >= COOLDOWN_MS;
}

/** Record a successful scan for cooldown tracking */
export function recordScan(checkpointId: string) {
  const rec = load();
  rec[checkpointId] = Date.now();
  save(rec);
}

/** How many SECONDS until this checkpoint can be scanned again (0 = allowed) */
export function secondsUntilNextScan(checkpointId: string): number {
  const rec = load();
  const last = rec[checkpointId];
  if (!last) return 0;
  const remaining = COOLDOWN_MS - (Date.now() - last);
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

/** Format seconds as mm:ss */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Clear all cooldowns (for testing / demo) */
export function clearAllCooldowns() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
