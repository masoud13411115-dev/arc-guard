/**
 * deviceBinding.ts — Device fingerprinting and binding for ARC Guard.
 *
 * Generates a stable, anonymous SHA-256 device fingerprint from browser APIs
 * (canvas, WebGL, hardware, locale). Binds guard accounts to known devices
 * so managers can detect and alert on logins from new/unexpected devices.
 *
 * Security model:
 *   - Fingerprint is a SHA-256 hash — no PII stored
 *   - First login: fingerprint saved to Firestore + marked "new device"
 *   - Subsequent logins from same device: silent match
 *   - New device: flagged in BindingResult; caller decides how to alert
 *   - Manager can reset bindings (clearDeviceBindings)
 *   - Max MAX_BOUND_DEVICES per guard to limit undetected multi-device sharing
 */

import { db } from '@/firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';

const FP_CACHE_KEY = 'arc_guard_device_fp';
const MAX_BOUND_DEVICES = 3;

// ── Fingerprint components ─────────────────────────────────────────────────

async function canvasFingerprint(): Promise<string> {
  try {
    const c = document.createElement('canvas');
    c.width = 220;
    c.height = 60;
    const ctx = c.getContext('2d');
    if (!ctx) return 'no-canvas';
    ctx.fillStyle = '#f0f4f8';
    ctx.fillRect(0, 0, 220, 60);
    ctx.fillStyle = '#0a2540';
    ctx.font = 'bold 11px "Arial", sans-serif';
    ctx.fillText('ARC Guard \u00B7 Device Sentinel', 6, 20);
    ctx.fillStyle = 'rgba(59,130,246,0.75)';
    ctx.beginPath();
    ctx.arc(195, 30, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 30, 120, 22);
    // Vary per font rendering engine
    ctx.fillStyle = 'rgba(0,128,0,0.5)';
    ctx.font = 'italic 10px "Times New Roman", serif';
    ctx.fillText('0123456789 \u0627\u0628\u062a\u062b', 6, 52);
    return c.toDataURL('image/png');
  } catch {
    return 'canvas-error';
  }
}

function webglFingerprint(): string {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl') ??
      c.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'no-webgl';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      return [
        gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string,
        gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string,
      ].join('|');
    }
    return (gl.getParameter(gl.RENDERER) as string | null) ?? 'unknown-renderer';
  } catch {
    return 'webgl-error';
  }
}

async function collectComponents(): Promise<string[]> {
  return [
    await canvasFingerprint(),
    webglFingerprint(),
    String(navigator.hardwareConcurrency ?? 0),
    String((navigator as any).deviceMemory ?? 0),
    navigator.platform ?? '',
    navigator.language ?? '',
    navigator.languages?.join(',') ?? '',
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    Intl.DateTimeFormat().resolvedOptions().locale,
    navigator.userAgent,
  ];
}

