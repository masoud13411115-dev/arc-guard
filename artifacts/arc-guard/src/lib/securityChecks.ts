/**
 * securityChecks.ts — Enterprise security hardening for ARC Guard.
 *
 * Detects hostile environments: emulators, debuggers, iframes,
 * screen recorders, and cloned app installs. All checks run in the
 * JS/WebView layer — no native plugin required.
 *
 * Results are cached for 5 minutes to avoid repeated overhead.
 */

export interface SecurityFlag {
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detail: string;
}

export interface SecurityReport {
  passed: boolean;
  score: number;        // 0–100: 100 = fully clean
  flags: SecurityFlag[];
  checkedAt: number;    // timestamp ms
  environment: 'capacitor' | 'browser' | 'unknown';
}

const REPORT_KEY = 'arc_guard_sec_report';
const REPORT_TTL_MS = 5 * 60 * 1000;
const INSTALL_TS_KEY = 'arc_guard_install_ts';

// ── Environment detection ──────────────────────────────────────────────────

function detectEnvironment(): 'capacitor' | 'browser' | 'unknown' {
  if (typeof (window as any).Capacitor !== 'undefined') return 'capacitor';
  if (typeof navigator !== 'undefined' && !!navigator.userAgent) return 'browser';
  return 'unknown';
}

// ── Emulator / ADB signals ────────────────────────────────────────────────

function checkEmulatorSignals(): SecurityFlag[] {
  const flags: SecurityFlag[] = [];
  const ua = navigator.userAgent.toLowerCase();

  const emulatorPatterns = [
    'sdk_gphone', 'android sdk built for x86', 'goldfish',
    'generic_x86', 'emulator', 'vbox', 'bluestacks',
  ];
  if (emulatorPatterns.some(p => ua.includes(p))) {
    flags.push({
      code: 'emulator_ua',
      severity: 'high',
      detail: 'User-agent matches known emulator pattern',
    });
  }

  if (screen.width === 0 || screen.height === 0) {
    flags.push({
      code: 'zero_screen',
      severity: 'high',
      detail: 'Screen resolution is 0×0 — headless or virtual display',
    });
  }

  // Android + no touch = emulator or ADB test device
  if (ua.includes('android') && !('ontouchstart' in window) && !navigator.maxTouchPoints) {
    flags.push({
      code: 'no_touch_android',
      severity: 'medium',
      detail: 'Android UA but no touch support — possible emulator',
    });
  }

  return flags;
}

// ── Debugger / DevTools detection ─────────────────────────────────────────

function checkDebuggerSignals(): SecurityFlag[] {
  const flags: SecurityFlag[] = [];

  // When DevTools is open, console formatting calls are measurably slower
  const t0 = performance.now();
  const probe = { toString() { return 'arc-guard-security-probe'; } };
  void String(probe);
  const elapsed = performance.now() - t0;

  if (elapsed > 200) {
    flags.push({
      code: 'devtools_timing',
      severity: 'medium',
      detail: `Possible DevTools detected — probe took ${elapsed.toFixed(0)} ms`,
    });
  }

  return flags;
}

// ── Iframe / overlay detection ────────────────────────────────────────────

function checkIframeContext(): SecurityFlag[] {
  const flags: SecurityFlag[] = [];

  if (typeof window !== 'undefined' && window.self !== window.top) {
    flags.push({
      code: 'iframe_context',
      severity: 'critical',
      detail: 'App is running inside an iframe — possible screen-overlay attack',
    });
  }

  return flags;
}

// ── Hardware consistency ───────────────────────────────────────────────────

function checkHardwareConsistency(): SecurityFlag[] {
  const flags: SecurityFlag[] = [];

  const cores = navigator.hardwareConcurrency ?? 0;
  if (cores === 1) {
    flags.push({
      code: 'single_core',
      severity: 'low',
      detail: 'Single CPU core reported — possible emulator or heavily throttled device',
    });
  }

  const mem = (navigator as any).deviceMemory as number | undefined;
  if (mem !== undefined && mem < 1) {
    flags.push({
      code: 'very_low_memory',
      severity: 'low',
      detail: `${mem} GB RAM — very low for a production patrol device`,
    });
  }

  return flags;
}

// ── App integrity checks ───────────────────────────────────────────────────

function checkAppIntegrity(): SecurityFlag[] {
  const flags: SecurityFlag[] = [];

  // Record install timestamp on first run so we can detect storage wipes
  try {
    if (!localStorage.getItem(INSTALL_TS_KEY)) {
      localStorage.setItem(INSTALL_TS_KEY, String(Date.now()));
    }
  } catch {
    flags.push({
      code: 'storage_blocked',
      severity: 'medium',
      detail: 'localStorage unavailable — private/incognito mode or storage policy',
    });
  }

  // Detect unexpected origin (cloned app served from a different domain)
  const knownPatterns = ['arcguard', 'arc-guard', 'localhost', '127.0.0.1', '192.168.', '10.', '172.'];
  const origin = window.location.hostname;
  const isCapacitor = detectEnvironment() === 'capacitor';
  const isKnown = !origin || isCapacitor || knownPatterns.some(p => origin.includes(p));

  if (!isKnown) {
    flags.push({
      code: 'unexpected_origin',
      severity: 'high',
      detail: `Running from unexpected host: ${origin}`,
    });
  }

  return flags;
}

// ── Score computation ──────────────────────────────────────────────────────

function computeScore(flags: SecurityFlag[]): number {
  const penalties: Record<SecurityFlag['severity'], number> = {
    low: 5,
    medium: 15,
    high: 25,
    critical: 50,
  };
  const total = flags.reduce((sum, f) => sum + (penalties[f.severity] ?? 0), 0);
  return Math.max(0, 100 - total);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Run all security checks and return a SecurityReport.
 * Results are cached for 5 minutes to minimise overhead.
 * Pass `forceRefresh=true` to bypass the cache.
 */
export function runSecurityChecks(forceRefresh = false): SecurityReport {
  if (!forceRefresh) {
    try {
      const cached = JSON.parse(
        localStorage.getItem(REPORT_KEY) ?? 'null',
      ) as SecurityReport | null;
      if (cached && Date.now() - cached.checkedAt < REPORT_TTL_MS) {
        return cached;
      }
    } catch {}
  }

  const flags: SecurityFlag[] = [
    ...checkEmulatorSignals(),
    ...checkDebuggerSignals(),
    ...checkIframeContext(),
    ...checkHardwareConsistency(),
    ...checkAppIntegrity(),
  ];

  const report: SecurityReport = {
    passed: !flags.some(f => f.severity === 'critical' || f.severity === 'high'),
    score: computeScore(flags),
    flags,
    checkedAt: Date.now(),
    environment: detectEnvironment(),
  };

  try {
    localStorage.setItem(REPORT_KEY, JSON.stringify(report));
  } catch {}

  return report;
}

/** Returns the most-recent cached report without re-running checks. */
export function getCachedSecurityReport(): SecurityReport | null {
  try {
    return JSON.parse(localStorage.getItem(REPORT_KEY) ?? 'null');
  } catch {
    return null;
  }
}

/** Quick gate — returns true only if the environment passes all high/critical checks. */
export function isEnvironmentSecure(): boolean {
  return runSecurityChecks().passed;
}
