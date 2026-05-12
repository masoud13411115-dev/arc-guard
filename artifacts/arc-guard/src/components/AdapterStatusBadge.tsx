import { Cloud, Server, CheckCircle, XCircle, Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getAdapterMode } from "@/lib/adapter";
import { isFirebaseReady } from "@/firebase";

export default function AdapterStatusBadge() {
  const { t, isRTL } = useI18n();
  const mode     = getAdapterMode();
  const fbReady  = isFirebaseReady;
  const isCloud  = mode === "firebase";

  type Row = {
    label: string;
    value: string;
    Icon: React.ElementType;
    iconCls: string;
    dot: string;
    valueCls: string;
  };

  const rows: Row[] = [
    {
      label:    t("adapter.status.mode"),
      value:    isCloud ? t("adapter.cloud") : t("adapter.local"),
      Icon:     isCloud ? Cloud : Server,
      iconCls:  isCloud ? "text-sky-400"    : "text-amber-400",
      dot:      isCloud ? "bg-sky-400"      : "bg-amber-400",
      valueCls: isCloud ? "text-sky-400"    : "text-amber-400",
    },
    {
      label:    t("adapter.status.adapter"),
      value:    isCloud ? "Firebase" : t("adapter.status.preparing"),
      Icon:     isCloud ? CheckCircle : Clock,
      iconCls:  isCloud ? "text-green-400"  : "text-amber-400",
      dot:      isCloud ? "bg-green-400"    : "bg-amber-400",
      valueCls: isCloud ? "text-green-400"  : "text-amber-400",
    },
    {
      label:    t("adapter.status.connection"),
      value:    isCloud
                  ? (fbReady ? t("adapter.status.ok") : t("adapter.status.fail"))
                  : t("adapter.status.preparing"),
      Icon:     isCloud ? (fbReady ? CheckCircle : XCircle) : Clock,
      iconCls:  isCloud ? (fbReady ? "text-green-400" : "text-red-400") : "text-amber-400",
      dot:      isCloud ? (fbReady ? "bg-green-400" : "bg-red-400 animate-pulse") : "bg-amber-400",
      valueCls: isCloud ? (fbReady ? "text-green-400" : "text-red-400") : "text-amber-400",
    },
  ];

  const headerDot = isCloud
    ? (fbReady ? "bg-green-400 animate-pulse" : "bg-red-400 animate-pulse")
    : "bg-amber-400";

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
            <span className={`text-xs font-semibold ${valueCls}`}>{value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
