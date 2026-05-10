import { useState, useEffect, useRef, useCallback } from "react";
import {
  QrCode, MapPin, Wifi, WifiOff, CheckCircle, AlertTriangle,
  Shield, LogOut, RefreshCw, Camera, XCircle, Clock,
  Lock, Zap, Radio, Mic
} from "lucide-react";
import {
  checkPatrolPermissions, requestPatrolPermissions, permissionsReady,
  type PatrolPermissions,
} from "@/lib/permissions";
import MobileHeader from "@/components/MobileHeader";
import { getCurrentPosition, haversineDistance, formatCoords } from "@/lib/gps";
import { addToQueue, getQueueCount } from "@/lib/offline";
import { savePatrolLog, updateGuardSession, subscribeCheckpoints, syncOfflineQueue, saveAlert } from "@/lib/firestore";
import { playSuccess, playOutside, playFail, playCooldown, playEmergency } from "@/lib/audioFeedback";
import {
  isValidQrFormat, canScan, recordScan,
  secondsUntilNextScan, formatCountdown
} from "@/lib/scanProtection";
import { db, isFirebaseReady } from "@/firebase";
import { DEMO_CHECKPOINTS } from "@/lib/demo";
import type { Checkpoint, PatrolLog, GpsCoords, ScanStatus } from "@/types";

interface GuardPatrolProps {
  guardId: string;
  guardName: string;
  companyId: string;
  onLogout: () => void;
}

const STATUS_LABEL: Record<ScanStatus, string> = {
  valid: "✓ معتبر",
  outside: "⚠ خارج از محدوده",
  failed: "✗ ناموفق",
};

const SOS_HOLD_MS = 3000;

