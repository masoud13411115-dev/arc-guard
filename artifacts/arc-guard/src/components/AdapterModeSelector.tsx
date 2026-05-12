import { useState } from "react";
import { Server, Cloud, AlertTriangle, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getAdapterMode, setAdapterMode, type AdapterMode } from "@/lib/adapter";

export default function AdapterModeSelector() {
  const { t, isRTL } = useI18n();
  const [mode, setMode]           = useState<AdapterMode>(getAdapterMode);
  const [confirming, setConfirming] = useState(false);
  const [pendingMode, setPending]   = useState<AdapterMode | null>(null);
  const [switching, setSwitching]   = useState(false);

  function requestSwitch(next: AdapterMode) {
    if (next === mode) return;
    setPending(next);
    setConfirming(true);
  }

  function confirmSwitch() {
    if (!pendingMode) return;
    setSwitching(true);
    setMode(pendingMode);
    setAdapterMode(pendingMode);   // persists + reloads after 200 ms
    setConfirming(false);
  }

  function cancelSwitch() {
    setConfirming(false);
    setPending(null);
  }

  const options: {
    id: AdapterMode;
    labelKey: string;
    subKey: string;
    icon: React.ElementType;
    activeClass: string;
  }[] = [
    {
      id: "firebase",
      labelKey: "adapter.cloud",
      subKey:   "adapter.cloud.sub",
      icon:     Cloud,
      activeClass:
        "border-sky-500 bg-sky-500/10 text-sky-400",
    },
    {
      id: "local",
      labelKey: "adapter.local",
      subKey:   "adapter.local.sub",
      icon:     Server,
      activeClass:
        "border-amber-500 bg-amber-500/10 text-amber-400",
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">

      {/* ── Header ── */}
      <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
        <Server className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold text-foreground flex-1">
          {t("adapter.mode")}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono tracking-wide">
          {t("adapter.phase1")}
        </span>
      </div>

      {/* ── Mode buttons ── */}
      <div className="grid grid-cols-2 gap-2">
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
              <span className="text-xs font-semibold">{t(labelKey)}</span>
              <span className="text-[10px] opacity-70 leading-tight">{t(subKey)}</span>
            </button>
          );
        })}
      </div>

      {/* ── Local mode notice ── */}
      {mode === "local" && !confirming && (
        <div
          className={`flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs ${
            isRTL ? "flex-row-reverse text-right" : ""
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{t("adapter.local.placeholder")}</span>
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
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
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
