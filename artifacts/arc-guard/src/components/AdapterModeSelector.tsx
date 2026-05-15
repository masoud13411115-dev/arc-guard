import { useState } from "react";
import { Server, Cloud, HardDrive, AlertTriangle, RefreshCw, CheckCircle, XCircle, Wifi } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  getAdapterMode,
  setAdapterMode,
  getLocalServerUrl,
  setLocalServerUrl,
  testLocalServerConnection,
  type AdapterMode,
} from "@/lib/adapter";
import { isFirebaseReady } from "@/firebase";

export default function AdapterModeSelector() {
  const { t, isRTL } = useI18n();
  const [mode, setMode]             = useState<AdapterMode>(getAdapterMode);
  const [confirming, setConfirming] = useState(false);
  const [pendingMode, setPending]   = useState<AdapterMode | null>(null);
  const [switching, setSwitching]   = useState(false);

  const [serverUrl, setServerUrl]   = useState(getLocalServerUrl);
  const [urlSaved, setUrlSaved]     = useState(false);
  const [testing, setTesting]       = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);

  function requestSwitch(next: AdapterMode) {
    if (next === mode) return;
    setPending(next);
    setConfirming(true);
  }

  function confirmSwitch() {
    if (!pendingMode) return;
    setSwitching(true);
    setMode(pendingMode);
    setAdapterMode(pendingMode);
    setConfirming(false);
  }

  function cancelSwitch() {
    setConfirming(false);
    setPending(null);
  }

  function saveServerUrl() {
    setLocalServerUrl(serverUrl);
    setUrlSaved(true);
    setTestResult(null);
    setTimeout(() => setUrlSaved(false), 2500);
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    setLocalServerUrl(serverUrl);
    const ok = await testLocalServerConnection();
    setTestResult(ok ? "ok" : "fail");
    setTesting(false);
  }

  const firebaseMissing = mode === "firebase" && !isFirebaseReady;

  const options: {
    id: AdapterMode;
    labelKey: string;
    subKey: string;
    icon: React.ElementType;
    activeClass: string;
  }[] = [
    {
      id:          "firebase",
      labelKey:    "adapter.cloud",
      subKey:      "adapter.mode.firebase.sub",
      icon:        Cloud,
      activeClass: "border-sky-500 bg-sky-500/10 text-sky-400",
    },
    {
      id:          "indexeddb",
      labelKey:    "adapter.mode.indexeddb",
      subKey:      "adapter.mode.indexeddb.sub",
      icon:        HardDrive,
      activeClass: "border-green-500 bg-green-500/10 text-green-400",
    },
    {
      id:          "local",
      labelKey:    "adapter.local",
      subKey:      "adapter.mode.local.sub",
      icon:        Server,
      activeClass: "border-amber-500 bg-amber-500/10 text-amber-400",
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">

      {/* ── Header ── */}
      <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
        <Server className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold text-foreground flex-1">
          {t("adapter.storage.mode")}
        </span>
      </div>

      {/* ── Firebase missing warning ── */}
      {firebaseMissing && !confirming && (
        <div
          className={`flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs ${
            isRTL ? "flex-row-reverse text-right" : ""
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{t("adapter.firebase.missing")}</span>
        </div>
      )}

      {/* ── Mode buttons (3-column grid) ── */}
      <div className="grid grid-cols-3 gap-2">
        {options.map(({ id, labelKey, subKey, icon: Icon, activeClass }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              onClick={() => requestSwitch(id)}
              disabled={switching}
              className={[
                "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center",
                "disabled:opacity-50",
                active
                  ? activeClass
                  : "border-border text-muted-foreground hover:border-border/60 hover:bg-muted/20",
              ].join(" ")}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-semibold leading-tight">{t(labelKey)}</span>
              <span className="text-[10px] opacity-70 leading-tight">{t(subKey)}</span>
            </button>
          );
        })}
      </div>

      {/* ── IndexedDB mode info ── */}
      {mode === "indexeddb" && !confirming && (
        <div
          className={`flex items-start gap-2 p-2.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 text-xs ${
            isRTL ? "flex-row-reverse text-right" : ""
          }`}
        >
          <HardDrive className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{t("adapter.indexeddb.notice")}</span>
        </div>
      )}

      {/* ── Local server URL config ── */}
      {mode === "local" && !confirming && (
        <div className="space-y-2">
          <label className={`block text-xs text-muted-foreground ${isRTL ? "text-right" : ""}`}>
            {t("adapter.local.url.label")}
          </label>
          <input
            dir="ltr"
            type="url"
            value={serverUrl}
            onChange={(e) => {
              setServerUrl(e.target.value);
              setUrlSaved(false);
              setTestResult(null);
            }}
            placeholder={t("adapter.local.url.placeholder")}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground
                       text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary
                       placeholder:text-muted-foreground/50"
          />
          <p className={`text-[10px] text-muted-foreground/60 ${isRTL ? "text-right" : ""}`}>
            {t("adapter.local.url.hint")}
          </p>

          <div className={`flex gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
            <button
              onClick={saveServerUrl}
              className="flex-1 py-1.5 rounded-lg bg-primary/20 border border-primary/30 text-primary text-xs font-semibold"
            >
              {urlSaved ? t("adapter.local.url.saved") : t("adapter.local.url.save")}
            </button>
            <button
              onClick={runTest}
              disabled={testing || !serverUrl.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border
                         border-border text-muted-foreground text-xs disabled:opacity-50"
            >
              {testing
                ? <RefreshCw className="w-3 h-3 animate-spin" />
                : <Wifi className="w-3 h-3" />
              }
              {t("adapter.local.url.test")}
            </button>
          </div>

          {testResult && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                testResult === "ok"
                  ? "bg-green-500/10 text-green-400 border border-green-500/30"
                  : "bg-red-500/10 text-red-400 border border-red-500/30"
              } ${isRTL ? "flex-row-reverse" : ""}`}
            >
              {testResult === "ok"
                ? <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                : <XCircle    className="w-3.5 h-3.5 shrink-0" />
              }
              {testResult === "ok" ? t("adapter.local.url.ok") : t("adapter.local.url.fail")}
            </div>
          )}
        </div>
      )}

      {/* ── Switch confirmation ── */}
      {confirming && pendingMode && (
        <div className="p-3 rounded-xl border border-border bg-card/80 space-y-2">
          <p className={`text-xs text-muted-foreground ${isRTL ? "text-right" : ""}`}>
            {t("adapter.mode.switch.confirm")}
          </p>
          <div className={`flex gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
            <button
              onClick={confirmSwitch}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg
                         bg-primary text-primary-foreground text-xs font-semibold"
            >
              {switching && <RefreshCw className="w-3 h-3 animate-spin" />}
              {t("common.yes")}
            </button>
            <button
              onClick={cancelSwitch}
              className="flex-1 py-1.5 rounded-lg border border-border text-muted-foreground text-xs"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
