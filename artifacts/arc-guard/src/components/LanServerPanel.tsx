/**
 * LanServerPanel — Manager UI for setting up LAN server mode.
 *
 * Shows:
 *   1. Device local IP address (detected via WebRTC ICE)
 *   2. Current server URL config + live connection status
 *   3. QR code of the server URL for guards to scan
 *   4. Copy-URL button
 *   5. Step-by-step setup guide
 *
 * Rendered inside CompanySettings when storage mode = local.
 */

import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Wifi, WifiOff, Server, Copy, Check, RefreshCw,
  ChevronDown, ChevronUp, Info, Monitor, Users, Shield,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getLocalServerUrl, testLocalServerConnection } from "@/lib/adapter/localAdapter";
import { getLocalIp } from "@/lib/deviceIp";
import { loadLastManagerProfile } from "@/lib/offlineAuth";

export default function LanServerPanel() {
  const { t, isRTL } = useI18n();

  const [deviceIp,    setDeviceIp]    = useState<string | null>(null);
  const [detectingIp, setDetectingIp] = useState(true);
  const [serverUrl,   setServerUrl_]  = useState(getLocalServerUrl);
  const [healthy,     setHealthy]     = useState<boolean | null>(null);
  const [testing,     setTesting]     = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [guideOpen,   setGuideOpen]   = useState(false);
  const [sessions,    setSessions]    = useState<Array<Record<string, unknown>>>([]);

  // ── Detect local IP ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setDetectingIp(true);
    getLocalIp().then((ip) => {
      if (!cancelled) { setDeviceIp(ip); setDetectingIp(false); }
    });
    return () => { cancelled = true; };
  }, []);

  // ── Auto-test connection on mount if URL is set ────────────────────────────
  const runTest = useCallback(async () => {
    setTesting(true);
    const ok = await testLocalServerConnection();
    setHealthy(ok);
    setTesting(false);
  }, []);

  useEffect(() => {
    if (serverUrl) runTest();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh serverUrl from localStorage each render
  useEffect(() => {
    const stored = getLocalServerUrl();
    if (stored !== serverUrl) setServerUrl_(stored);
  });

  // ── Poll connected guard sessions from LAN server ──────────────────────────
  // Uses serverUrl + deviceIp (not suggestedUrl) to avoid temporal dead zone.
  useEffect(() => {
    const profile = loadLastManagerProfile();
    const cid = profile?.companyId;
    const computed = serverUrl || (deviceIp ? `http://${deviceIp}:8080` : "");
    const base = computed.replace(/\/$/, "");
    if (!cid || !base) return;
    let active = true;
    const poll = async () => {
      try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 4_000);
        const res = await fetch(`${base}/api/${cid}/guard-sessions`, { signal: ctrl.signal });
        if (res.ok && active) {
          const data = await res.json() as { sessions?: Array<Record<string, unknown>> };
          setSessions(data.sessions ?? []);
        }
      } catch { /* ignore — server may be unreachable */ }
    };
    poll();
    const id = setInterval(poll, 5_000);
    return () => { active = false; clearInterval(id); };
  }, [serverUrl, deviceIp]);

  // ── Copy URL ───────────────────────────────────────────────────────────────
  const handleCopy = () => {
    if (!serverUrl) return;
    navigator.clipboard.writeText(serverUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const suggestedUrl = deviceIp ? `http://${deviceIp}:8080` : "";
  const qrUrl        = serverUrl || suggestedUrl;

  // QR content includes companyId so guard app can auto-fill both server URL and company
  const managerProfile = loadLastManagerProfile();
  const companyId      = managerProfile?.companyId;
  const qrContent      = qrUrl && companyId ? `${qrUrl}?company=${companyId}` : qrUrl;

  const connectionColor =
    healthy === true  ? "text-green-400"  :
    healthy === false ? "text-red-400"    : "text-muted-foreground";

  const connectionBg =
    healthy === true  ? "bg-green-500/10 border-green-500/30"  :
    healthy === false ? "bg-red-500/10 border-red-500/30"      : "bg-muted/20 border-border";

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-4">

      {/* ── Header ── */}
      <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
        <Server className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-sm font-semibold text-amber-300 flex-1">
          {t("lan.panel.title")}
        </span>
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${connectionBg} ${connectionColor}`}>
          {testing
            ? <RefreshCw className="w-3 h-3 animate-spin" />
            : healthy === true  ? <Wifi    className="w-3 h-3" />
            : healthy === false ? <WifiOff className="w-3 h-3" />
            : <Server className="w-3 h-3" />
          }
          <span>
            {testing
              ? "..."
              : healthy === true  ? t("lan.panel.connected")
              : healthy === false ? t("lan.panel.disconnected")
              : "LAN"
            }
          </span>
        </div>
      </div>

      {/* ── Device IP ── */}
      <div className={`flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border ${isRTL ? "flex-row-reverse" : ""}`}>
        <Monitor className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className={`text-[10px] text-muted-foreground/70 mb-0.5 ${isRTL ? "text-right" : ""}`}>
            {t("lan.panel.device.ip")}
          </div>
          <div className="font-mono text-sm text-foreground">
            {detectingIp
              ? <span className="text-muted-foreground animate-pulse">{t("lan.panel.ip.detecting")}</span>
              : deviceIp
              ? <span className="text-amber-300 select-all">{deviceIp}</span>
              : <span className="text-muted-foreground">{t("lan.panel.ip.unknown")}</span>
            }
          </div>
        </div>
        {deviceIp && (
          <button
            onClick={() => { navigator.clipboard.writeText(deviceIp).catch(() => {}); }}
            className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground"
            title="Copy IP"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Server URL + QR ── */}
      {qrUrl && (
        <div className="space-y-3">
          {/* URL row */}
          <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
            <div className="flex-1 min-w-0">
              <div className={`text-[10px] text-muted-foreground/70 mb-0.5 ${isRTL ? "text-right" : ""}`}>
                {t("lan.panel.server.url")}
              </div>
              <div
                dir="ltr"
                className="font-mono text-xs text-foreground truncate"
              >
                {qrUrl}
              </div>
            </div>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all shrink-0 ${
                copied
                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                  : "border-border text-muted-foreground hover:bg-muted/20"
              }`}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? t("lan.panel.copied") : t("lan.panel.copy.url")}
            </button>
            <button
              onClick={runTest}
              disabled={testing}
              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted/20 disabled:opacity-50"
              title="Test connection"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* QR code — encodes server URL + companyId */}
          <div className={`flex flex-col items-center gap-2 ${isRTL ? "" : ""}`}>
            <div className="p-3 rounded-xl bg-white inline-block">
              <QRCodeSVG
                value={qrContent || qrUrl}
                size={140}
                bgColor="#ffffff"
                fgColor="#0f172a"
                level="M"
              />
            </div>
            <p className={`text-[10px] text-muted-foreground/60 text-center ${isRTL ? "text-right" : ""}`}>
              {t("lan.panel.qr.hint")}
            </p>
          </div>
        </div>
      )}

      {/* ── Connected guard sessions ── */}
      {healthy === true && (
        <div className="border-t border-border/50 pt-3 space-y-2">
          <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
            <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-xs font-semibold text-amber-300 flex-1">{t("lan.panel.sessions")}</span>
            <span className="text-[10px] text-muted-foreground font-mono">{sessions.length}</span>
          </div>
          {sessions.length === 0 ? (
            <p className={`text-[11px] text-muted-foreground/60 ${isRTL ? "text-right" : ""}`}>
              {t("lan.panel.no.sessions")}
            </p>
          ) : (
            <ul className="space-y-1">
              {sessions.map((s, i) => {
                const name = (s.guardName ?? s.guardId ?? `Guard ${i + 1}`) as string;
                const ts   = s.updatedAt ? new Date(s.updatedAt as number).toLocaleTimeString("fa-IR") : "";
                return (
                  <li key={i} className={`flex items-center gap-2 text-[11px] text-muted-foreground ${isRTL ? "flex-row-reverse" : ""}`}>
                    <Shield className="w-3 h-3 text-green-400 shrink-0" />
                    <span className="flex-1 font-medium text-foreground/80">{name}</span>
                    {ts && <span className="font-mono text-[10px]">{ts}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ── Setup guide (collapsible) ── */}
      <div className="border-t border-border/50 pt-3 space-y-2">
        <button
          onClick={() => setGuideOpen((v) => !v)}
          className={`w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors ${isRTL ? "flex-row-reverse" : ""}`}
        >
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 font-semibold text-left rtl:text-right">{t("lan.panel.setup.title")}</span>
          {guideOpen ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
        </button>

        {guideOpen && (
          <ol className={`space-y-2 ${isRTL ? "text-right" : "text-left"}`}>
            {[1, 2, 3, 4].map((n) => (
              <li
                key={n}
                className={`flex items-start gap-2.5 text-xs text-muted-foreground ${isRTL ? "flex-row-reverse" : ""}`}
              >
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  {n}
                </span>
                <span className="leading-relaxed">
                  {t(`lan.panel.setup.step${n}`)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
