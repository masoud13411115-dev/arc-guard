import { useState, useEffect, useRef, useCallback } from "react";
import {
  QrCode, MapPin, CheckCircle, AlertTriangle, XCircle,
  Shield, LogOut, Wifi, WifiOff, Clock, Camera,
  PhoneOff, Loader2,
} from "lucide-react";
import { haversineDistance } from "@/lib/gps";
import { addToQueue, getQueueCount } from "@/lib/offline";
import { savePatrolLog, updateGuardSession, subscribeCheckpoints, syncOfflineQueue, saveAlert } from "@/lib/firestore";
import { playSuccess, playOutside, playFail, playCooldown, playEmergency } from "@/lib/audioFeedback";
import { isValidQrFormat, parseQrCode, canScan, recordScan, secondsUntilNextScan, formatCountdown } from "@/lib/scanProtection";
import { db } from "@/firebase";
import type { Checkpoint, PatrolLog, GpsCoords, ScanStatus } from "@/types";

interface GuardPatrolProps {
  guardId: string;
  guardName: string;
  companyId: string;
  onLogout: () => void;
}

type ScanPhase = "idle" | "scanning" | "result";

type ScanResult = {
  ok: boolean;
  status: ScanStatus | "cooldown" | "failed";
  title: string;
  msg: string;
  checkpoint?: string;
  distance?: number;
};

const SOS_HOLD_MS = 3000;