export default function GuardPatrol({ guardId, guardName, companyId, onLogout }: GuardPatrolProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [scanning, setScanning] = useState(false);
  const [gps, setGps] = useState<GpsCoords | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(getQueueCount());
  const [recentLogs, setRecentLogs] = useState<PatrolLog[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  // SOS state
  const [sosHolding, setSosHolding] = useState(false);
  const [sosProgress, setSosProgress] = useState(0);
  const [sosSent, setSosSent] = useState(false);
  const [sosSending, setSosSending] = useState(false);
  const sosIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sosStartRef = useRef<number>(0);

  type ScanResult = {
    ok: boolean;
    title: string;
    msg: string;
    status: ScanStatus | "cooldown";
    sub?: string;
  };
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const scannerRef = useRef<any>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isDemo = !isFirebaseReady;

  // ── Permissions ────────────────────────────────────────────────────────────
  const [perms, setPerms] = useState<PatrolPermissions | null>(null);
  const [requestingPerms, setRequestingPerms] = useState(false);

  useEffect(() => {
    checkPatrolPermissions().then((p) => {
      setPerms(p);
    });
  }, []);

  const handleRequestPerms = async () => {
    setRequestingPerms(true);
    const p = await requestPatrolPermissions();
    setPerms(p);
    setRequestingPerms(false);
  };

  // ── Load checkpoints ───────────────────────────────────────────────────────
  useEffect(() => {
    if (isDemo) {
      setCheckpoints(DEMO_CHECKPOINTS);
      return;
    }
    return subscribeCheckpoints(companyId, setCheckpoints);
  }, [companyId, isDemo]);

  // ── Online sync ────────────────────────────────────────────────────────────
  const handleSync = useCallback(async () => {
    if (!online || !db) return;
    setSyncing(true);
    await syncOfflineQueue();
    setQueueCount(getQueueCount());
    setSyncing(false);
  }, [online]);

  useEffect(() => {
    const onOnline = () => { setOnline(true); handleSync(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [handleSync]);

  // ── Cooldown countdown timer ───────────────────────────────────────────────
  const refreshCooldowns = useCallback(() => {
    const updated: Record<string, number> = {};
    for (const cp of checkpoints) {
      const s = secondsUntilNextScan(cp.id);
      if (s > 0) updated[cp.id] = s;
    }
    setCooldowns(updated);
  }, [checkpoints]);

  useEffect(() => {
    refreshCooldowns();
    cooldownTimerRef.current = setInterval(refreshCooldowns, 1000);
    return () => { if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current); };
  }, [refreshCooldowns]);

  // ── GPS ────────────────────────────────────────────────────────────────────
  useEffect(() => { fetchGps(); }, []);

  const fetchGps = async () => {
    setGpsLoading(true);
    setGpsError("");
    try {
      const coords = await getCurrentPosition();
      setGps(coords);
      if (db) {
        updateGuardSession({
          guardId, guardName, companyId,
          lastSeen: Date.now(),
          lastCheckpoint: recentLogs[0]?.checkpointName ?? "—",
          lastGps: coords,
          status: "active",
        });
      }
    } catch {
      setGpsError("GPS در دسترس نیست");
    } finally {
      setGpsLoading(false);
    }
  };

  // ── Scanner ────────────────────────────────────────────────────────────────
  const startScanner = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader-guard");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 12, qrbox: { width: 240, height: 240 } },
        (text: string) => handleQrScan(text),
        () => {}
      );
    } catch {
      setScanResult({
        ok: false, status: "failed",
        title: "دسترسی به دوربین رد شد",
        msg: "لطفاً دسترسی دوربین را در تنظیمات مرورگر فعال کنید.",
      });
      playFail();
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      }
    } catch {}
    setScanning(false);
  };

  // ── QR scan handler ────────────────────────────────────────────────────────
  const handleQrScan = async (qrText: string) => {
    await stopScanner();

    if (!isValidQrFormat(qrText)) {
      setScanResult({
        ok: false, status: "failed",
        title: "کد QR نامعتبر",
        msg: "این کد توسط سیستم ARC Guard صادر نشده. فقط کدهای رسمی قابل اسکن هستند.",
        sub: `کد دریافتی: ${qrText.slice(0, 40)}${qrText.length > 40 ? "…" : ""}`,
      });
      playFail();
      return;
    }

    const checkpoint = checkpoints.find((cp) => cp.qrCode === qrText) ?? null;
    if (!checkpoint) {
      setScanResult({
        ok: false, status: "failed",
        title: "ایستگاه ناشناس",
        msg: "این کد QR در سیستم ثبت نشده است. با مدیر تماس بگیرید.",
        sub: qrText,
      });
      playFail();
      persistLog(buildLog(qrText, null, null, null, false, "failed"));
      return;
    }

    if (!canScan(checkpoint.id)) {
      const secs = secondsUntilNextScan(checkpoint.id);
      setScanResult({
        ok: false, status: "cooldown",
        title: "اسکن مجدد زود است",
        msg: `ایستگاه "${checkpoint.name}" در ${formatCountdown(secs)} دقیقه دیگر قابل اسکن است.`,
        sub: "برای جلوگیری از تقلب، هر ایستگاه هر ۵ دقیقه یک‌بار قابل اسکن است.",
      });
      playCooldown();
      return;
    }

    if (!gps) {
      setScanResult({
        ok: false, status: "failed",
        title: "موقعیت GPS دریافت نشد",
        msg: "GPS دستگاه را فعال کنید و دوباره تلاش نمایید.",
      });
      playFail();
      return;
    }

    const distance = Math.round(haversineDistance(gps.lat, gps.lng, checkpoint.lat, checkpoint.lng));
    const withinRadius = distance <= checkpoint.radiusMeters;
    const status: ScanStatus = withinRadius ? "valid" : "outside";
    const log = buildLog(qrText, checkpoint, gps, distance, withinRadius, status);

    recordScan(checkpoint.id);
    refreshCooldowns();
    setRecentLogs((prev) => [log, ...prev.slice(0, 9)]);

    if (withinRadius) {
      setScanResult({
        ok: true, status: "valid",
        title: `✓ ایستگاه "${checkpoint.name}" تأیید شد`,
        msg: `فاصله: ${distance} متر · دقت GPS: ±${Math.round(gps.accuracy)} متر`,
        sub: new Date().toLocaleString("fa-IR"),
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
      setScanResult({
        ok: false, status: "outside",
        title: "⚠ خارج از محدوده مجاز",
        msg: `فاصله شما ${distance} متر است. حداکثر مجاز: ${checkpoint.radiusMeters} متر.`,
        sub: "ثبت شد — اما به عنوان تخلف بارگذاری می‌شود.",
      });
      playOutside();
    }

    persistLog(log);
    fetchGps();
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const buildLog = (
    qrText: string,
    checkpoint: Checkpoint | null,
    gpsVal: GpsCoords | null,
    distance: number | null,
    withinRadius: boolean,
    status: ScanStatus
  ): PatrolLog => ({
    guardId, guardName, companyId,
    checkpointId: checkpoint?.id ?? "unknown",
    checkpointName: checkpoint?.name ?? "ناشناس",
    qrScanned: qrText,
    gps: gpsVal,
    distanceMeters: distance,
    withinRadius, status,
    scanTime: Date.now(),
    scannedAt: Date.now(),
    scannedAtText: new Date().toLocaleString("fa-IR"),
    synced: false,
  });

  const persistLog = (log: PatrolLog) => {
    if (!isDemo) {
      if (online && db) {
        savePatrolLog({ ...log, synced: true }).catch(() => {
          addToQueue(log);
          setQueueCount(getQueueCount());
        });
      } else {
        addToQueue(log);
        setQueueCount(getQueueCount());
      }
    }
  };

  // ── SOS hold logic ────────────────────────────────────────────────────────
  const startSosHold = () => {
    if (sosSent || sosSending) return;
    setSosHolding(true);
    setSosProgress(0);
    sosStartRef.current = Date.now();
    sosIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - sosStartRef.current;
      const pct = Math.min(100, (elapsed / SOS_HOLD_MS) * 100);
      setSosProgress(pct);
      if (elapsed >= SOS_HOLD_MS) {
        clearInterval(sosIntervalRef.current!);
        triggerSos();
      }
    }, 30);
  };

  const cancelSosHold = () => {
    if (sosIntervalRef.current) clearInterval(sosIntervalRef.current);
    setSosHolding(false);
    setSosProgress(0);
  };

  const triggerSos = async () => {
    setSosHolding(false);
    setSosProgress(0);
    setSosSending(true);
    playEmergency();

    const currentGps = gps;
    if (db && !isDemo) {
      try {
        await saveAlert({
          kind: "sos",
          guardId,
          guardName,
          gps: currentGps,
          alertedAt: Date.now(),
          companyId,
          resolved: false,
          message: "اضطراری توسط نگهبان فعال شد",
        });
      } catch {}
    }
    setSosSending(false);
    setSosSent(true);
    setTimeout(() => setSosSent(false), 15000);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  // ── Permission gate (shown once before patrol starts) ──────────────────────
  if (perms !== null && !permissionsReady(perms) && !isDemo) {
    const camDenied = perms.camera === "denied";
    const gpsDenied = perms.gps === "denied";

    return (
      <div className="min-h-screen bg-background arc-grid-bg flex flex-col" dir="rtl">
        <MobileHeader title="ARC Guard" subtitle={guardName} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-5">

            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center mx-auto">
                <Shield className="w-8 h-8 text-yellow-400" />
              </div>
              <h2 className="text-lg font-bold text-foreground">دسترسی‌های لازم</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                برای شروع گشت امنیتی، ARC Guard به دوربین و موقعیت GPS نیاز دارد.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  icon: Camera,
                  label: "دوربین",
                  desc: "اسکن کد QR ایستگاه‌ها",
                  state: perms.camera,
                  denied: camDenied,
                },
                {
                  icon: MapPin,
                  label: "موقعیت مکانی",
                  desc: "تأیید حضور در محل ایستگاه",
                  state: perms.gps,
                  denied: gpsDenied,
                },
              ].map(({ icon: Icon, label, desc, state, denied }) => (
                <div key={label} className={`rounded-xl border p-4 flex items-center gap-3 ${
                  state === "granted"
                    ? "border-green-500/30 bg-green-500/8"
                    : denied
                    ? "border-red-500/30 bg-red-500/8"
                    : "border-yellow-500/30 bg-yellow-500/8"
                }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    state === "granted" ? "bg-green-500/20" : denied ? "bg-red-500/20" : "bg-yellow-500/20"
                  }`}>
                    <Icon className={`w-5 h-5 ${
                      state === "granted" ? "text-green-400" : denied ? "text-red-400" : "text-yellow-400"
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${
                      state === "granted" ? "text-green-400" : denied ? "text-red-400" : "text-yellow-400"
                    }`}>{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                    state === "granted"
                      ? "bg-green-500/20 text-green-400"
                      : denied
                      ? "bg-red-500/20 text-red-400"
                      : "bg-yellow-500/20 text-yellow-400"
                  }`}>
                    {state === "granted" ? "✓ داده شد" : denied ? "رد شد" : "در انتظار"}
                  </span>
                </div>
              ))}
            </div>

            {(camDenied || gpsDenied) && (
              <div className="rounded-xl border border-border bg-card/60 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">چطور دسترسی بدهم؟</p>
                <p>۱. در مرورگر روی آیکون قفل 🔒 در نوار آدرس بزنید</p>
                <p>۲. دوربین و موقعیت مکانی را روی «مجاز» تنظیم کنید</p>
                <p>۳. صفحه را رفرش کنید</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={onLogout}
                className="px-4 py-3 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleRequestPerms}
                disabled={requestingPerms}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-60 transition-all active:scale-[0.98]"
              >
                {requestingPerms
                  ? <><RefreshCw className="w-4 h-4 animate-spin" />در حال درخواست...</>
                  : <><Shield className="w-4 h-4" />اجازه دسترسی</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background arc-grid-bg flex flex-col">
      <MobileHeader title="ARC Guard" subtitle={guardName} notificationCount={queueCount} />

      <div className="flex-1 p-4 space-y-3 max-w-lg mx-auto w-full pb-8">

        {/* Demo notice */}
        {isDemo && (
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/8 px-3 py-2.5 flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-sky-400 shrink-0" />
            <p className="text-xs text-sky-300/80">
              <span className="font-bold text-sky-400">حالت نمونه</span> — ایستگاه‌های نمونه بارگذاری شدند.
            </p>
          </div>
        )}

        {/* Status strip */}
        <div className="flex gap-2">
          <div className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium ${online ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
            {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {online ? "آنلاین" : "آفلاین"}
          </div>
          <div className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium ${gps ? "border-primary/30 bg-primary/10 text-primary" : "border-muted-foreground/20 bg-muted text-muted-foreground"}`}>
            <MapPin className="w-3.5 h-3.5" />
            {gpsLoading ? "جستجو..." : gps ? `±${Math.round(gps.accuracy)} متر` : gpsError || "بدون GPS"}
          </div>
          {queueCount > 0 && (
            <button onClick={handleSync}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-xs font-medium">
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {queueCount}
            </button>
          )}
        </div>

        {/* Guard card */}
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-bold text-lg shrink-0">
            {guardName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">{guardName}</p>
            {gps
              ? <p className="text-xs text-primary/70 mt-0.5 font-mono">{formatCoords(gps)}</p>
              : <p className="text-xs text-muted-foreground mt-0.5">موقعیت در دسترس نیست</p>
            }
          </div>
          <button onClick={onLogout} className="flex items-center gap-1 text-xs text-destructive/70 hover:text-destructive transition-colors p-2">
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* GPS warning */}
        {!gps && !gpsLoading && (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-yellow-400">GPS فعال نیست</p>
              <p className="text-xs text-muted-foreground mt-0.5">برای ثبت حضور در ایستگاه، GPS دستگاه را فعال کنید.</p>
            </div>
          </div>
        )}

        {/* ═══ SCANNER ═══ */}
        {!scanning ? (
          <button
            onClick={startScanner}
            className="w-full rounded-xl border-2 border-dashed border-primary/50 hover:border-primary bg-primary/5 hover:bg-primary/10 transition-all p-8 flex flex-col items-center gap-3 active:scale-[0.98]"
            style={{ WebkitTapHighlightColor: "rgba(14,165,233,0.2)" }}
          >
            <div className="w-20 h-20 rounded-full bg-primary/20 border-2 border-primary/50 flex items-center justify-center animate-glow-pulse">
              <QrCode className="w-10 h-10 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-primary">اسکن ایستگاه</p>
              <p className="text-xs text-muted-foreground mt-1">برای باز شدن دوربین ضربه بزنید</p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">فقط کدهای رسمی ARC Guard پذیرفته می‌شوند</p>
            </div>
          </button>
        ) : (
          <div className="rounded-xl border-2 border-primary/60 bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-primary/10 border-b border-primary/20">
              <div className="flex items-center gap-2 text-sm font-bold text-primary">
                <Camera className="w-4 h-4" />
                دوربین فعال — کد QR را نشان دهید
              </div>
              <button onClick={stopScanner} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div id="qr-reader-guard" style={{ background: "#ffffff" }} />
            <div className="px-4 py-2 bg-black/30 text-center">
              <p className="text-[11px] text-primary/70">دوربین را روی کد QR ایستگاه بگیرید</p>
            </div>
          </div>
        )}

        {/* ═══ SCAN RESULT ═══ */}
        {scanResult && (
          <div className={`rounded-xl border p-4 animate-fade-in-up ${
            scanResult.status === "valid" ? "border-green-500/40 bg-green-500/10" :
            scanResult.status === "outside" ? "border-yellow-500/40 bg-yellow-500/10" :
            scanResult.status === "cooldown" ? "border-sky-500/40 bg-sky-500/10" :
            "border-destructive/40 bg-destructive/10"
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                scanResult.status === "valid" ? "bg-green-500/20" :
                scanResult.status === "outside" ? "bg-yellow-500/20" :
                scanResult.status === "cooldown" ? "bg-sky-500/20" : "bg-destructive/20"
              }`}>
                {scanResult.status === "valid" ? <CheckCircle className="w-6 h-6 text-green-400" /> :
                 scanResult.status === "cooldown" ? <Lock className="w-6 h-6 text-sky-400" /> :
                 <AlertTriangle className={`w-6 h-6 ${scanResult.status === "outside" ? "text-yellow-400" : "text-destructive"}`} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${
                  scanResult.status === "valid" ? "text-green-400" :
                  scanResult.status === "outside" ? "text-yellow-400" :
                  scanResult.status === "cooldown" ? "text-sky-400" : "text-destructive"
                }`}>{scanResult.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{scanResult.msg}</p>
                {scanResult.sub && (
                  <p className="text-[11px] text-muted-foreground/60 mt-1 font-mono break-all">{scanResult.sub}</p>
                )}
                {!online && scanResult.status !== "cooldown" && (
                  <p className="text-xs text-yellow-400 mt-2 flex items-center gap-1">
                    <WifiOff className="w-3 h-3" />آفلاین ذخیره شد
                  </p>
                )}
              </div>
            </div>
            {scanResult.status !== "cooldown" && (
              <button
                onClick={() => { setScanResult(null); startScanner(); }}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-current/20 text-xs font-medium opacity-70 hover:opacity-100 transition-opacity"
              >
                <Camera className="w-3.5 h-3.5" />اسکن مجدد
              </button>
            )}
          </div>
        )}

        {/* ═══ CHECKPOINT LIST ═══ */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">ایستگاه‌های گشت</span>
            <span className="text-xs text-muted-foreground mr-1">({checkpoints.length})</span>
          </div>
          {checkpoints.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">ایستگاهی تنظیم نشده است.</div>
          ) : (
            <div className="divide-y divide-border">
              {checkpoints.map((cp) => {
                const log = recentLogs.find((l) => l.checkpointId === cp.id);
                const s = log?.status;
                const coolSecs = cooldowns[cp.id] ?? 0;
                const locked = coolSecs > 0;
                return (
                  <div key={cp.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 ${
                      locked ? "bg-sky-500/10 border-sky-500/30" :
                      s === "valid" ? "bg-green-500/15 border-green-500/40" :
                      s === "outside" ? "bg-yellow-500/15 border-yellow-500/40" :
                      s === "failed" ? "bg-destructive/15 border-destructive/40" : "bg-muted border-border"
                    }`}>
                      {locked ? <Lock className="w-4 h-4 text-sky-400" /> :
                       s === "valid" ? <CheckCircle className="w-4 h-4 text-green-400" /> :
                       s === "outside" ? <AlertTriangle className="w-4 h-4 text-yellow-400" /> :
                       s === "failed" ? <AlertTriangle className="w-4 h-4 text-destructive" /> :
                       <MapPin className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${
                        locked ? "text-sky-400" : s === "valid" ? "text-green-400" :
                        s === "outside" ? "text-yellow-400" : s === "failed" ? "text-destructive" : "text-foreground"
                      }`}>{cp.name}</p>
                      {cp.location && <p className="text-xs text-muted-foreground truncate">{cp.location}</p>}
                    </div>
                    <div className="shrink-0 text-left min-w-[70px]">
                      {locked ? (
                        <p className="text-xs font-mono text-sky-400 text-center">🔒 {formatCountdown(coolSecs)}</p>
                      ) : (
                        <>
                          <p className={`text-xs font-semibold ${
                            s === "valid" ? "text-green-400" : s === "outside" ? "text-yellow-400" :
                            s === "failed" ? "text-destructive" : "text-muted-foreground"
                          }`}>{s ? STATUS_LABEL[s] : "در انتظار"}</p>
                          <p className="text-xs text-muted-foreground">{cp.radiusMeters} متر</p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ RECENT LOGS ═══ */}
        {recentLogs.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-bold text-foreground">آخرین اسکن‌های این نشست</span>
            </div>
            <div className="divide-y divide-border">
              {recentLogs.slice(0, 5).map((log, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    log.status === "valid" ? "bg-green-400" :
                    log.status === "outside" ? "bg-yellow-400" : "bg-destructive"
                  }`} />
                  <p className="text-xs text-muted-foreground flex-1 truncate">
                    <span className="text-foreground font-medium">{log.checkpointName}</span>
                    {log.distanceMeters !== null && <span> · {log.distanceMeters} متر</span>}
                  </p>
                  <span className={`text-xs font-semibold ${
                    log.status === "valid" ? "text-green-400" :
                    log.status === "outside" ? "text-yellow-400" : "text-destructive"
                  }`}>{STATUS_LABEL[log.status]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={fetchGps}
          disabled={gpsLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${gpsLoading ? "animate-spin" : ""}`} />
          {gpsLoading ? "در حال دریافت موقعیت..." : "بروزرسانی موقعیت GPS"}
        </button>

        {/* ═══ SOS PANIC BUTTON ═══ */}
        <div className="rounded-xl border-2 border-red-500/40 bg-red-950/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-red-400" />
            <p className="text-sm font-bold text-red-400">دکمه اضطراری</p>
          </div>
          <p className="text-xs text-muted-foreground">
            در صورت خطر یا اضطراری واقعی، دکمه زیر را ۳ ثانیه نگه دارید تا هشدار فوری به مدیر ارسال شود.
          </p>

          {sosSent ? (
            <div className="rounded-lg bg-red-500/20 border border-red-500/40 px-4 py-3 flex items-center gap-3">
              <Radio className="w-5 h-5 text-red-400 animate-pulse shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-400">هشدار اضطراری ارسال شد</p>
                <p className="text-xs text-muted-foreground mt-0.5">مدیر در حال دریافت هشدار است. آرام باشید.</p>
              </div>
            </div>
          ) : (
            <div className="relative select-none">
              {/* Progress ring */}
              {sosHolding && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                  <svg className="absolute w-full h-full" viewBox="0 0 100 100">
                    <circle
                      cx="50" cy="50" r="48"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="4"
                      strokeDasharray={`${sosProgress * 3.016} 301.6`}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                      style={{ transition: "stroke-dasharray 0.03s linear" }}
                    />
                  </svg>
                </div>
              )}
              <button
                onMouseDown={startSosHold}
                onMouseUp={cancelSosHold}
                onMouseLeave={cancelSosHold}
                onTouchStart={(e) => { e.preventDefault(); startSosHold(); }}
                onTouchEnd={cancelSosHold}
                onTouchCancel={cancelSosHold}
                disabled={sosSending}
                className={`w-full py-4 rounded-xl border-2 font-bold text-base flex items-center justify-center gap-3 transition-all select-none ${
                  sosHolding
                    ? "border-red-500 bg-red-500/30 text-red-300 scale-[0.97]"
                    : "border-red-500/60 bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-[0.97]"
                } disabled:opacity-60`}
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "none" }}
              >
                <Radio className={`w-6 h-6 ${sosHolding ? "animate-ping" : ""}`} />
                {sosSending ? "در حال ارسال..." : sosHolding ? `نگه دارید... ${Math.round(sosProgress)}%` : "SOS اضطراری — نگه دارید"}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
