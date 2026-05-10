import { useState, useEffect, useRef, useCallback } from "react";
import {
  QrCode, MapPin, Wifi, WifiOff, CheckCircle, AlertTriangle,
  Shield, LogOut, RefreshCw, Camera, XCircle, Clock
} from "lucide-react";
import MobileHeader from "@/components/MobileHeader";
import { getCurrentPosition, haversineDistance, formatCoords } from "@/lib/gps";
import { addToQueue, getQueueCount } from "@/lib/offline";
import { savePatrolLog, updateGuardSession, subscribeCheckpoints, syncOfflineQueue } from "@/lib/firestore";
import { db } from "@/firebase";
import type { Checkpoint, PatrolLog, GpsCoords } from "@/types";

interface GuardPatrolProps {
  guardId: string;
  guardName: string;
  onLogout: () => void;
}

export default function GuardPatrol({ guardId, guardName, onLogout }: GuardPatrolProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [scanning, setScanning] = useState(false);
  const [gps, setGps] = useState<GpsCoords | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(getQueueCount());
  const [recentLogs, setRecentLogs] = useState<PatrolLog[]>([]);
  const [scanResult, setScanResult] = useState<{ ok: boolean; title: string; msg: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    const onOnline = () => { setOnline(true); handleSync(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  useEffect(() => {
    if (!db) return;
    return subscribeCheckpoints(setCheckpoints);
  }, []);

  useEffect(() => { fetchGps(); }, []);

  const fetchGps = async () => {
    setGpsLoading(true);
    setGpsError("");
    try {
      const coords = await getCurrentPosition();
      setGps(coords);
      if (db) updateGuardSession({ guardId, guardName, lastSeen: Date.now(), lastCheckpoint: recentLogs[0]?.checkpointName ?? "—", lastGps: coords, status: "active" });
    } catch {
      setGpsError("GPS در دسترس نیست");
    } finally {
      setGpsLoading(false);
    }
  };

  const handleSync = useCallback(async () => {
    if (!online || !db) return;
    setSyncing(true);
    await syncOfflineQueue();
    setQueueCount(getQueueCount());
    setSyncing(false);
  }, [online]);

  const startScanner = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader-guard");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text: string) => handleQrScan(text),
        () => {}
      );
    } catch {
      setScanResult({ ok: false, title: "دسترسی به دوربین رد شد", msg: "لطفاً دسترسی دوربین را در تنظیمات مرورگر فعال کنید." });
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

  const handleQrScan = async (qrText: string) => {
    await stopScanner();

    const checkpoint = checkpoints.find((cp) => cp.qrCode === qrText) ?? null;
    const now = Date.now();
    const nowText = new Date(now).toLocaleString("fa-IR");

    // GPS check
    if (!gps) {
      setScanResult({ ok: false, title: "موقعیت GPS دریافت نشد", msg: "لطفاً GPS دستگاه را فعال کنید و دوباره تلاش نمایید." });
      return;
    }

    if (!checkpoint) {
      setScanResult({ ok: false, title: "کد QR ناشناس", msg: `این کد در سیستم ثبت نشده است: ${qrText.slice(0, 30)}...` });
      return;
    }

    const distance = Math.round(haversineDistance(gps.lat, gps.lng, checkpoint.lat, checkpoint.lng));
    const withinRadius = distance <= checkpoint.radiusMeters;

    const log: PatrolLog = {
      guardId, guardName,
      checkpointId: checkpoint.id,
      checkpointName: checkpoint.name,
      qrScanned: qrText,
      gps,
      distanceMeters: distance,
      withinRadius,
      scannedAt: now,
      scannedAtText: nowText,
      synced: false,
    };

    setRecentLogs((prev) => [log, ...prev.slice(0, 9)]);

    if (!withinRadius) {
      setScanResult({
        ok: false,
        title: "خارج از محدوده مجاز",
        msg: `شما ${distance} متر از ایستگاه فاصله دارید. حداکثر مجاز: ${checkpoint.radiusMeters} متر.`,
      });
      // Still log the failed attempt
    } else {
      setScanResult({
        ok: true,
        title: `ایستگاه "${checkpoint.name}" تأیید شد`,
        msg: `فاصله: ${distance} متر · دقت GPS: ±${Math.round(gps.accuracy)} متر`,
      });
    }

    // Save or queue
    if (online && db) {
      try {
        await savePatrolLog({ ...log, synced: true });
        updateGuardSession({ guardId, guardName, lastSeen: now, lastCheckpoint: checkpoint.name, lastGps: gps, status: "active" });
      } catch {
        addToQueue(log);
        setQueueCount(getQueueCount());
      }
    } else {
      addToQueue(log);
      setQueueCount(getQueueCount());
    }

    fetchGps();
  };

  return (
    <div className="min-h-screen bg-background arc-grid-bg flex flex-col">
      <MobileHeader title="ARC Guard" subtitle={guardName} notificationCount={queueCount} />

      <div className="flex-1 p-4 space-y-3 max-w-lg mx-auto w-full">

        {/* Status strip */}
        <div className="flex gap-2">
          <div className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium ${online ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
            {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {online ? "آنلاین" : "آفلاین"}
          </div>
          <div className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium ${gps ? "border-primary/30 bg-primary/10 text-primary" : "border-muted-foreground/20 bg-muted text-muted-foreground"}`}>
            <MapPin className="w-3.5 h-3.5" />
            {gpsLoading ? "در حال جستجو..." : gps ? `±${Math.round(gps.accuracy)} متر` : gpsError || "بدون GPS"}
          </div>
          {queueCount > 0 && (
            <button onClick={handleSync}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-xs font-medium">
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {queueCount} در صف
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
            <p className="text-xs text-muted-foreground">شناسه: {guardId.slice(-8)}</p>
            {gps && <p className="text-xs text-primary/70 mt-0.5 font-mono">{formatCoords(gps)}</p>}
          </div>
          <button onClick={onLogout} className="flex items-center gap-1 text-xs text-destructive/80 hover:text-destructive transition-colors">
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

        {/* Scanner button / camera */}
        {!scanning ? (
          <button onClick={startScanner}
            className="w-full rounded-xl border-2 border-dashed border-primary/40 hover:border-primary/70 bg-primary/5 hover:bg-primary/10 transition-all p-7 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center animate-glow-pulse">
              <QrCode className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-primary">اسکن ایستگاه</p>
              <p className="text-xs text-muted-foreground mt-1">برای باز شدن دوربین اینجا ضربه بزنید</p>
            </div>
          </button>
        ) : (
          <div className="rounded-xl border border-primary/40 bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-primary/5">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Camera className="w-4 h-4" />
                در حال اسکن...
              </div>
              <button onClick={stopScanner} className="text-muted-foreground hover:text-foreground transition-colors">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div id="qr-reader-guard" style={{ background: "#fff" }} />
          </div>
        )}

        {/* Scan result */}
        {scanResult && (
          <div className={`rounded-xl border p-4 flex items-start gap-3 animate-fade-in-up ${scanResult.ok ? "border-green-500/30 bg-green-500/10" : "border-destructive/30 bg-destructive/10"}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${scanResult.ok ? "bg-green-500/20" : "bg-destructive/20"}`}>
              {scanResult.ok ? <CheckCircle className="w-5 h-5 text-green-400" /> : <AlertTriangle className="w-5 h-5 text-destructive" />}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-bold ${scanResult.ok ? "text-green-400" : "text-destructive"}`}>{scanResult.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{scanResult.msg}</p>
              {!online && <p className="text-xs text-yellow-400 mt-1.5 flex items-center gap-1"><WifiOff className="w-3 h-3" />آفلاین ذخیره شد — با اتصال اینترنت همگام‌سازی می‌شود</p>}
            </div>
          </div>
        )}

        {/* Checkpoint list */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">ایستگاه‌های گشت ({checkpoints.length})</span>
          </div>
          {checkpoints.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              ایستگاهی توسط مدیر تنظیم نشده است.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {checkpoints.map((cp) => {
                const visited = recentLogs.some((l) => l.checkpointId === cp.id && l.withinRadius);
                const failed = recentLogs.some((l) => l.checkpointId === cp.id && !l.withinRadius);
                return (
                  <div key={cp.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${
                      visited ? "bg-green-500/15 border-green-500/40" :
                      failed ? "bg-destructive/15 border-destructive/40" :
                      "bg-muted border-border"
                    }`}>
                      {visited ? <CheckCircle className="w-4 h-4 text-green-400" /> :
                       failed ? <AlertTriangle className="w-4 h-4 text-destructive" /> :
                       <MapPin className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${visited ? "text-green-400" : failed ? "text-destructive" : "text-foreground"}`}>{cp.name}</p>
                      {cp.location && <p className="text-xs text-muted-foreground truncate">{cp.location}</p>}
                    </div>
                    <div className="text-left shrink-0 space-y-0.5">
                      <p className={`text-xs font-semibold ${visited ? "text-green-400" : failed ? "text-destructive" : "text-muted-foreground"}`}>
                        {visited ? "✓ انجام شد" : failed ? "✗ ناموفق" : "در انتظار"}
                      </p>
                      <p className="text-xs text-muted-foreground">{cp.radiusMeters} م</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent logs */}
        {recentLogs.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-bold text-foreground">آخرین اسکن‌ها</span>
            </div>
            <div className="divide-y divide-border">
              {recentLogs.slice(0, 5).map((log, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${log.withinRadius ? "bg-green-400" : "bg-destructive"}`} />
                  <p className="text-xs text-muted-foreground flex-1 truncate">
                    <span className="text-foreground font-medium">{log.checkpointName}</span>
                    {log.distanceMeters !== null && <span> · {log.distanceMeters} متر</span>}
                  </p>
                  <span className={`text-xs font-medium ${log.withinRadius ? "text-green-400" : "text-destructive"}`}>
                    {log.withinRadius ? "موفق" : "ناموفق"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Refresh GPS */}
        <button onClick={fetchGps} disabled={gpsLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${gpsLoading ? "animate-spin" : ""}`} />
          {gpsLoading ? "در حال دریافت موقعیت..." : "بروزرسانی موقعیت GPS"}
        </button>

        {!db && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-400">
            Firebase پیکربندی نشده — اسکن‌ها فقط بصورت محلی ذخیره می‌شوند.
          </div>
        )}
      </div>
    </div>
  );
}
