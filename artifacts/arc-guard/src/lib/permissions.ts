/**
 * Camera and GPS permission management
 * Works in both demo mode and Firebase mode.
 * Always request from user explicitly before use — no silent fallbacks.
 */

export type PermState = "granted" | "denied" | "prompt" | "unsupported";

// ── Camera ────────────────────────────────────────────────────────────────────

export async function getCameraPermission(): Promise<PermState> {
  if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
  try {
    const result = await navigator.permissions.query({ name: "camera" as PermissionName });
    return result.state as PermState;
  } catch {
    return "prompt"; // permissions API not supported — assume prompt
  }
}

export async function requestCameraPermission(): Promise<PermState> {
  if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    stream.getTracks().forEach((t) => t.stop()); // stop immediately — just checking
    return "granted";
  } catch (err) {
    if (err instanceof DOMException) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") return "denied";
      if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") return "unsupported";
    }
    return "denied";
  }
}

// ── GPS / Geolocation ─────────────────────────────────────────────────────────

export async function getGpsPermission(): Promise<PermState> {
  if (!navigator.geolocation) return "unsupported";
  try {
    const result = await navigator.permissions.query({ name: "geolocation" });
    return result.state as PermState;
  } catch {
    return "prompt";
  }
}

export async function requestGpsPermission(): Promise<PermState> {
  if (!navigator.geolocation) return "unsupported";
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve("granted"),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) resolve("denied");
        else resolve("prompt"); // timeout / unavailable — still possibly grantable
      },
      { timeout: 8000, enableHighAccuracy: false },
    );
  });
}

// ── Combined check ─────────────────────────────────────────────────────────────

export interface PatrolPermissions {
  camera: PermState;
  gps: PermState;
}

export async function checkPatrolPermissions(): Promise<PatrolPermissions> {
  const [camera, gps] = await Promise.all([getCameraPermission(), getGpsPermission()]);
  return { camera, gps };
}

export async function requestPatrolPermissions(): Promise<PatrolPermissions> {
  // GPS first (less scary), then camera
  const gps = await requestGpsPermission();
  const camera = await requestCameraPermission();
  return { camera, gps };
}

export function permissionsReady(p: PatrolPermissions): boolean {
  // GPS required. Camera required for QR scanning.
  // "unsupported" counts as ready (fallback modes will handle it)
  const camOk = p.camera === "granted" || p.camera === "unsupported";
  const gpsOk = p.gps === "granted" || p.gps === "unsupported";
  return camOk && gpsOk;
}
