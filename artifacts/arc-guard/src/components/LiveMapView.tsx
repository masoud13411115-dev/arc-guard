import { useEffect, useRef, useState, useCallback } from "react";
import type { Map as LeafletMap, Marker, Polyline, Circle, LayerGroup } from "leaflet";
import {
  Users, MapPin, RefreshCw, Filter, Clock,
  CheckCircle, AlertTriangle, Wifi, WifiOff, Eye
} from "lucide-react";
import type { GuardSession, Checkpoint, PatrolLog } from "@/types";

interface LiveMapViewProps {
  sessions: GuardSession[];
  checkpoints: Checkpoint[];
  logs: PatrolLog[];
  isDemo: boolean;
}

type TimeFilter = "1h" | "6h" | "24h" | "all";
type GuardFilter = "all" | string;

// ── Color helpers ────────────────────────────────────────────────────────────
function guardColor(session: GuardSession): string {
  if (session.status === "offline") return "#64748b";
  if (session.status === "idle") return "#f59e0b";
  return "#22c55e"; // active
}

function statusBg(session: GuardSession): string {
  if (session.status === "offline") return "#1e293b";
  if (session.status === "idle") return "#451a03";
  return "#052e16";
}

// Inject Leaflet CSS once
function injectLeafletCss() {
  if (document.getElementById("leaflet-css")) return;
  const link = document.createElement("link");
  link.id = "leaflet-css";
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}

// ── Guard HTML marker ────────────────────────────────────────────────────────
function guardMarkerHtml(session: GuardSession): string {
  const color = guardColor(session);
  const initial = session.guardName.charAt(0);
  return `
    <div style="
      width:38px;height:38px;border-radius:50%;
      background:${statusBg(session)};
      border:3px solid ${color};
      display:flex;align-items:center;justify-content:center;
      color:${color};font-weight:800;font-size:15px;font-family:sans-serif;
      box-shadow:0 0 12px ${color}80;
      position:relative;
    ">
      ${initial}
      <span style="
        position:absolute;bottom:-2px;right:-2px;
        width:11px;height:11px;border-radius:50%;
        background:${color};border:2px solid #0a1628;
      "></span>
    </div>`;
}

// ── Checkpoint HTML marker ───────────────────────────────────────────────────
function checkpointMarkerHtml(cp: Checkpoint): string {
  return `
    <div style="
      width:32px;height:32px;border-radius:8px;
      background:#0c2340;border:2px solid #0ea5e9;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 0 10px rgba(14,165,233,0.4);
    ">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
      </svg>
    </div>`;
}

// ── Popup HTML for guard ─────────────────────────────────────────────────────
function guardPopupHtml(s: GuardSession): string {
  const ago = Math.round((Date.now() - s.lastSeen) / 60000);
  const statusLabel = s.status === "active" ? "فعال" : s.status === "idle" ? "بی‌تحرک" : "آفلاین";
  const acc = s.lastGps ? `±${Math.round(s.lastGps.accuracy)} متر` : "نامشخص";
  return `
    <div style="font-family:sans-serif;direction:rtl;min-width:180px;">
      <p style="font-weight:800;font-size:14px;margin:0 0 4px">${s.guardName}</p>
      <p style="font-size:11px;color:#64748b;margin:0 0 6px">${s.lastCheckpoint}</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <span style="background:#1e293b;padding:2px 8px;border-radius:99px;font-size:11px;">${statusLabel}</span>
        <span style="background:#1e293b;padding:2px 8px;border-radius:99px;font-size:11px;">دقت: ${acc}</span>
        <span style="background:#1e293b;padding:2px 8px;border-radius:99px;font-size:11px;">${ago === 0 ? "همین الان" : ago + " دقیقه پیش"}</span>
      </div>
    </div>`;
}