async function hashComponents(parts: string[]): Promise<string> {
  const raw = parts.join('\x00');
  const buf = new TextEncoder().encode(raw);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compute a stable device fingerprint (SHA-256 hex, 64 chars).
 * Cached in localStorage — recomputes only if cache is missing.
 */
export async function computeDeviceFingerprint(): Promise<string> {
  try {
    const cached = localStorage.getItem(FP_CACHE_KEY);
    if (cached && cached.length === 64) return cached;
  } catch {}

  const parts = await collectComponents();
  const fp = await hashComponents(parts);

  try { localStorage.setItem(FP_CACHE_KEY, fp); } catch {}
  return fp;
}

/** Invalidate the cached fingerprint (e.g. after a storage wipe). */
export function clearFingerprintCache(): void {
  try { localStorage.removeItem(FP_CACHE_KEY); } catch {}
}

// ── Firestore binding ──────────────────────────────────────────────────────

export interface DeviceRecord {
  fingerprint: string;
  firstSeenAt: number;
  lastSeenAt: number;
  /** Truncated UA for manager display — no PII beyond platform/browser string */
  userAgent: string;
}

interface BindingDoc {
  boundDevices: DeviceRecord[];
  primaryFingerprint: string;
  updatedAt: number;
}

function bindingRef(companyId: string, uid: string) {
  return doc(db!, 'companies', companyId, 'deviceBindings', uid);
}

export interface BindingResult {
  fingerprint: string;
  isFirstDevice: boolean;
  isKnownDevice: boolean;
  isNewDevice: boolean;
  deviceCount: number;
  exceededLimit: boolean;
}

/**
 * Check and record the current device fingerprint for a guard.
 * Call after successful guard login.
 * Fails open (returns isKnownDevice=true) if Firestore is unavailable.
 */
export async function checkAndBindDevice(
  companyId: string,
  uid: string,
): Promise<BindingResult> {
  const fingerprint = await computeDeviceFingerprint();

  if (!db) {
    return {
      fingerprint,
      isFirstDevice: false,
      isKnownDevice: true,
      isNewDevice: false,
      deviceCount: 1,
      exceededLimit: false,
    };
  }

  try {
    const ref = bindingRef(companyId, uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      const record: DeviceRecord = {
        fingerprint,
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now(),
        userAgent: navigator.userAgent.slice(0, 200),
      };
      const binding: BindingDoc = {
        boundDevices: [record],
        primaryFingerprint: fingerprint,
        updatedAt: Date.now(),
      };
      await setDoc(ref, binding);
      return {
        fingerprint,
        isFirstDevice: true,
        isKnownDevice: false,
        isNewDevice: true,
        deviceCount: 1,
        exceededLimit: false,
      };
    }

    const data = snap.data() as BindingDoc;
    const devices: DeviceRecord[] = data.boundDevices ?? [];
    const existing = devices.find(d => d.fingerprint === fingerprint);

    if (existing) {
      const updated = devices.map(d =>
        d.fingerprint === fingerprint ? { ...d, lastSeenAt: Date.now() } : d,
      );
      await updateDoc(ref, { boundDevices: updated, updatedAt: Date.now() });
      return {
        fingerprint,
        isFirstDevice: false,
        isKnownDevice: true,
        isNewDevice: false,
        deviceCount: devices.length,
        exceededLimit: false,
      };
    }

    // New device
    const exceeded = devices.length >= MAX_BOUND_DEVICES;
    const newRecord: DeviceRecord = {
      fingerprint,
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
      userAgent: navigator.userAgent.slice(0, 200),
    };

    if (!exceeded) {
      await updateDoc(ref, {
        boundDevices: arrayUnion(newRecord),
        updatedAt: Date.now(),
      });
    }

    return {
      fingerprint,
      isFirstDevice: false,
      isKnownDevice: false,
      isNewDevice: true,
      deviceCount: devices.length + (exceeded ? 0 : 1),
      exceededLimit: exceeded,
    };
  } catch {
    // Fail open — do not block guard if Firestore is temporarily unavailable
    return {
      fingerprint,
      isFirstDevice: false,
      isKnownDevice: true,
      isNewDevice: false,
      deviceCount: 1,
      exceededLimit: false,
    };
  }
}

/**
 * Retrieve all bound device records for a guard.
 * Used by Manager dashboard for security audit.
 */
export async function getGuardDevices(
  companyId: string,
  uid: string,
): Promise<DeviceRecord[]> {
  if (!db) return [];
  try {
    const snap = await getDoc(bindingRef(companyId, uid));
    if (!snap.exists()) return [];
    return (snap.data() as BindingDoc).boundDevices ?? [];
  } catch {
    return [];
  }
}

/**
 * Remove all device bindings for a guard (manager action).
 * Guard will be treated as "first device" on next login.
 */
export async function clearDeviceBindings(
  companyId: string,
  uid: string,
): Promise<void> {
  if (!db) return;
  await setDoc(bindingRef(companyId, uid), {
    boundDevices: [],
    primaryFingerprint: '',
    updatedAt: Date.now(),
  });
  clearFingerprintCache();
}
