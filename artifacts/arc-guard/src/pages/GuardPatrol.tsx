import { useState, useEffect, useRef, useCallback } from "react";
import {
  QrCode, MapPin, CheckCircle, AlertTriangle, XCircle,
  Shield, LogOut, Wifi, WifiOff, Clock, Camera,
  PhoneOff, Loader2, ChevronDown, ChevronUp, RefreshCw,
  Navigation,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import LanguageSelector from "@/components/LanguageSelector";
import { doc, getDoc } from "firebase/firestore";
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
  guardCode?: string;
  companyId: string;
  companyName?: string;
  onLogout: () => void;
}

// "gps-wait" = checkpoint found, waiting for getCurrentPosition to resolve
type ScanPhase = "idle" | "scanning" | "gps-wait" | "result";

type ScanResult = {
  ok: boolean;
  status: ScanStatus | "cooldown" | "failed" | "gps-error";
  title: string;
  msg: string;
  checkpoint?: string;
  distance?: number;
  // Coordinate details for result display
  guardCoords?: GpsCoords;
  checkpointCoords?: { lat: number; lng: number };
  // GPS error details
  gpsErrorCode?: number; // GeolocationPositionError code
};

type ScanDebug = {
  qrText: string;
  qrFormat: "v2" | "v1" | "invalid";
  qrCompanyId: string | null;
  qrCheckpointId: string | null;
  guardCompanyId: string;
  firestorePath: string | null;
  localCheckpointsCount: number;
  foundInLocal: boolean;
  foundInFirestore: boolean | null;
  failReason: string | null;
  guardLat?: number | null;
  guardLng?: number | null;
  checkpointLat?: number | null;
  checkpointLng?: number | null;
  distanceMeters?: number | null;
};

/** Pending GPS context — stored while we wait for getCurrentPosition */
type PendingGps = {
  checkpoint: Checkpoint;
  qrText: string;
  qrFormat: ScanDebug["qrFormat"];
  qrCompanyId: string | null;
  qrCheckpointId: string | null;
  firestorePath: string | null;
  foundInLocal: boolean;
  foundInFirestore: boolean | null;
  localCount: number;
};

const SOS_HOLD_MS = 3000;
const GPS_TIMEOUT_MS = 20_000;

/** Map GeolocationPositionError.code to Persian message */
function gpsErrorMessage(code: number): string {
  switch (code) {
    case 1: return "دسترسی به GPS رد شده است. لطفاً در تنظیمات مرورگر دسترسی موقعیت مکانی را فعال کنید.";
    case 2: return "موقعیت مکانی در دسترس نیست. GPS دستگاه را بررسی کنید.";
    case 3: return "دریافت GPS بیش از ۲۰ ثانیه طول کشید. دوباره تلاش کنید.";
    default: return "خطای ناشناخته GPS. دوباره تلاش کنید.";
  }
}

function gpsErrorTitle(code: number): string {
  switch (code) {
    case 1: return "دسترسی GPS رد شد";
    case 2: return "GPS در دسترس نیست";
    case 3: return "انتظار GPS منقضی شد";
    default: return "خطای GPS";
  }
}

