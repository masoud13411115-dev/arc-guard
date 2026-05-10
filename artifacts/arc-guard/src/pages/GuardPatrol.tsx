import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  QrCode, MapPin, Wifi, WifiOff, CheckCircle, AlertTriangle,
  Clock, Shield, LogOut, RefreshCw, Camera, XCircle
} from "lucide-react";
import MobileHeader from "@/components/MobileHeader";
import { getCurrentPosition, haversineDistance, formatCoords } from "@/lib/gps";
import { addToQueue, getQueueCount } from "@/lib/offline";
import { syncOfflineQueue } from "@/lib/firestore";
import { savePatrolLog, updateGuardSession, subscribeCheckpoints } from "@/lib/firestore";
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
  const [lastLog, setLastLog] = useState<PatrolLog | null>(null);
  const [scanResult, setScanResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivRef = useRef<HTMLDivElement>(null);

  // Online status
  useEffect(() => {
    const onOnline = () => { setOnline(true); handleSync(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  // Subscribe to checkpoints
  useEffect(() => {
    if (!db) return;
    const unsub = subscribeCheckpoints(setCheckpoints);
    return unsub;
  }, []);

  // Auto-fetch GPS on mount
  useEffect(() => {
    fetchGps();
  }, []);

  const fetchGps = async () => {
    setGpsLoading(true);
    setGpsError("");
    try {
      const coords = await getCurrentPosition();
      setGps(coords);
      if (db) {
        updateGuardSession({
          guardId, guardName,
          lastSeen: Date.now(),
          lastCheckpoint: lastLog?.checkpointName ?? "—",
          lastGps: coords,
          status: "active",
        });
      }
    } catch {
      setGpsError("GPS unavailable");
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
    if (!scannerDivRef.current) return;
    setScanning(true);
    setScanResult(null);
    const scanner = new Html5Qrcode("qr-reader-guard");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => { handleQrScan(decodedText); },
        () => {}
      );
    } catch {
      setScanResult({ ok: false, msg: "Camera access denied. Please allow camera permissions." });
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

    // Find matching checkpoint
    const checkpoint = checkpoints.find((cp) => cp.qrCode === qrText) ?? null;
    const now = Date.now();
    const nowText = new Date(now).toLocaleString("en-GB");

    let distance: number | null = null;
    let withinRadius = true;

    if (gps && checkpoint) {
      distance = Math.round(haversineDistance(gps.lat, gps.lng, checkpoint.lat, checkpoint.lng));
      withinRadius = distance <= checkpoint.radiusMeters;
    }

    const log: PatrolLog = {
      guardId, guardName,
      checkpointId: checkpoint?.id ?? "unknown",
      checkpointName: checkpoint?.name ?? `Unknown (${qrText.slice(0, 16)})`,
      qrScanned: qrText,
      gps,
      distanceMeters: distance,
      withinRadius,
      scannedAt: now,
      scannedAtText: nowText,
      synced: false,
    };

    setLastLog(log);

    if (!checkpoint) {
      setScanResult({ ok: false, msg: "Unknown QR code — not a registered checkpoint." });
      return;
    }

    if (!withinRadius && distance !== null) {
      setScanResult({ ok: false, msg: `Outside checkpoint radius (${distance}m away, max ${checkpoint.radiusMeters}m).` });
    } else {
      setScanResult({ ok: true, msg: `Checkpoint "${checkpoint.name}" verified!` });
    }

    // Save or queue
    if (online && db) {
      try {
        await savePatrolLog({ ...log, synced: true });
        if (db) {
          updateGuardSession({
            guardId, guardName,
            lastSeen: now,
            lastCheckpoint: checkpoint.name,
            lastGps: gps,
            status: "active",
          });
        }
      } catch {
        addToQueue(log);
        setQueueCount(getQueueCount());
      }
    } else {
      addToQueue(log);
      setQueueCount(getQueueCount());
    }

    // Refresh GPS after scan
    fetchGps();
  };

  const todayLogs = checkpoints.map((cp) => ({
    ...cp,
    visited: lastLog?.checkpointId === cp.id,
  }));

  return (
    <div className="min-h-screen bg-background arc-grid-bg flex flex-col">
      <MobileHeader
        title="ARC Guard"
        subtitle={guardName}
        notificationCount={queueCount}
      />

      <div className="flex-1 p-4 space-y-4 max-w-lg mx-auto w-full">
        {/* Status Bar */}
        <div className="flex gap-2">
          <div className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${
            online ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}>
            {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {online ? "Online" : "Offline"}
          </div>
          <div className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${
            gps ? "border-primary/30 bg-primary/10 text-primary" : "border-muted-foreground/30 bg-muted text-muted-foreground"
          }`}>
            <MapPin className="w-3.5 h-3.5" />
            {gpsLoading ? "Locating..." : gps ? `±${Math.round(gps.accuracy)}m` : gpsError || "No GPS"}
          </div>
          {queueCount > 0 && (
            <button
              onClick={handleSync}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-xs font-medium"
            >
              {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {queueCount} queued
            </button>
          )}
        </div>

        {/* Guard Info */}
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-bold">
            {guardName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{guardName}</p>
            <p className="text-xs text-muted-foreground">Guard ID: {guardId}</p>
            {gps && <p className="text-xs text-muted-foreground mt-0.5">{formatCoords(gps)}</p>}
          </div>
          <button onClick={onLogout} className="text-xs text-destructive flex items-center gap-1">
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>

        {/* QR Scanner */}
        {!scanning ? (
          <button
            onClick={startScanner}
            className="w-full rounded-xl border border-primary/40 bg-primary/10 hover:bg-primary/20 transition-colors p-6 flex flex-col items-center gap-3"
            style={{ boxShadow: "0 0 30px rgba(14,165,233,0.1)" }}
          >
            <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center animate-glow-pulse">
              <QrCode className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-primary tracking-wide">Scan Checkpoint QR</p>
              <p className="text-xs text-muted-foreground mt-1">Tap to open camera scanner</p>
            </div>
          </button>
        ) : (
          <div className="rounded-xl border border-primary/40 bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Camera className="w-4 h-4" />
                Camera Scanning...
              </div>
              <button onClick={stopScanner} className="text-muted-foreground hover:text-foreground">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            {/* QR camera preview — must be white bg for html5-qrcode */}
            <div id="qr-reader-guard" ref={scannerDivRef} style={{ background: "#fff" }} />
          </div>
        )}

        {/* Scan Result */}
        {scanResult && (
          <div className={`rounded-xl border p-4 flex items-start gap-3 animate-fade-in-up ${
            scanResult.ok
              ? "border-green-500/30 bg-green-500/10"
              : "border-destructive/30 bg-destructive/10"
          }`}>
            {scanResult.ok
              ? <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
              : <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            }
            <div>
              <p className={`text-sm font-semibold ${scanResult.ok ? "text-green-400" : "text-destructive"}`}>
                {scanResult.ok ? "Checkpoint Verified" : "Scan Failed"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{scanResult.msg}</p>
              {lastLog && (
                <p className="text-xs text-muted-foreground mt-1">
                  {lastLog.scannedAtText} · {lastLog.gps ? `GPS ±${Math.round(lastLog.gps.accuracy)}m` : "No GPS"}
                  {lastLog.distanceMeters !== null && ` · ${lastLog.distanceMeters}m from checkpoint`}
                </p>
              )}
              {!online && <p className="text-xs text-yellow-400 mt-1">Saved offline — will sync when connected</p>}
            </div>
          </div>
        )}

        {/* Checkpoint List */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Today's Checkpoints ({checkpoints.length})
            </span>
          </div>
          {checkpoints.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No checkpoints assigned. Ask your manager to configure checkpoints.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {checkpoints.map((cp) => {
                const visited = lastLog?.checkpointId === cp.id;
                return (
                  <div key={cp.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${
                      visited
                        ? "bg-green-500/15 border-green-500/30"
                        : "bg-muted border-border"
                    }`}>
                      {visited
                        ? <CheckCircle className="w-4 h-4 text-green-400" />
                        : <MapPin className="w-4 h-4 text-muted-foreground" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${visited ? "text-green-400" : "text-foreground"}`}>
                        {cp.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{cp.location}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-medium ${visited ? "text-green-400" : "text-muted-foreground"}`}>
                        {visited ? "Done" : "Pending"}
                      </p>
                      <p className="text-xs text-muted-foreground">r: {cp.radiusMeters}m</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Refresh GPS */}
        <button
          onClick={fetchGps}
          disabled={gpsLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${gpsLoading ? "animate-spin" : ""}`} />
          {gpsLoading ? "Getting location..." : "Refresh GPS"}
        </button>

        {/* Firebase warning */}
        {!db && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-400">
            Firebase not configured — logs will be saved offline only.
          </div>
        )}
      </div>
    </div>
  );
}
