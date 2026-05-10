// Anti-cheat & scan protection
// Tracks cooldown per checkpoint in localStorage
// Validates QR format to prevent manual/fake input

const STORAGE_KEY = "arc_guard_scan_times";
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes per checkpoint

// ── QR format validation ───────────────────────────────────────────────────────
// All ARC Guard QR codes start with ARC_GUARD_CP_ and have a timestamp
const QR_PREFIX = "ARC_GUARD_CP_";
const MIN_QR_LEN = 20;
const MAX_QR_LEN = 200;

export function isValidQrFormat(qrText: string): boolean {
  if (!qrText || typeof qrText !== "string") return false;
  if (qrText.length < MIN_QR_LEN || qrText.length > MAX_QR_LEN) return false;
  if (!qrText.startsWith(QR_PREFIX)) return false;
  // Must contain only URL-safe characters (no scripts, no injections)
  if (!/^[A-Z0-9_]+$/.test(qrText)) return false;
  return true;
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
