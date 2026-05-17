/**
 * deviceIp.ts — detect the device's local LAN IP address.
 *
 * Uses the WebRTC ICE candidate trick: creating a local peer connection
 * forces the browser/WebView to enumerate local network interfaces and
 * expose their IP addresses in the SDP offer / ICE candidates.
 *
 * Works in:
 *   - Chrome / Android WebView (Capacitor APK) ✅
 *   - Firefox ✅
 *   - Safari (partial — may need getUserMedia fallback)
 *
 * Falls back to window.location.hostname when WebRTC is unavailable
 * (which works in dev mode when the app is served from the LAN).
 */

let _cachedIp: string | null = null;
let _cacheTs = 0;
const CACHE_MS = 30_000;

/**
 * Returns the best local LAN IPv4 address for this device,
 * or null if it cannot be determined.
 */
export async function getLocalIp(): Promise<string | null> {
  if (_cachedIp && Date.now() - _cacheTs < CACHE_MS) return _cachedIp;

  try {
    const ip = await detectViaWebRtc();
    if (ip) {
      _cachedIp = ip;
      _cacheTs  = Date.now();
      return ip;
    }
  } catch {
    // WebRTC not available — fall through
  }

  // Dev fallback: hostname may already be a LAN IP (e.g. 192.168.x.x)
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) && !h.startsWith("127.")) {
      _cachedIp = h;
      _cacheTs  = Date.now();
      return h;
    }
  }

  return null;
}

/** Invalidate the cache so the next call re-detects. */
export function clearLocalIpCache(): void {
  _cachedIp = null;
  _cacheTs  = 0;
}

// ── WebRTC ICE trick ──────────────────────────────────────────────────────────

function detectViaWebRtc(): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof RTCPeerConnection === "undefined") { resolve(null); return; }

    const ips   = new Set<string>();
    const pc    = new RTCPeerConnection({ iceServers: [] });
    let   done  = false;

    const finish = (best: string | null) => {
      if (done) return;
      done = true;
      try { pc.close(); } catch { /* ignore */ }
      resolve(best);
    };

    // Create a dummy data channel to trigger ICE gathering
    pc.createDataChannel("");

    pc.onicecandidate = (evt) => {
      if (!evt.candidate) {
        // Gathering complete
        finish(pickBest(ips));
        return;
      }

      const candidate = evt.candidate.candidate;
      // ICE candidate format:
      //   candidate:... typ host ... 192.168.x.x ...
      const match = /\b(\d{1,3}(?:\.\d{1,3}){3})\b/.exec(candidate);
      if (match) ips.add(match[1]);
    };

    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => finish(null));

    // Timeout safety — some browsers never fire null candidate
    setTimeout(() => finish(pickBest(ips)), 3_000);
  });
}

function pickBest(ips: Set<string>): string | null {
  // Prefer 192.168.x.x, then 10.x.x.x, then 172.16-31.x.x
  // Exclude loopback (127.x) and link-local (169.254.x)
  const candidates = [...ips].filter(
    (ip) => !ip.startsWith("127.") && !ip.startsWith("169.254.")
  );

  return (
    candidates.find((ip) => ip.startsWith("192.168.")) ??
    candidates.find((ip) => ip.startsWith("10."))      ??
    candidates.find((ip) => /^172\.(1[6-9]|2\d|3[01])\./.test(ip)) ??
    candidates[0] ??
    null
  );
}