export default function GuardPatrol({ guardId, guardName, guardCode, companyId, companyName, onLogout }: GuardPatrolProps) {
  const [checkpoints, setCheckpoints]             = useState<Checkpoint[]>([]);
  const [checkpointsLoaded, setCheckpointsLoaded] = useState(false);
  const [gps, setGps]                             = useState<GpsCoords | null>(null);
  const [gpsError, setGpsError]                   = useState(false);
  const [online, setOnline]                       = useState(navigator.onLine);
  const [queueCount, setQueueCount]               = useState(getQueueCount());
  const [recentLogs, setRecentLogs]               = useState<PatrolLog[]>([]);
  const [scanPhase, setScanPhase]                 = useState<ScanPhase>("idle");
  const [scanResult, setScanResult]               = useState<ScanResult | null>(null);
  const [scanDebug, setScanDebug]                 = useState<ScanDebug | null>(null);
  const [showDebug, setShowDebug]                 = useState(false);
  const [syncing, setSyncing]                     = useState(false);

  // SOS
  const [sosHolding, setSosHolding]   = useState(false);
  const [sosProgress, setSosProgress] = useState(0);
  const [sosSent, setSosSent]         = useState(false);
  const [sosSending, setSosSending]   = useState(false);
  const [sosError, setSosError]       = useState<string | null>(null);
  const [sosWritePath, setSosWritePath] = useState<string | null>(null);
  const [showSosDebug, setShowSosDebug] = useState(false);

  const scannerRef     = useRef<any>(null);
  const sosTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const sosStartRef    = useRef(0);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingGpsRef  = useRef<PendingGps | null>(null);
  const gpsRef         = useRef<GpsCoords | null>(null); // mirror of gps state for callbacks

  // Keep gpsRef in sync so callbacks see fresh GPS without stale closure
  useEffect(() => { gpsRef.current = gps; }, [gps]);

  // ── GPS watch (continuous background) ─────────────────────────────────────
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
        gpsRef.current = coords;
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
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [guardId, guardName, companyId, recentLogs]);

  // ── Load checkpoints (real-time) ──────────────────────────────────────────
  useEffect(() => {
    console.log(`[GuardPatrol] subscribing checkpoints → companies/${companyId}/checkpoints`);
    return subscribeCheckpoints(
      companyId,
      (cps) => {
        setCheckpoints(cps);
        setCheckpointsLoaded(true);
        console.log(`[GuardPatrol] checkpoints loaded: ${cps.length} active`);
      },
      (err) => {
        console.error("[GuardPatrol] checkpoints error:", (err as { code?: string }).code, err.message);
        setCheckpointsLoaded(true);
      },
    );
  }, [companyId]);

  // ── Online/offline + auto-sync ────────────────────────────────────────────
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

  // ── Scanner ───────────────────────────────────────────────────────────────
  const startScanner = useCallback(async () => {
    setScanPhase("scanning");
    setScanResult(null);
    setScanDebug(null);
    setShowDebug(false);
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

  // ── Distance processing (called once we have both checkpoint + GPS) ────────
  const processDistance = useCallback((
    pending: PendingGps,
    coords: GpsCoords,
  ) => {
    const { checkpoint, qrText, qrFormat, qrCompanyId, qrCheckpointId,
            firestorePath, foundInLocal, foundInFirestore, localCount } = pending;

    const distance = Math.round(
      haversineDistance(coords.lat, coords.lng, checkpoint.lat, checkpoint.lng),
    );
    const withinRadius = distance <= checkpoint.radiusMeters;
    const status: ScanStatus = withinRadius ? "valid" : "outside";

    console.log(`[scan] distance=${distance}m radius=${checkpoint.radiusMeters}m within=${withinRadius}`);

    setScanDebug({
      qrText, qrFormat, qrCompanyId, qrCheckpointId,
      guardCompanyId: companyId,
      firestorePath,
      localCheckpointsCount: localCount,
      foundInLocal: foundInLocal || foundInFirestore === true,
      foundInFirestore,
      failReason: null,
      guardLat: coords.lat,
      guardLng: coords.lng,
      checkpointLat: checkpoint.lat,
      checkpointLng: checkpoint.lng,
      distanceMeters: distance,
    });

    const log = buildLog(qrText, checkpoint, coords, distance, withinRadius, status);
    recordScan(checkpoint.id);
    setRecentLogs((prev) => [log, ...prev.slice(0, 4)]);

    if (withinRadius) {
      showResult({
        ok: true, status: "valid",
        title: "ایستگاه تأیید شد ✓",
        msg: `فاصله: ${distance} متر · دقت GPS: ±${Math.round(coords.accuracy)} متر`,
        checkpoint: checkpoint.name,
        distance,
        guardCoords: coords,
        checkpointCoords: { lat: checkpoint.lat, lng: checkpoint.lng },
      });
      playSuccess();
      if (db) {
        updateGuardSession({
          guardId, guardName, companyId,
          lastSeen: Date.now(), lastCheckpoint: checkpoint.name,
          lastGps: coords, status: "active",
        });
      }
    } else {
      showResult({
        ok: false, status: "outside",
        title: "خارج از محدوده ایستگاه",
        msg: `فاصله شما ${distance} متر است. حداکثر مجاز: ${checkpoint.radiusMeters} متر.`,
        checkpoint: checkpoint.name,
        distance,
        guardCoords: coords,
        checkpointCoords: { lat: checkpoint.lat, lng: checkpoint.lng },
      });
      playOutside();
    }

    persistLog(log);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, guardId, guardName]);

  // ── Request GPS with fallback getCurrentPosition ──────────────────────────
  const fetchGpsAndProcess = useCallback((pending: PendingGps) => {
    pendingGpsRef.current = pending;
    setScanPhase("gps-wait");

    // If we already have a fresh GPS fix from watchPosition, use it immediately
    const existing = gpsRef.current;
    if (existing) {
      console.log("[scan] GPS already available, using immediately:", existing);
      pendingGpsRef.current = null;
      processDistance(pending, existing);
      return;
    }

    console.log("[scan] GPS not available yet — calling getCurrentPosition (timeout 20s)…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: GpsCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        console.log("[scan] getCurrentPosition ✓", coords);
        setGps(coords);
        gpsRef.current = coords;
        const saved = pendingGpsRef.current;
        pendingGpsRef.current = null;
        if (saved) processDistance(saved, coords);
      },
      (err) => {
        console.error("[scan] getCurrentPosition ✗", { code: err.code, message: err.message });
        const saved = pendingGpsRef.current;
        pendingGpsRef.current = null;

        // Build debug with checkpoint info but no GPS
        if (saved) {
          setScanDebug({
            qrText: saved.qrText, qrFormat: saved.qrFormat,
            qrCompanyId: saved.qrCompanyId, qrCheckpointId: saved.qrCheckpointId,
            guardCompanyId: companyId,
            firestorePath: saved.firestorePath,
            localCheckpointsCount: saved.localCount,
            foundInLocal: saved.foundInLocal || saved.foundInFirestore === true,
            foundInFirestore: saved.foundInFirestore,
            failReason: `GPS error code ${err.code}: ${err.message}`,
            checkpointLat: saved.checkpoint.lat,
            checkpointLng: saved.checkpoint.lng,
          });
        }

        showResult({
          ok: false, status: "gps-error",
          title: gpsErrorTitle(err.code),
          msg: gpsErrorMessage(err.code),
          checkpoint: saved?.checkpoint.name,
          gpsErrorCode: err.code,
          checkpointCoords: saved ? { lat: saved.checkpoint.lat, lng: saved.checkpoint.lng } : undefined,
        });
        playFail();
      },
      { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge: 0 },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, processDistance]);

  // ── Retry GPS (called from result overlay retry button) ───────────────────
  const retryGps = useCallback(() => {
    if (!pendingGpsRef.current) {
      // Re-read from last scanDebug checkpoint coords if available
      setScanPhase("idle");
      return;
    }
    setScanResult(null);
    setShowDebug(false);
    fetchGpsAndProcess(pendingGpsRef.current);
  }, [fetchGpsAndProcess]);

  // ── QR processing ─────────────────────────────────────────────────────────
  const handleQrScan = useCallback(async (qrText: string) => {
    await stopScanner();
    setScanPhase("result"); // temp "result" while we process — will switch to gps-wait if needed

    console.log("[scan] QR scanned:", qrText);
    console.log("[scan] guard companyId:", companyId);
    console.log("[scan] local checkpoints count:", checkpoints.length);

    // ── 1. Validate format ─────────────────────────────────────────────────
    if (!isValidQrFormat(qrText)) {
      setScanDebug({
        qrText, qrFormat: "invalid",
        qrCompanyId: null, qrCheckpointId: null,
        guardCompanyId: companyId,
        firestorePath: null,
        localCheckpointsCount: checkpoints.length,
        foundInLocal: false, foundInFirestore: null,
        failReason: "فرمت QR نامعتبر — توسط ARC Guard صادر نشده",
      });
      showResult({
        ok: false, status: "failed",
        title: "این QR در سیستم تعریف نشده است",
        msg: "کد QR توسط ARC Guard صادر نشده. با مدیر تماس بگیرید.",
      });
      playFail();
      persistLog(buildLog(qrText, null, null, null, false, "failed"));
      return;
    }

    // ── 2. Parse QR ────────────────────────────────────────────────────────
    const parsed       = parseQrCode(qrText);
    const qrFormat: ScanDebug["qrFormat"] = parsed ? "v2" : "v1";
    const qrCompanyId   = parsed?.companyId    ?? null;
    const qrCheckpointId = parsed?.checkpointId ?? null;

    console.log("[scan] parsed →", { qrFormat, qrCompanyId, qrCheckpointId });

    // ── 3. Company ID check (v2 only) ──────────────────────────────────────
    if (parsed && qrCompanyId !== companyId) {
      setScanDebug({
        qrText, qrFormat, qrCompanyId, qrCheckpointId,
        guardCompanyId: companyId,
        firestorePath: null,
        localCheckpointsCount: checkpoints.length,
        foundInLocal: false, foundInFirestore: null,
        failReason: `شرکت QR (${qrCompanyId?.slice(-6)}) با شرکت نگهبان (${companyId.slice(-6)}) مطابقت ندارد`,
      });
      showResult({
        ok: false, status: "failed",
        title: "این QR برای شرکت دیگری است",
        msg: `شناسه QR: …${qrCompanyId?.slice(-8) ?? "?"}\nشناسه شما: …${companyId.slice(-8)}`,
      });
      playFail();
      return;
    }

    // ── 4. Find checkpoint ─────────────────────────────────────────────────
    let checkpoint: Checkpoint | null = null;
    let foundInLocal = false;
    let foundInFirestore: boolean | null = null;
    const firestorePath = qrCheckpointId
      ? `companies/${companyId}/checkpoints/${qrCheckpointId}`
      : null;

    // 4a. Local state
    checkpoint = parsed && qrCheckpointId
      ? (checkpoints.find((c) => c.id === qrCheckpointId) ?? null)
      : (checkpoints.find((c) => c.qrCode === qrText) ?? null);
    foundInLocal = checkpoint !== null;

    console.log(`[scan] local lookup (${checkpoints.length} items): found=${foundInLocal}`, checkpoint?.name ?? "—");

    // 4b. Direct Firestore if not in local (subscription timing issue)
    if (!checkpoint && qrCheckpointId && db) {
      console.log(`[scan] Firestore direct lookup: ${firestorePath}`);
      try {
        const cpDoc = await getDoc(doc(db, "companies", companyId, "checkpoints", qrCheckpointId));
        if (cpDoc.exists()) {
          checkpoint = { id: cpDoc.id, ...cpDoc.data() } as Checkpoint;
          foundInFirestore = true;
          console.log("[scan] Firestore lookup ✓ →", checkpoint.name);
        } else {
          foundInFirestore = false;
          console.warn("[scan] Firestore: document does not exist at", firestorePath);
        }
      } catch (err) {
        foundInFirestore = false;
        console.error("[scan] Firestore lookup error:", err);
      }
    }

    if (!checkpoint) {
      const failReason = !checkpointsLoaded && checkpoints.length === 0
        ? "لیست ایستگاه‌ها هنوز بارگذاری نشده"
        : foundInFirestore === false
        ? `ایستگاه در Firestore پیدا نشد — ${firestorePath ?? "?"}`
        : `ایستگاه در لیست ${checkpoints.length} ایستگاه یافت نشد`;

      setScanDebug({
        qrText, qrFormat, qrCompanyId, qrCheckpointId,
        guardCompanyId: companyId,
        firestorePath,
        localCheckpointsCount: checkpoints.length,
        foundInLocal, foundInFirestore,
        failReason,
      });
      showResult({
        ok: false, status: "failed",
        title: "ایستگاه در سیستم پیدا نشد",
        msg: !checkpointsLoaded && checkpoints.length === 0
          ? "لیست ایستگاه‌ها هنوز بارگذاری نشده. چند ثانیه صبر کنید و دوباره اسکن کنید."
          : "این ایستگاه در سیستم تعریف نشده. با مدیر تماس بگیرید.",
      });
      playFail();
      persistLog(buildLog(qrText, null, null, null, false, "failed"));
      return;
    }

    // ── 5. Cooldown ────────────────────────────────────────────────────────
    if (!canScan(checkpoint.id)) {
      const secs = secondsUntilNextScan(checkpoint.id);
      setScanDebug({
        qrText, qrFormat, qrCompanyId, qrCheckpointId,
        guardCompanyId: companyId,
        firestorePath,
        localCheckpointsCount: checkpoints.length,
        foundInLocal: foundInLocal || foundInFirestore === true,
        foundInFirestore,
        failReason: `cooldown: ${secs} ثانیه باقی مانده`,
        checkpointLat: checkpoint.lat, checkpointLng: checkpoint.lng,
      });
      showResult({
        ok: false, status: "cooldown",
        title: "اسکن مجدد زود است",
        msg: `ایستگاه "${checkpoint.name}" تا ${formatCountdown(secs)} دقیقه دیگر قابل اسکن است.`,
        checkpoint: checkpoint.name,
      });
      playCooldown();
      return;
    }

    // ── 6. GPS — fetch or wait ─────────────────────────────────────────────
    // Checkpoint found → hand off to GPS phase (never fail immediately with "GPS not found")
    const pending: PendingGps = {
      checkpoint, qrText, qrFormat, qrCompanyId, qrCheckpointId,
      firestorePath,
      foundInLocal: foundInLocal || foundInFirestore === true,
      foundInFirestore,
      localCount: checkpoints.length,
    };
    fetchGpsAndProcess(pending);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkpoints, checkpointsLoaded, companyId, fetchGpsAndProcess]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const showResult = (result: ScanResult) => {
    setScanResult(result);
    setScanPhase("result");
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    // GPS errors don't auto-dismiss — guard needs to read the message and possibly retry
    if (result.status !== "gps-error") {
      resultTimerRef.current = setTimeout(() => {
        setScanPhase("idle");
        setScanResult(null);
      }, 4500);
    }
  };

  const dismissResult = () => {
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    pendingGpsRef.current = null;
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

  // ── Next checkpoint ────────────────────────────────────────────────────────
  const nextCheckpoint = (() => {
    if (checkpoints.length === 0) return null;
    const now = Date.now();
    let best: { cp: Checkpoint; overdue: boolean; secsLeft: number } | null = null;
    for (const cp of checkpoints) {
      const lastLog   = recentLogs.find((l) => l.checkpointId === cp.id);
      const intervalMs = (cp.patrolIntervalMinutes ?? 120) * 60_000;
      const nextAt    = lastLog ? lastLog.scannedAt + intervalMs : now - 1;
      const secsLeft  = Math.ceil((nextAt - now) / 1000);
      const overdue   = secsLeft <= 0;
      if (!best) { best = { cp, overdue, secsLeft }; continue; }
      if (overdue && !best.overdue) { best = { cp, overdue, secsLeft }; continue; }
      if (overdue && best.overdue && secsLeft < best.secsLeft) { best = { cp, overdue, secsLeft }; continue; }
      if (!overdue && !best.overdue && secsLeft < best.secsLeft) { best = { cp, overdue, secsLeft }; }
    }
    return best;
  })();

  // ── SOS ───────────────────────────────────────────────────────────────────
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
    setSosError(null);
    playEmergency();

    const writePath = `companies/${companyId}/alerts/{autoId}`;
    setSosWritePath(writePath);
    console.log(`[SOS] writing to ${writePath} — guardId=${guardId} companyId=${companyId}`);

    if (!db) {
      setSosError("Firebase پیکربندی نشده — SOS ارسال نشد. با مدیر سیستم تماس بگیرید.");
      setSosSending(false);
      return;
    }

    try {
      const alertId = await saveAlert({
        kind: "sos",
        status: "unread",
        guardId,
        guardName,
        companyId,
        gps: gps ?? undefined,
        // Flat GPS fields for easier Firestore queries
        gpsLat: gps?.lat ?? null,
        gpsLng: gps?.lng ?? null,
        gpsAccuracy: gps?.accuracy ?? null,
        alertedAt: Date.now(),
        resolved: false,
        message: "اضطراری توسط نگهبان فعال شد",
      });
      console.log(`[SOS] ✓ saved — alertId=${alertId} path=companies/${companyId}/alerts/${alertId}`);
      setSosWritePath(`companies/${companyId}/alerts/${alertId}`);
      setSosSent(true);
      setTimeout(() => setSosSent(false), 15_000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[SOS] ✗ saveAlert failed:`, err);
      setSosError(`خطا در ارسال SOS به سرور: ${msg}`);
    }

    setSosSending(false);
  };

  // ── GPS chip ──────────────────────────────────────────────────────────────
  const gpsAccuracy   = gps ? Math.round(gps.accuracy) : null;
  const gpsChipColor  = gpsAccuracy === null
    ? "bg-muted text-muted-foreground border-border"
    : gpsAccuracy <= 10 ? "bg-green-500/15 text-green-400 border-green-500/30"
    : gpsAccuracy <= 30 ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
    : "bg-red-500/15 text-red-400 border-red-500/30";

  // ── i18n ──────────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { t, dir } = useI18n();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background arc-grid-bg flex flex-col select-none" dir={dir}>

      {/* ── Header ── */}
      <header className="px-5 pt-5 pb-3 space-y-3">

        {/* Top row: company + mode badge + logout + language */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/12 border border-green-500/30">
              <Shield className="w-3.5 h-3.5 text-green-400" />
              <span className="text-[12px] font-bold text-green-400 tracking-wide">{t("guard.role")}</span>
            </div>
            {companyName && (
              <span className="text-[12px] text-muted-foreground truncate max-w-[100px]">{companyName}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <LanguageSelector variant="compact" />
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-muted-foreground
                hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-[13px] font-medium">{t("common.logout")}</span>
            </button>
          </div>
        </div>

        {/* Bottom row: guard identity + online status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="text-[19px] font-bold text-foreground leading-tight">{guardName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {guardCode && (
                  <span className="text-[12px] font-mono font-semibold text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded">
                    {guardCode}
                  </span>
                )}
                <span className="text-[13px] text-muted-foreground">{t("guard.role")}</span>
              </div>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] font-semibold ${
            online
              ? "bg-green-500/12 border-green-500/35 text-green-400"
              : "bg-red-500/12 border-red-500/35 text-red-400"
          }`}>
            {online
              ? <><Wifi className="w-4 h-4" />{t("common.status.online")}</>
              : <><WifiOff className="w-4 h-4" />{t("common.status.offline")}</>}
          </div>
        </div>
      </header>

      {/* ── Status bar ── */}
      <div className="flex flex-wrap items-center gap-2 px-5 pb-5">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[14px] font-semibold ${gpsChipColor}`}>
          <MapPin className="w-4 h-4" />
          {gpsError ? t("guard.gps.error")
            : gpsAccuracy === null ? t("guard.gps.loading")
            : t("guard.gps.accuracy", { n: gpsAccuracy })}
        </div>
        {!checkpointsLoaded ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-primary/10 border-primary/30 text-primary text-[14px] font-semibold">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("guard.checkpoints.loading")}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-muted border-border text-muted-foreground text-[14px] font-semibold">
            <MapPin className="w-4 h-4" />
            {t("guard.checkpoints.loaded", { n: checkpoints.length })}
          </div>
        )}
        {queueCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-yellow-500/10 border-yellow-500/30 text-yellow-400 text-[14px] font-semibold">
            <Clock className="w-4 h-4" />
            {t("guard.queue", { n: queueCount })}
            {online && (
              <button onClick={doSync} disabled={syncing} className="mr-1 opacity-70 hover:opacity-100">
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : t("guard.queue.send")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col items-center px-5 gap-6">

        {/* BIG SCAN BUTTON */}
        <div className="flex flex-col items-center gap-4 mt-2">
          <button
            onClick={startScanner}
            disabled={scanPhase !== "idle"}
            className="w-60 h-60 rounded-full bg-primary/10 border-4 border-primary/40 flex flex-col items-center justify-center gap-4
              hover:bg-primary/20 hover:border-primary/65 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-150 shadow-[0_0_60px_rgba(14,165,233,0.18)] arc-glow"
            style={{ touchAction: "manipulation" }}
          >
            <QrCode className="w-24 h-24 text-primary" />
            <span className="text-[22px] font-bold text-primary tracking-wide">{t("guard.scan.btn")}</span>
          </button>
          <p className="text-[16px] text-muted-foreground">{t("guard.scan.hint")}</p>
        </div>

        {/* Next checkpoint card */}
        {nextCheckpoint && (
          <div className={`w-full max-w-sm rounded-2xl border p-5 ${
            nextCheckpoint.overdue ? "border-orange-500/45 bg-orange-500/[0.08]" : "border-border bg-card/60"
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  nextCheckpoint.overdue ? "bg-orange-500/20" : "bg-muted"
                }`}>
                  <MapPin className={`w-6 h-6 ${nextCheckpoint.overdue ? "text-orange-400" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-muted-foreground">
                    {nextCheckpoint.overdue ? t("guard.next.overdue") : t("guard.next.next")}
                  </p>
                  <p className={`text-[18px] font-bold leading-tight ${nextCheckpoint.overdue ? "text-orange-400" : "text-foreground"}`}>
                    {nextCheckpoint.cp.name}
                  </p>
                </div>
              </div>
              {!nextCheckpoint.overdue && nextCheckpoint.secsLeft > 0 && (
                <span className="text-[15px] text-muted-foreground font-mono shrink-0">
                  {Math.ceil(nextCheckpoint.secsLeft / 60)} د
                </span>
              )}
            </div>
          </div>
        )}

        {/* SOS button */}
        <div className="w-full max-w-sm space-y-3">
          {sosSent ? (
            <div className="rounded-2xl border border-green-500/45 bg-green-500/10 py-5 px-5 flex items-center justify-center gap-3">
              <CheckCircle className="w-7 h-7 text-green-400 shrink-0" />
              <span className="text-[18px] font-bold text-green-400">{t("guard.sos.sent")}</span>
            </div>
          ) : sosError ? (
            <div className="rounded-2xl border border-red-500/60 bg-red-950/40 p-5 space-y-3">
              <div className="flex items-start gap-3">
                <XCircle className="w-7 h-7 text-red-400 shrink-0 mt-0.5" />
                <p className="text-[18px] font-bold text-red-400 leading-tight">{t("guard.sos.failed")}</p>
              </div>
              <p className="text-[15px] text-red-300/80 leading-relaxed">{sosError}</p>
              <button
                onClick={() => { setSosError(null); setSosSent(false); }}
                className="text-[15px] font-semibold text-red-400 hover:text-red-300 underline"
              >
                {t("common.retry")}
              </button>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden">
              {sosHolding && (
                <div
                  className="absolute inset-0 bg-red-500/30 rounded-2xl transition-all"
                  style={{ width: `${sosProgress}%` }}
                />
              )}
              <button
                onPointerDown={startSosHold}
                onPointerUp={cancelSosHold}
                onPointerLeave={cancelSosHold}
                onContextMenu={(e) => e.preventDefault()}
                disabled={sosSending}
                className="relative w-full py-5 rounded-2xl border border-red-500/45 bg-red-500/[0.08]
                  flex items-center justify-center gap-3 select-none touch-none
                  active:bg-red-500/20 transition-colors"
                style={{ touchAction: "none" }}
              >
                {sosSending
                  ? <Loader2 className="w-7 h-7 text-red-400 animate-spin" />
                  : <PhoneOff className="w-7 h-7 text-red-400" />}
                <span className="text-[19px] font-bold text-red-400">
                  {sosSending ? t("guard.sos.sending") : sosHolding ? t("guard.sos.holding") : t("guard.sos.hold")}
                </span>
              </button>
            </div>
          )}

          {/* SOS debug panel — DEV only */}
          {import.meta.env.DEV && (
            <div>
              <button
                onClick={() => setShowSosDebug(v => !v)}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
              >
                {showSosDebug ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <span className="font-mono">دیباگ SOS</span>
              </button>
              {showSosDebug && (
                <div className="mt-1 rounded-xl border border-white/10 bg-black/70 p-3 space-y-1.5 font-mono text-[10px]" dir="ltr">
                  <div className="flex justify-between gap-2">
                    <span className="text-white/30">Guard companyId</span>
                    <span className="text-white/60 break-all text-right">{companyId}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-white/30">Guard ID</span>
                    <span className="text-white/60 break-all text-right">{guardId}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-white/30">SOS write path</span>
                    <span className="text-primary/80 break-all text-right">
                      {sosWritePath ?? `companies/${companyId}/alerts/{autoId}`}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-white/30">GPS available</span>
                    <span className={gps ? "text-green-400" : "text-yellow-400"}>
                      {gps ? `✓ lat=${gps.lat.toFixed(5)} lng=${gps.lng.toFixed(5)}` : "✗ not yet"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-white/30">Firebase db</span>
                    <span className={db ? "text-green-400" : "text-red-400"}>{db ? "✓ ready" : "✗ null"}</span>
                  </div>
                  {sosError && (
                    <div className="border-t border-white/10 pt-2">
                      <span className="text-red-400 break-all">{sosError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent scans */}
        {recentLogs.length > 0 && (
          <div className="w-full max-w-sm pb-8">
            <p className="text-[15px] font-semibold text-muted-foreground mb-3 px-1">{t("guard.recent.title")}</p>
            <div className="space-y-2.5">
              {recentLogs.map((log, i) => (
                <div key={i} className={`rounded-xl border px-4 py-3.5 flex items-center gap-3 ${
                  log.status === "valid"
                    ? "border-green-500/28 bg-green-500/[0.07]"
                    : log.status === "outside"
                    ? "border-orange-500/28 bg-orange-500/[0.07]"
                    : "border-red-500/28 bg-red-500/[0.07]"
                }`}>
                  {log.status === "valid"
                    ? <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
                    : log.status === "outside"
                    ? <AlertTriangle className="w-6 h-6 text-orange-400 shrink-0" />
                    : <XCircle className="w-6 h-6 text-red-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[16px] font-semibold text-foreground truncate">{log.checkpointName}</p>
                    {log.distanceMeters !== null && (
                      <p className="text-[13px] text-muted-foreground mt-0.5">{log.distanceMeters} متر</p>
                    )}
                  </div>
                  <span className="text-[13px] text-muted-foreground font-mono shrink-0">{log.scannedAtText}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── QR Scanner overlay ── */}
      {scanPhase === "scanning" && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" dir="rtl">
          <div className="flex items-center justify-between px-5 py-5 bg-black/85">
            <button
              onClick={async () => { await stopScanner(); setScanPhase("idle"); }}
              className="flex items-center gap-2 text-white/75 hover:text-white transition-colors text-[16px] font-medium"
            >
              <XCircle className="w-6 h-6" />لغو
            </button>
            <div className="flex items-center gap-2 text-white/75 text-[16px]">
              <Camera className="w-5 h-5" />
              <span>کد QR ایستگاه را اسکن کنید</span>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center bg-black">
            <div id="qr-reader-guard" style={{ width: "100%", maxWidth: 380, background: "white" }} />
          </div>
          <div className="px-5 py-6 bg-black/85 flex items-center justify-center">
            <p className="text-white/55 text-[15px] text-center leading-relaxed">
              دوربین را روی کد QR روی تابلوی ایستگاه بگیرید
            </p>
          </div>
        </div>
      )}

      {/* ── GPS Wait overlay ── */}
      {scanPhase === "gps-wait" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 bg-black/92" dir="rtl">
          <div className="w-28 h-28 rounded-full bg-primary/15 border-2 border-primary/40 flex items-center justify-center mb-7 animate-pulse">
            <Navigation className="w-14 h-14 text-primary" />
          </div>
          <p className="text-[22px] font-bold text-white mb-3">دریافت موقعیت GPS</p>
          <p className="text-[16px] text-white/60 text-center leading-relaxed">
            لطفاً صبر کنید — موقعیت مکانی شما در حال دریافت است…
          </p>
          <p className="text-[14px] text-white/35 mt-4">حداکثر ۲۰ ثانیه</p>
        </div>
      )}

      {/* ── Scan Result overlay ── */}
      {scanPhase === "result" && scanResult && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center px-5 overflow-y-auto py-8"
          style={{
            background: scanResult.ok
              ? "radial-gradient(ellipse at center, rgba(34,197,94,0.18) 0%, rgba(7,16,32,0.96) 70%)"
              : scanResult.status === "outside"
              ? "radial-gradient(ellipse at center, rgba(249,115,22,0.18) 0%, rgba(7,16,32,0.96) 70%)"
              : scanResult.status === "gps-error"
              ? "radial-gradient(ellipse at center, rgba(168,85,247,0.18) 0%, rgba(7,16,32,0.96) 70%)"
              : "radial-gradient(ellipse at center, rgba(239,68,68,0.18) 0%, rgba(7,16,32,0.96) 70%)",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) dismissResult(); }}
        >
          <div className="flex flex-col items-center w-full max-w-sm" dir="rtl">

            {/* Icon */}
            <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-6 ${
              scanResult.ok               ? "bg-green-500/20 border-2 border-green-500/45"
              : scanResult.status === "outside"  ? "bg-orange-500/20 border-2 border-orange-500/45"
              : scanResult.status === "gps-error" ? "bg-purple-500/20 border-2 border-purple-500/45"
              : "bg-red-500/20 border-2 border-red-500/45"
            }`}>
              {scanResult.ok              ? <CheckCircle  className="w-18 h-18 text-green-400" style={{width:72,height:72}} />
              : scanResult.status === "outside"  ? <AlertTriangle className="w-18 h-18 text-orange-400" style={{width:72,height:72}} />
              : scanResult.status === "gps-error" ? <Navigation    className="w-18 h-18 text-purple-400" style={{width:72,height:72}} />
              : <XCircle className="w-18 h-18 text-red-400" style={{width:72,height:72}} />}
            </div>

            {/* Checkpoint name */}
            {scanResult.checkpoint && (
              <p className="text-[24px] font-bold text-white mb-2 text-center">{scanResult.checkpoint}</p>
            )}

            {/* Status title */}
            <p className={`text-[20px] font-bold mb-3 text-center leading-snug ${
              scanResult.ok               ? "text-green-400"
              : scanResult.status === "outside"  ? "text-orange-400"
              : scanResult.status === "gps-error" ? "text-purple-400"
              : "text-red-400"
            }`}>
              {scanResult.title}
            </p>

            {/* Message */}
            <p className="text-[16px] text-white/70 text-center leading-relaxed whitespace-pre-line">
              {scanResult.msg}
            </p>

            {/* Coordinates card */}
            {(scanResult.guardCoords || scanResult.checkpointCoords) && (
              <div className="mt-5 w-full rounded-xl border border-white/12 bg-white/5 divide-y divide-white/10">
                {scanResult.guardCoords && (
                  <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <span className="text-[13px] text-white/45 shrink-0 flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5" />موقعیت شما
                    </span>
                    <span className="text-[12px] font-mono text-white/70 text-left" dir="ltr">
                      {scanResult.guardCoords.lat.toFixed(6)}, {scanResult.guardCoords.lng.toFixed(6)}
                    </span>
                  </div>
                )}
                {scanResult.checkpointCoords && (
                  <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <span className="text-[13px] text-white/45 shrink-0 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />ایستگاه
                    </span>
                    <span className="text-[12px] font-mono text-white/70 text-left" dir="ltr">
                      {scanResult.checkpointCoords.lat.toFixed(6)}, {scanResult.checkpointCoords.lng.toFixed(6)}
                    </span>
                  </div>
                )}
                {scanResult.distance !== undefined && (
                  <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <span className="text-[13px] text-white/45">فاصله محاسبه‌شده</span>
                    <span className={`text-[16px] font-bold font-mono ${
                      scanResult.ok ? "text-green-400" : "text-orange-400"
                    }`}>{scanResult.distance} متر</span>
                  </div>
                )}
              </div>
            )}

            {/* GPS retry button */}
            {scanResult.status === "gps-error" && (
              <button
                onClick={(e) => { e.stopPropagation(); retryGps(); }}
                className="mt-5 flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-purple-500/20 border border-purple-500/45 text-purple-300 text-[17px] font-bold hover:bg-purple-500/30 active:scale-95 transition-all"
              >
                <RefreshCw className="w-5 h-5" />
                دریافت مجدد GPS
              </button>
            )}

            {/* Debug panel — DEV only */}
            {import.meta.env.DEV && scanDebug && (
              <div className="mt-4 w-full">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDebug(v => !v); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/35 hover:text-white/55 transition-colors"
                >
                  <span className="font-mono">🔍 اطلاعات دیباگ اسکن</span>
                  {showDebug ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {showDebug && (
                  <div className="mt-1 rounded-lg bg-black/80 border border-white/10 p-3 space-y-1.5 text-left" dir="ltr">
                    <DebugRow label="QR Format"          value={scanDebug.qrFormat} />
                    <DebugRow label="QR Company ID"      value={scanDebug.qrCompanyId     ?? "—"} mono />
                    <DebugRow label="QR Checkpoint ID"   value={scanDebug.qrCheckpointId  ?? "—"} mono />
                    <DebugRow label="Guard Company ID"   value={scanDebug.guardCompanyId} mono
                      match={scanDebug.qrCompanyId ? scanDebug.qrCompanyId === scanDebug.guardCompanyId : null} />
                    <DebugRow label="Firestore Path"     value={scanDebug.firestorePath   ?? "—"} mono />
                    <DebugRow label="Local checkpoints"  value={String(scanDebug.localCheckpointsCount)} />
                    <DebugRow label="Found in local"     value={scanDebug.foundInLocal    ? "✓ YES" : "✗ NO"} ok={scanDebug.foundInLocal} />
                    {scanDebug.foundInFirestore !== null && (
                      <DebugRow label="Found in Firestore" value={scanDebug.foundInFirestore ? "✓ YES" : "✗ NO"} ok={scanDebug.foundInFirestore} />
                    )}
                    {scanDebug.guardLat != null && (
                      <DebugRow label="Guard GPS" value={`${scanDebug.guardLat.toFixed(6)}, ${scanDebug.guardLng?.toFixed(6)}`} mono ok />
                    )}
                    {scanDebug.checkpointLat != null && (
                      <DebugRow label="Checkpoint GPS" value={`${scanDebug.checkpointLat.toFixed(6)}, ${scanDebug.checkpointLng?.toFixed(6)}`} mono />
                    )}
                    {scanDebug.distanceMeters != null && (
                      <DebugRow label="Distance" value={`${scanDebug.distanceMeters} m`}
                        ok={scanDebug.distanceMeters <= (scanResult?.checkpointCoords ? 9999 : 9999)} />
                    )}
                    {scanDebug.failReason && (
                      <DebugRow label="Fail reason" value={scanDebug.failReason} warn />
                    )}
                    <div className="border-t border-white/10 pt-2 mt-1">
                      <p className="text-[10px] text-white/20 font-mono break-all">{scanDebug.qrText}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={dismissResult}
                className="px-7 py-3 rounded-xl bg-white/10 hover:bg-white/18 border border-white/15 text-white/70 text-[17px] font-semibold transition-colors"
              >
                بستن
              </button>
            </div>
            {scanResult.status !== "gps-error" && (
              <p className="text-[13px] text-white/30 mt-3">یا صبر کنید — خودکار بسته می‌شود</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DebugRow({
  label, value, mono, ok, warn, match,
}: {
  label: string;
  value: string;
  mono?: boolean;
  ok?: boolean;
  warn?: boolean;
  match?: boolean | null;
}) {
  const col = ok === true ? "text-green-400"
    : ok === false ? "text-red-400"
    : warn ? "text-yellow-400"
    : match === true ? "text-green-400"
    : match === false ? "text-red-400"
    : "text-white/55";
  return (
    <div className="flex justify-between gap-3 text-[11px]">
      <span className="text-white/28 shrink-0">{label}</span>
      <span className={`${mono ? "font-mono" : ""} ${col} break-all text-right`}>{value}</span>
    </div>
  );
}
