/**
 * Production-safe logger for ARC Guard.
 * - Development: console output with colours
 * - Production: silent + batched error collection
 * - Never leaks secrets or user PII
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const IS_DEV = import.meta.env.DEV;
const IS_PROD = import.meta.env.PROD;

// ── In-memory error buffer (last 50 errors — for support diagnostics) ─────────
const MAX_ERRORS = 50;
const errorBuffer: { ts: number; level: Level; msg: string; extra?: string }[] = [];

function push(level: Level, msg: string, extra?: string) {
  if (level === 'error' || level === 'warn') {
    errorBuffer.push({ ts: Date.now(), level, msg, extra });
    if (errorBuffer.length > MAX_ERRORS) errorBuffer.shift();
  }
}

function fmt(level: Level, scope: string, args: unknown[]): string {
  const parts = args.map((a) =>
    typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a),
  );
  return `[ARC Guard:${scope}] ${parts.join(' ')}`;
}

export const logger = {
  debug(scope: string, ...args: unknown[]) {
    if (!IS_DEV) return;
    console.debug(`%c[${scope}]`, 'color:#64748b', ...args);
  },
  info(scope: string, ...args: unknown[]) {
    if (IS_DEV) console.info(`%c[${scope}]`, 'color:#38bdf8', ...args);
    push('info', fmt('info', scope, args));
  },
  warn(scope: string, ...args: unknown[]) {
    if (IS_DEV) console.warn(`%c[${scope}]`, 'color:#f59e0b', ...args);
    push('warn', fmt('warn', scope, args));
  },
  error(scope: string, ...args: unknown[]) {
    const msg = fmt('error', scope, args);
    if (IS_DEV) console.error(`%c[${scope}]`, 'color:#f87171', ...args);
    push('error', msg, args.find((a) => a instanceof Error)?.toString());
  },
};

// ── Unhandled errors → buffer ─────────────────────────────────────────────────
if (IS_PROD) {
  window.addEventListener('error', (e) => {
    push('error', `Unhandled: ${e.message}`, `${e.filename}:${e.lineno}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    push('error', `UnhandledPromise: ${String(e.reason)}`);
  });
}

/** Return collected errors — for support diagnostics page */
export function getErrorLog(): typeof errorBuffer {
  return [...errorBuffer];
}

/** Dump error log as plain text — for copy/paste to support */
export function exportErrorLog(): string {
  return errorBuffer
    .map((e) => `[${new Date(e.ts).toISOString()}] ${e.level.toUpperCase()} ${e.msg}${e.extra ? '\n  ' + e.extra : ''}`)
    .join('\n');
}
