// Web Audio API — no external deps, no network needed

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return ctx;
  } catch { return null; }
}

function beep(
  frequency: number,
  duration: number,
  gainVal: number,
  type: OscillatorType,
  delay = 0,
  ac: AudioContext
) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ac.currentTime + delay);
  gain.gain.setValueAtTime(gainVal, ac.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + duration);
  osc.start(ac.currentTime + delay);
  osc.stop(ac.currentTime + delay + duration + 0.01);
}

function vibrate(pattern: number[]) {
  try { navigator.vibrate?.(pattern); } catch {}
}

/** ✓ Short high-pitched double-beep — scan success */
export function playSuccess() {
  const ac = getCtx();
  if (!ac) return;
  beep(880, 0.12, 0.4, "sine", 0, ac);
  beep(1100, 0.18, 0.35, "sine", 0.13, ac);
  vibrate([60, 30, 60]);
}

/** ⚠ Warning tone — outside radius */
export function playOutside() {
  const ac = getCtx();
  if (!ac) return;
  beep(440, 0.25, 0.35, "triangle", 0, ac);
  beep(380, 0.35, 0.3, "triangle", 0.27, ac);
  vibrate([80, 40, 80, 40, 80]);
}

/** ✗ Low descending buzz — scan failed / unknown QR */
export function playFail() {
  const ac = getCtx();
  if (!ac) return;
  beep(300, 0.15, 0.4, "sawtooth", 0, ac);
  beep(200, 0.3, 0.35, "sawtooth", 0.17, ac);
  vibrate([120, 60, 120]);
}

/** 🔒 Blocked — cooldown still active */
export function playCooldown() {
  const ac = getCtx();
  if (!ac) return;
  beep(520, 0.08, 0.25, "square", 0, ac);
  beep(520, 0.08, 0.25, "square", 0.1, ac);
  beep(520, 0.08, 0.25, "square", 0.2, ac);
  vibrate([40, 20, 40, 20, 40]);
}

/** 🚨 SOS / Emergency — rapid urgent alarm */
export function playEmergency() {
  const ac = getCtx();
  if (!ac) return;
  for (let i = 0; i < 6; i++) {
    beep(1400, 0.14, 0.7, "square", i * 0.22, ac);
    beep(900, 0.1, 0.6, "square", i * 0.22 + 0.14, ac);
  }
  vibrate([300, 100, 300, 100, 300, 100, 500]);
}

/** ⚡ Missed checkpoint — medium urgency */
export function playMissed() {
  const ac = getCtx();
  if (!ac) return;
  beep(600, 0.2, 0.4, "triangle", 0, ac);
  beep(500, 0.2, 0.4, "triangle", 0.25, ac);
  beep(400, 0.3, 0.35, "triangle", 0.5, ac);
  vibrate([150, 80, 150, 80, 150]);
}
