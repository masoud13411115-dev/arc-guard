import { Cloud, Server, HardDrive, CheckCircle, XCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getAdapterMode, getLocalServerUrl } from "@/lib/adapter";
import { isFirebaseReady } from "@/firebase";

export default function AdapterStatusBadge() {
  const { t, isRTL } = useI18n();
  const mode     = getAdapterMode();
  const fbReady  = isFirebaseReady;

  type Row = {
    label:    string;
    value:    string;
    Icon:     React.ElementType;
    iconCls:  string;
    dot:      string;
    valueCls: string;
  };

  let rows: Row[];
  let headerDot: string;

  if (mode === "firebase") {
    headerDot = fbReady ? "bg-green-400 animate-pulse" : "bg-red-400 animate-pulse";
    rows = [
      {
        label:    t("adapter.status.mode"),
        value:    t("adapter.cloud"),
        Icon:     Cloud,
        iconCls:  "text-sky-400",
        dot:      "bg-sky-400",
        valueCls: "text-sky-400",
      },
      {
        label:    t("adapter.status.adapter"),
        value:    "Firebase",
        Icon:     CheckCircle,
        iconCls:  "text-green-400",
        dot:      "bg-green-400",
        valueCls: "text-green-400",
      },
      {
        label:    t("adapter.status.connection"),
        value:    fbReady ? t("adapter.status.ok") : t("adapter.status.fail"),
        Icon:     fbReady ? CheckCircle : XCircle,
        iconCls:  fbReady ? "text-green-400" : "text-red-400",
        dot:      fbReady ? "bg-green-400"   : "bg-red-400 animate-pulse",
        valueCls: fbReady ? "text-green-400" : "text-red-400",
      },
    ];
  } else if (mode === "indexeddb") {
    headerDot = "bg-green-400 animate-pulse";
    rows = [
      {
        label:    t("adapter.status.mode"),
        value:    t("adapter.mode.indexeddb"),
        Icon:     HardDrive,
        iconCls:  "text-green-400",
        dot:      "bg-green-400",
        valueCls: "text-green-400",
      },
      {
        label:    t("adapter.status.adapter"),
        value:    "IndexedDB",
        Icon:     CheckCircle,
        iconCls:  "text-green-400",
        dot:      "bg-green-400",
        valueCls: "text-green-400",
      },
      {
        label:    t("adapter.status.connection"),
        value:    t("adapter.status.ok"),
        Icon:     CheckCircle,
        iconCls:  "text-green-400",
        dot:      "bg-green-400",
        valueCls: "text-green-400",
      },
    ];
  } else {
    // local server
    const url      = getLocalServerUrl();
    const hasUrl   = !!url;
    headerDot      = hasUrl ? "bg-amber-400 animate-pulse" : "bg-amber-400";
    rows = [
      {
        label:    t("adapter.status.mode"),
        value:    t("adapter.local"),
        Icon:     Server,
        iconCls:  "text-amber-400",
        dot:      "bg-amber-400",
        valueCls: "text-amber-400",
      },
      {
        label:    t("adapter.status.adapter"),
        value:    hasUrl ? url.replace(/^https?:\/\//, "") : t("adapter.status.preparing"),
        Icon:     hasUrl ? CheckCircle : XCircle,
        iconCls:  hasUrl ? "text-amber-400" : "text-red-400",
        dot:      hasUrl ? "bg-amber-400"   : "bg-red-400",
        valueCls: hasUrl ? "text-amber-400" : "text-red-400",
      },
      {
        label:    t("adapter.status.connection"),
        value:    hasUrl ? t("adapter.status.ok") : t("adapter.status.preparing"),
        Icon:     hasUrl ? CheckCircle : XCircle,
        iconCls:  hasUrl ? "text-amber-400" : "text-muted-foreground",
        dot:      hasUrl ? "bg-amber-400"   : "bg-muted-foreground",
        valueCls: hasUrl ? "text-amber-400" : "text-muted-foreground",
      },
    ];
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
      {/* ── Header ── */}
      <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
        <div className={`w-2 h-2 rounded-full shrink-0 ${headerDot}`} />
        <span className="text-xs font-semibold text-muted-foreground flex-1">
          {t("adapter.status.title")}
        </span>
      </div>

      {/* ── Rows ── */}
      {rows.map(({ label, value, Icon, iconCls, dot, valueCls }) => (
        <div key={label} className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
          <span className="text-xs text-muted-foreground flex-1 truncate">{label}</span>
          <div className={`flex items-center gap-1 shrink-0 ${isRTL ? "flex-row-reverse" : ""}`}>
            <Icon className={`w-3.5 h-3.5 ${iconCls}`} />
            <span className={`text-xs font-semibold ${valueCls} truncate max-w-[120px]`}>{value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