// ── Popup HTML for checkpoint ────────────────────────────────────────────────
function checkpointPopupHtml(cp: Checkpoint): string {
  return `
    <div style="font-family:sans-serif;direction:rtl;min-width:160px;">
      <p style="font-weight:800;font-size:14px;margin:0 0 3px">${cp.name}</p>
      ${cp.location ? `<p style="font-size:11px;color:#64748b;margin:0 0 5px">${cp.location}</p>` : ""}
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <span style="background:#0c2340;color:#38bdf8;padding:2px 8px;border-radius:99px;font-size:11px;">شعاع: ${cp.radiusMeters} متر</span>
        <span style="background:#0c2340;color:#38bdf8;padding:2px 8px;border-radius:99px;font-size:11px;">بازه: ${cp.patrolIntervalMinutes < 60 ? cp.patrolIntervalMinutes + " دقیقه" : (cp.patrolIntervalMinutes / 60) + " ساعت"}</span>
      </div>
    </div>`;
}

// ── Guard path colors ────────────────────────────────────────────────────────
const PATH_COLORS = [
  "#22c55e","#0ea5e9","#a855f7","#f59e0b","#ef4444","#06b6d4","#f97316",
];

export default function LiveMapView({ sessions, checkpoints, logs, isDemo }: LiveMapViewProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const guardLayerRef = useRef<LayerGroup | null>(null);
  const cpLayerRef = useRef<LayerGroup | null>(null);
  const pathLayerRef = useRef<LayerGroup | null>(null);
  const initialFitRef = useRef(false);

  const [guardFilter, setGuardFilter] = useState<GuardFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("6h");
  const [showPaths, setShowPaths] = useState(true);
  const [showCheckpoints, setShowCheckpoints] = useState(true);
  const [selectedGuard, setSelectedGuard] = useState<GuardSession | null>(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    injectLeafletCss();
    if (!mapDivRef.current || mapRef.current) return;

    const initMap = async () => {
      const L = (await import("leaflet")).default;

      const map = L.map(mapDivRef.current!, {
        center: [35.6892, 51.389],
        zoom: 15,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      guardLayerRef.current = L.layerGroup().addTo(map);
      cpLayerRef.current = L.layerGroup().addTo(map);
      pathLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      setLastRefresh(Date.now()); // trigger marker update
    };

    initMap();
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; initialFitRef.current = false; }
    };
  }, []);

  // ── Filter helpers ───────────────────────────────────────────────────────────
  const cutoffMs = useCallback((): number => {
    const h = { "1h": 1, "6h": 6, "24h": 24, "all": 9999 }[timeFilter];
    return Date.now() - h * 3600 * 1000;
  }, [timeFilter]);

  const filteredSessions = sessions.filter(
    (s) => guardFilter === "all" || s.guardId === guardFilter
  );

  const filteredLogs = logs.filter(
    (l) => (guardFilter === "all" || l.guardId === guardFilter) && l.scannedAt >= cutoffMs()
  );

  // ── Update markers whenever data or filters change ───────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const initMarkers = async () => {
      const L = (await import("leaflet")).default;

      // ── Guard markers ──────────────────────────────────────────────────────
      guardLayerRef.current?.clearLayers();
      const guardPositions: [number, number][] = [];

      filteredSessions.forEach((s) => {
        if (!s.lastGps) return;
        const { lat, lng } = s.lastGps;
        guardPositions.push([lat, lng]);

        const icon = L.divIcon({
          html: guardMarkerHtml(s),
          iconSize: [38, 38],
          iconAnchor: [19, 19],
          popupAnchor: [0, -22],
          className: "",
        });

        L.marker([lat, lng], { icon })
          .bindPopup(guardPopupHtml(s), { className: "arc-popup", maxWidth: 240 })
          .addTo(guardLayerRef.current!);
      });

      // ── Checkpoint markers & radius circles ────────────────────────────────
      cpLayerRef.current?.clearLayers();
      const cpPositions: [number, number][] = [];

      if (showCheckpoints) {
        checkpoints.forEach((cp) => {
          cpPositions.push([cp.lat, cp.lng]);

          const icon = L.divIcon({
            html: checkpointMarkerHtml(cp),
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -18],
            className: "",
          });

          L.marker([cp.lat, cp.lng], { icon })
            .bindPopup(checkpointPopupHtml(cp), { className: "arc-popup", maxWidth: 220 })
            .addTo(cpLayerRef.current!);

          // Radius circle
          L.circle([cp.lat, cp.lng], {
            radius: cp.radiusMeters,
            color: "#0ea5e9",
            fillColor: "#0ea5e9",
            fillOpacity: 0.08,
            weight: 1.5,
            dashArray: "5 4",
          }).addTo(cpLayerRef.current!);
        });
      }

      // ── Patrol paths ───────────────────────────────────────────────────────
      pathLayerRef.current?.clearLayers();

      if (showPaths) {
        const guardIds = guardFilter === "all"
          ? [...new Set(filteredLogs.map((l) => l.guardId))]
          : [guardFilter];

        guardIds.forEach((gid, idx) => {
          const guardLogs = filteredLogs
            .filter((l) => l.guardId === gid && l.gps)
            .sort((a, b) => a.scannedAt - b.scannedAt);

          if (guardLogs.length < 2) return;

          const points: [number, number][] = guardLogs
            .map((l) => [l.gps!.lat, l.gps!.lng] as [number, number]);

          const color = PATH_COLORS[idx % PATH_COLORS.length];
          L.polyline(points, {
            color,
            weight: 3,
            opacity: 0.7,
            dashArray: "8 4",
          }).addTo(pathLayerRef.current!);

          // Scan dots on the path
          guardLogs.forEach((l) => {
            const dotColor = l.status === "valid" ? "#22c55e" : l.status === "outside" ? "#f59e0b" : "#ef4444";
            L.circleMarker([l.gps!.lat, l.gps!.lng], {
              radius: 5,
              color: dotColor,
              fillColor: dotColor,
              fillOpacity: 0.9,
              weight: 1.5,
            })
              .bindPopup(`
                <div style="font-family:sans-serif;direction:rtl;font-size:12px;">
                  <b>${l.guardName}</b><br/>
                  ${l.checkpointName}<br/>
                  <span style="color:${dotColor}">${l.status === "valid" ? "✓ معتبر" : l.status === "outside" ? "⚠ خارج" : "✗ ناموفق"}</span>
                  <br/><span style="color:#64748b">${l.scannedAtText}</span>
                </div>`, { className: "arc-popup" })
              .addTo(pathLayerRef.current!);
          });
        });
      }

      // ── Auto-fit bounds (only once on initial load) ────────────────────────
      if (!initialFitRef.current) {
        const allPts = [...guardPositions, ...cpPositions];
        if (allPts.length > 0) {
          const bounds = L.latLngBounds(allPts);
          map.fitBounds(bounds.pad(0.25));
          initialFitRef.current = true;
        }
      }
    };

    initMarkers();
  }, [filteredSessions, filteredLogs, checkpoints, showPaths, showCheckpoints, guardFilter, lastRefresh]);

  const refresh = () => setLastRefresh(Date.now());

  const uniqueGuards = [...new Map(sessions.map((s) => [s.guardId, s])).values()];

  return (
    <div className="flex flex-col gap-3" dir="rtl">

      {/* ── Filter bar ── */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Guard filter */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <select
              value={guardFilter}
              onChange={(e) => setGuardFilter(e.target.value)}
              className="flex-1 bg-muted border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
            >
              <option value="all">همه نگهبانان</option>
              {uniqueGuards.map((s) => (
                <option key={s.guardId} value={s.guardId}>{s.guardName}</option>
              ))}
            </select>
          </div>

          {/* Time filter */}
          <div className="flex items-center gap-1">
            {(["1h","6h","24h","all"] as TimeFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setTimeFilter(t)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  timeFilter === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {t === "all" ? "همه" : t}
              </button>
            ))}
          </div>

          <button onClick={refresh} className="p-1.5 rounded-lg bg-muted hover:bg-accent transition-colors">
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showPaths}
              onChange={(e) => setShowPaths(e.target.checked)}
              className="accent-primary"
            />
            <span className="text-xs text-muted-foreground">مسیر گشت</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showCheckpoints}
              onChange={(e) => setShowCheckpoints(e.target.checked)}
              className="accent-primary"
            />
            <span className="text-xs text-muted-foreground">ایستگاه‌ها</span>
          </label>
          {isDemo && (
            <span className="text-[10px] text-yellow-400/80 bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-0.5">
              داده نمونه
            </span>
          )}
        </div>
      </div>

      {/* ── Map container ── */}
      <div className="relative rounded-xl border border-border overflow-hidden" style={{ height: "420px" }}>
        <div ref={mapDivRef} style={{ height: "100%", width: "100%", background: "#0a1628" }} />

        {/* Legend overlay */}
        <div className="absolute bottom-3 right-3 z-[1000] bg-card/90 backdrop-blur border border-border rounded-lg px-3 py-2 space-y-1.5">
          <p className="text-[10px] font-bold text-muted-foreground">راهنما</p>
          {[
            { color: "#22c55e", label: "نگهبان فعال" },
            { color: "#f59e0b", label: "نگهبان بی‌تحرک" },
            { color: "#64748b", label: "آفلاین" },
            { color: "#0ea5e9", label: "ایستگاه" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 shrink-0" style={{ background: "#22c55e", borderTop: "2px dashed #22c55e" }} />
            <span className="text-[10px] text-muted-foreground">مسیر گشت</span>
          </div>
        </div>
      </div>

      {/* ── Guard status cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {filteredSessions.map((s) => {
          const ago = Math.round((Date.now() - s.lastSeen) / 60000);
          const color = guardColor(s);
          const recentLog = filteredLogs
            .filter((l) => l.guardId === s.guardId)
            .sort((a, b) => b.scannedAt - a.scannedAt)[0];

          return (
            <button
              key={s.guardId}
              onClick={() => {
                setSelectedGuard(selectedGuard?.guardId === s.guardId ? null : s);
                setGuardFilter(s.guardId);
              }}
              className={`text-right rounded-xl border bg-card p-3 flex items-start gap-3 hover:border-primary/30 transition-colors ${
                selectedGuard?.guardId === s.guardId ? "border-primary/50 bg-primary/5" : "border-border"
              }`}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5"
                style={{ background: statusBg(s), border: `2px solid ${color}`, color }}
              >
                {s.guardName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-foreground">{s.guardName}</p>
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.lastCheckpoint}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {ago === 0 ? "همین الان" : `${ago} دقیقه پیش`}
                  </span>
                  {s.lastGps && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" />
                      ±{Math.round(s.lastGps.accuracy)} متر
                    </span>
                  )}
                  {recentLog && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      recentLog.status === "valid" ? "bg-green-500/10 text-green-400" :
                      recentLog.status === "outside" ? "bg-yellow-500/10 text-yellow-400" :
                      "bg-destructive/10 text-destructive"
                    }`}>
                      {recentLog.status === "valid" ? "✓ معتبر" : recentLog.status === "outside" ? "⚠ خارج" : "✗ ناموفق"}
                    </span>
                  )}
                </div>
              </div>
              <Eye className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-1" />
            </button>
          );
        })}
      </div>

      {filteredSessions.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center gap-2">
          <Users className="w-8 h-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">هیچ نگهبانی در این بازه یافت نشد</p>
        </div>
      )}

      {/* Scan dots legend */}
      {showPaths && filteredLogs.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs font-bold text-muted-foreground mb-2">نقاط اسکن روی مسیر</p>
          <div className="flex items-center gap-4 flex-wrap">
            {[
              { color: "#22c55e", label: "اسکن معتبر", count: filteredLogs.filter(l=>l.status==="valid").length },
              { color: "#f59e0b", label: "خارج از محدوده", count: filteredLogs.filter(l=>l.status==="outside").length },
              { color: "#ef4444", label: "ناموفق", count: filteredLogs.filter(l=>l.status==="failed").length },
            ].map(({ color, label, count }) => count > 0 && (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                <span className="text-xs text-muted-foreground">{label} ({count})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