export default function GuardPatrol({ guardId, guardName, companyId, onLogout }: GuardPatrolProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [gps, setGps] = useState<GpsCoords | null>(null);
  const [gpsError, setGpsError] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(getQueueCount());
  const [recentLogs, setRecentLogs] = useState<PatrolLog[]>([]);
  const [scanPhase, setScanPhase] = useState<ScanPhase>("idle");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [syncing, setSyncing] = useState(false);

  // SOS
  const [sosHolding, setSosHolding] = useState(false);
  const [sosProgress, setSosProgress] = useState(0);
  const [sosSent, setSosSent] = useState(false);
  const [sosSending, setSosSending] = useState(false);

  const scannerRef = useRef<any>(null);
  const sosTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sosStartRef = useRef(0);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── GPS watch (continuous, auto-update) ────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) { setGpsError(true); return; }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const coords: GpsCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setGps(coords);
        setGpsError(false);
        if (db) {
          updateGuardSession({
            guardId, guardName, companyId,
            lastSeen: Date.now(),
            lastCheckpoint: recentLogs[0]?.checkpointName ?? "—",
            lastGps: coords,
            status: "active",
          });
        }
      },
      () => setGpsError(true),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [guardId, guardName, companyId, recentLogs]);

  // ── Load checkpoints ────────────────────────────────────────────────────────
  useEffect(() => subscribeCheckpoints(
    companyId,
    setCheckpoints,
    (err) => console.error("[GuardPatrol] checkpoints:", err.message),
  ), [companyId]);

  // ── Online/offline + auto-sync ──────────────────────────────────────────────
  const doSync = useCallback(async () => {
    if (!online || !db) return;
    setSyncing(true);
    await syncOfflineQueue();
    setQueueCount(getQueueCount());
    setSyncing(false);
  }, [online]);

  useEffect(() => {
    const onOnline  = () => { setOnline(true);  doSync(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [doSync]);

  // ── Scanner ─────────────────────────────────────────────────────────────────
  const startScanner = useCallback(async () => {
    setScanPhase("scanning");
    setScanResult(null);
    // Scanner div needs a tick to render before we attach
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode("qr-reader-guard");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 12, qrbox: { width: 260, height: 260 } },
          (text: string) => handleQrScan(text),
          () => {},
        );
      } catch {
        setScanPhase("idle");
        showResult({
          ok: false, status: "failed",
          title: "دسترسی به دوربین رد شد",
          msg: "لطفاً دسترسی دوربین را در تنظیمات مرورگر فعال کنید.",
        });
        playFail();
      }
    }, 80);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      }
    } catch {}
    scannerRef.current = null;
  }, []);

  // ── QR processing ───────────────────────────────────────────────────────────
  const handleQrScan = useCallback(async (qrText: string) => {
    await stopScanner();
    setScanPhase("result");

    // Unknown format
    if (!isValidQrFormat(qrText)) {
      showResult({
        ok: false, status: "failed",
        title: "این QR در سیستم تعریف نشده است",
        msg: "کد QR توسط ARC Guard صادر نشده. با مدیر تماس بگیرید.",
      });
      playFail();
      persistLog(buildLog(qrText, null, null, null, false, "failed"));
      return;
    }

    // Parse QR
    const parsed = parseQrCode(qrText);
    let checkpoint: Checkpoint | null = null;

    if (parsed) {
      const { companyId: qrCid, checkpointId: qrCpId } = parsed;
      if (qrCid !== companyId) {
        showResult({
          ok: false, status: "failed",
          title: "این QR در سیستم تعریف نشده است",
          msg: "این ایستگاه متعلق به شرکت دیگری است.",
        });
        playFail();
        return;
      }
      checkpoint = checkpoints.find((c) => c.id === qrCpId) ?? null;
    } else {
      checkpoint = checkpoints.find((c) => c.qrCode === qrText) ?? null;
    }

    if (!checkpoint) {
      showResult({
        ok: false, status: "failed",
        title: "این QR در سیستم تعریف نشده است",
        msg: checkpoints.length === 0
          ? "لیست ایستگاه‌ها هنوز بارگذاری نشده. اینترنت را بررسی کنید."
          : "ایستگاه در سیستم پیدا نشد. با مدیر تماس بگیرید.",
      });
      playFail();
      persistLog(buildLog(qrText, null, null, null, false, "failed"));
      return;
    }

    // Cooldown check
    if (!canScan(checkpoint.id)) {
      const secs = secondsUntilNextScan(checkpoint.id);
      showResult({
        ok: false, status: "cooldown",
        title: "اسکن مجدد زود است",
        msg: `ایستگاه "${checkpoint.name}" تا ${formatCountdown(secs)} دقیقه دیگر قابل اسکن است.`,
        checkpoint: checkpoint.name,
      });
      playCooldown();
      return;
    }

    // GPS check
    if (!gps) {
      showResult({
        ok: false, status: "failed",
        title: "موقعیت GPS دریافت نشد",
        msg: "GPS دستگاه را فعال کرده و مجدداً اسکن کنید.",
        checkpoint: checkpoint.name,
      });
      playFail();
      return;
    }

    // Distance check
    const distance = Math.round(haversineDistance(gps.lat, gps.lng, checkpoint.lat, checkpoint.lng));
    const withinRadius = distance <= checkpoint.radiusMeters;
    const status: ScanStatus = withinRadius ? "valid" : "outside";
    const log = buildLog(qrText, checkpoint, gps, distance, withinRadius, status);

    recordScan(checkpoint.id);
    setRecentLogs((prev) => [log, ...prev.slice(0, 4)]);

    if (withinRadius) {
      showResult({
        ok: true, status: "valid",
        title: "ایستگاه تأیید شد",
        msg: `فاصله: ${distance} متر · دقت GPS: ±${Math.round(gps.accuracy)} متر`,
        checkpoint: checkpoint.name,
        distance,
      });
      playSuccess();
      if (db) {
        updateGuardSession({
          guardId, guardName, companyId,
          lastSeen: Date.now(), lastCheckpoint: checkpoint.name,
          lastGps: gps, status: "active",
        });
      }
    } else {
      showResult({
        ok: false, status: "outside",
        title: "شما خارج از محدوده ایستگاه هستید",
        msg: `فاصله شما ${distance} متر است. حداکثر مجاز: ${checkpoint.radiusMeters} متر.`,
        checkpoint: checkpoint.name,
        distance,
      });
      playOutside();
    }

    persistLog(log);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkpoints, gps, companyId, guardId, guardName]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const showResult = (result: ScanResult) => {
    setScanResult(result);
    setScanPhase("result");
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    resultTimerRef.current = setTimeout(() => {
      setScanPhase("idle");
      setScanResult(null);
    }, 4500);
  };

  const dismissResult = () => {
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    setScanPhase("idle");
    setScanResult(null);
  };

  const buildLog = (
    qrText: string,
    checkpoint: Checkpoint | null,
    gpsVal: GpsCoords | null,
    distance: number | null,
    withinRadius: boolean,
    status: ScanStatus,
  ): PatrolLog => ({
    guardId, guardName, companyId,
    checkpointId:   checkpoint?.id   ?? "unknown",
    checkpointName: checkpoint?.name ?? "ناشناس",
    qrScanned: qrText,
    gps: gpsVal,
    distanceMeters: distance,
    withinRadius, status,
    scanTime: Date.now(),
    scannedAt: Date.now(),
    scannedAtText: new Date().toLocaleTimeString("fa-IR"),
    synced: false,
  });

  const persistLog = (log: PatrolLog) => {
    if (online && db) {
      savePatrolLog({ ...log, synced: true }).catch(() => {
        addToQueue(log);
        setQueueCount(getQueueCount());
      });
    } else {
      addToQueue(log);
      setQueueCount(getQueueCount());
    }
  };

  // ── Next checkpoint (most overdue or soonest due) ──────────────────────────
  const nextCheckpoint = (() => {
    if (checkpoints.length === 0) return null;
    const now = Date.now();
    let best: { cp: Checkpoint; overdue: boolean; secsLeft: number } | null = null;
    for (const cp of checkpoints) {
      const lastLog = recentLogs.find((l) => l.checkpointId === cp.id);
      const intervalMs = (cp.patrolIntervalMinutes ?? 120) * 60_000;
      const nextAt = lastLog ? lastLog.scannedAt + intervalMs : now - 1;
      const secsLeft = Math.ceil((nextAt - now) / 1000);
      const overdue = secsLeft <= 0;
      if (!best) { best = { cp, overdue, secsLeft }; continue; }
      if (overdue && !best.overdue) { best = { cp, overdue, secsLeft }; continue; }
      if (overdue && best.overdue && secsLeft < best.secsLeft) { best = { cp, overdue, secsLeft }; continue; }
      if (!overdue && !best.overdue && secsLeft < best.secsLeft) { best = { cp, overdue, secsLeft }; }
    }
    return best;
  })();

  // ── SOS hold logic ─────────────────────────────────────────────────────────
  const startSosHold = () => {
    if (sosSent || sosSending) return;
    setSosHolding(true);
    setSosProgress(0);
    sosStartRef.current = Date.now();
    sosTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - sosStartRef.current;
      const pct = Math.min(100, (elapsed / SOS_HOLD_MS) * 100);
      setSosProgress(pct);
      if (elapsed >= SOS_HOLD_MS) {
        clearInterval(sosTimerRef.current!);
        triggerSos();
      }
    }, 30);
  };

  const cancelSosHold = () => {
    if (sosTimerRef.current) clearInterval(sosTimerRef.current);
    setSosHolding(false);
    setSosProgress(0);
  };

  const triggerSos = async () => {
    setSosHolding(false);
    setSosProgress(0);
    setSosSending(true);
    playEmergency();
    if (db) {
      try {
        await saveAlert({
          kind: "sos", guardId, guardName, gps: gps ?? undefined,
          alertedAt: Date.now(), companyId, resolved: false,
          message: "اضطراری توسط نگهبان فعال شد",
        });
      } catch {}
    }
    setSosSending(false);
    setSosSent(true);
    setTimeout(() => setSosSent(false), 15_000);
  };

  // ── Status chips ────────────────────────────────────────────────────────────
  const gpsAccuracy = gps ? Math.round(gps.accuracy) : null;
  const gpsChipColor = gpsAccuracy === null
    ? "bg-muted text-muted-foreground"
    : gpsAccuracy <= 10 ? "bg-green-500/15 text-green-400 border-green-500/30"
    : gpsAccuracy <= 30 ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
    : "bg-red-500/15 text-red-400 border-red-500/30";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background arc-grid-bg flex flex-col select-none" dir="rtl">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-none">{guardName}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">نگهبان</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Online indicator */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium ${
            online ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}>
            {online
              ? <><Wifi className="w-3 h-3" />آنلاین</>
              : <><WifiOff className="w-3 h-3" />آفلاین</>}
          </div>
          <button onClick={onLogout}
            className="w-8 h-8 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Status bar ── */}
      <div className="flex items-center gap-2 px-4 pb-4">
        {/* GPS chip */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium ${gpsChipColor}`}>
          <MapPin className="w-3 h-3" />
          {gpsError ? "GPS خطا" : gpsAccuracy === null ? "GPS..." : `دقت ±${gpsAccuracy}م`}
        </div>
        {/* Offline queue chip */}
        {queueCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-yellow-500/10 border-yellow-500/30 text-yellow-400 text-[11px] font-medium">
            <Clock className="w-3 h-3" />
            {queueCount} در انتظار ارسال
            {online && (
              <button onClick={doSync} disabled={syncing} className="mr-1 opacity-70 hover:opacity-100">
                {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : "ارسال"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col items-center px-4 gap-5">

        {/* ── BIG SCAN BUTTON ── */}
        <div className="flex flex-col items-center gap-3 mt-2">
          <button
            onClick={startScanner}
            disabled={scanPhase !== "idle"}
            className="w-44 h-44 rounded-full bg-primary/10 border-4 border-primary/40 flex flex-col items-center justify-center gap-3
              hover:bg-primary/20 hover:border-primary/60 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-150 shadow-[0_0_40px_rgba(14,165,233,0.15)]"
            style={{ touchAction: "manipulation" }}
          >
            <QrCode className="w-16 h-16 text-primary" />
            <span className="text-base font-bold text-primary">اسکن ایستگاه</span>
          </button>
          <p className="text-xs text-muted-foreground">برای اسکن کد QR ایستگاه بزنید</p>
        </div>

        {/* ── Next checkpoint card ── */}
        {nextCheckpoint && (
          <div className={`w-full max-w-sm rounded-2xl border p-4 ${
            nextCheckpoint.overdue
              ? "border-orange-500/40 bg-orange-500/[0.07]"
              : "border-border bg-card/60"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  nextCheckpoint.overdue ? "bg-orange-500/20" : "bg-muted"
                }`}>
                  <MapPin className={`w-4 h-4 ${nextCheckpoint.overdue ? "text-orange-400" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{nextCheckpoint.overdue ? "⚠ زمان سر رسیده" : "ایستگاه بعدی"}</p>
                  <p className={`text-sm font-bold ${nextCheckpoint.overdue ? "text-orange-400" : "text-foreground"}`}>
                    {nextCheckpoint.cp.name}
                  </p>
                </div>
              </div>
              {!nextCheckpoint.overdue && nextCheckpoint.secsLeft > 0 && (
                <span className="text-xs text-muted-foreground font-mono">
                  {Math.ceil(nextCheckpoint.secsLeft / 60)} د
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── SOS button ── */}
        <div className="w-full max-w-sm">
          {sosSent ? (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 py-4 flex items-center justify-center gap-2">
              <PhoneOff className="w-5 h-5 text-red-400" />
              <span className="text-sm font-bold text-red-400">اضطراری ارسال شد — مدیر مطلع شد</span>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden">
              {/* Progress fill */}
              {sosHolding && (
                <div
                  className="absolute inset-0 bg-red-500/30 rounded-2xl transition-none"
                  style={{ width: `${sosProgress}%` }}
                />
              )}
              <button
                onPointerDown={startSosHold}
                onPointerUp={cancelSosHold}
                onPointerLeave={cancelSosHold}
                onContextMenu={(e) => e.preventDefault()}
                disabled={sosSending}
                className="relative w-full py-4 rounded-2xl border border-red-500/40 bg-red-500/[0.07]
                  flex items-center justify-center gap-2 select-none touch-none
                  active:bg-red-500/20 transition-colors"
                style={{ touchAction: "none" }}
              >
                <PhoneOff className="w-5 h-5 text-red-400" />
                <span className="text-sm font-bold text-red-400">
                  {sosSending ? "در حال ارسال..." : sosHolding ? "نگه دارید..." : "SOS اضطراری — نگه دارید"}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* ── Recent scans ── */}
        {recentLogs.length > 0 && (
          <div className="w-full max-w-sm pb-6">
            <p className="text-xs text-muted-foreground mb-2 px-1">اسکن‌های اخیر</p>
            <div className="space-y-2">
              {recentLogs.map((log, i) => (
                <div key={i} className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
                  log.status === "valid"
                    ? "border-green-500/25 bg-green-500/[0.06]"
                    : log.status === "outside"
                    ? "border-orange-500/25 bg-orange-500/[0.06]"
                    : "border-red-500/25 bg-red-500/[0.06]"
                }`}>
                  {log.status === "valid"
                    ? <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                    : log.status === "outside"
                    ? <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
                    : <XCircle className="w-5 h-5 text-red-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{log.checkpointName}</p>
                    {log.distanceMeters !== null && (
                      <p className="text-[11px] text-muted-foreground">{log.distanceMeters} متر</p>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono shrink-0">{log.scannedAtText}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── QR Scanner overlay ── */}
      {scanPhase === "scanning" && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" dir="rtl">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-4 bg-black/80">
            <button
              onClick={async () => { await stopScanner(); setScanPhase("idle"); }}
              className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm"
            >
              <XCircle className="w-5 h-5" />
              لغو
            </button>
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <Camera className="w-4 h-4" />
              <span>کد QR ایستگاه را اسکن کنید</span>
            </div>
          </div>

          {/* Camera view */}
          <div className="flex-1 flex items-center justify-center bg-black">
            <div
              id="qr-reader-guard"
              style={{ width: "100%", maxWidth: 380, background: "white" }}
            />
          </div>

          {/* Bottom hint */}
          <div className="px-4 py-5 bg-black/80 flex items-center justify-center">
            <p className="text-white/50 text-sm text-center">
              دوربین را روی کد QR روی تابلوی ایستگاه بگیرید
            </p>
          </div>
        </div>
      )}

      {/* ── Scan Result overlay ── */}
      {scanPhase === "result" && scanResult && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
          style={{
            background: scanResult.ok
              ? "radial-gradient(ellipse at center, rgba(34,197,94,0.15) 0%, rgba(0,0,0,0.92) 70%)"
              : scanResult.status === "outside"
              ? "radial-gradient(ellipse at center, rgba(249,115,22,0.15) 0%, rgba(0,0,0,0.92) 70%)"
              : "radial-gradient(ellipse at center, rgba(239,68,68,0.15) 0%, rgba(0,0,0,0.92) 70%)",
          }}
          onClick={dismissResult}
        >
          {/* Icon */}
          <div className={`w-28 h-28 rounded-full flex items-center justify-center mb-6 ${
            scanResult.ok
              ? "bg-green-500/20 border-2 border-green-500/40"
              : scanResult.status === "outside"
              ? "bg-orange-500/20 border-2 border-orange-500/40"
              : "bg-red-500/20 border-2 border-red-500/40"
          }`}>
            {scanResult.ok
              ? <CheckCircle className="w-16 h-16 text-green-400" />
              : scanResult.status === "outside"
              ? <AlertTriangle className="w-16 h-16 text-orange-400" />
              : <XCircle className="w-16 h-16 text-red-400" />}
          </div>

          {/* Checkpoint name */}
          {scanResult.checkpoint && (
            <p className="text-lg font-bold text-white mb-1">{scanResult.checkpoint}</p>
          )}

          {/* Title */}
          <p className={`text-base font-bold mb-2 text-center ${
            scanResult.ok ? "text-green-400"
              : scanResult.status === "outside" ? "text-orange-400"
              : "text-red-400"
          }`}>
            {scanResult.title}
          </p>

          {/* Detail */}
          <p className="text-sm text-white/60 text-center leading-relaxed max-w-xs">
            {scanResult.msg}
          </p>

          <p className="text-xs text-white/30 mt-8">برای بستن بزنید</p>
        </div>
      )}
    </div>
  );
}
