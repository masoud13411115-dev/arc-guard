/**
 * LanModeIndicator — compact persistent badge showing the active storage mode.
 *
 * Displays inline (pill shape) for use in headers and toolbars.
 * Three states:
 *   firebase  → blue "Cloud" badge (green dot when connected)
 *   local     → amber "LAN" badge (animated pulse)
 *   indexeddb → green "Local" badge
 */

import { Cloud, Server, HardDrive, Wifi, WifiOff } from "lucide-react";
import { getAdapterMode, getLocalServerUrl } from "@/lib/adapter";
import { getCachedLocalServerHealth } from "@/lib/adapter/localAdapter";
import { isFirebaseReady } from "@/firebase";
import { useI18n } from "@/lib/i18n";

interface Props {
  /** Show the label text or just the dot+icon */
  showLabel?: boolean;
  className?: string;
}

export default function LanModeIndicator({ showLabel = true, className = "" }: Props) {
  const { t } = useI18n();
  const mode  = getAdapterMode();

  let icon: React.ElementType;
  let label: string;
  let dotCls: string;
  let pillCls: string;
  let ConnIcon: React.ElementType | null = null;

  if (mode === "firebase") {
    icon    = Cloud;
    label   = t("lan.indicator.cloud");
    dotCls  = isFirebaseReady ? "bg-sky-400 animate-pulse" : "bg-red-400 animate-pulse";
    pillCls = isFirebaseReady
      ? "bg-sky-500/10 border-sky-500/30 text-sky-300"
      : "bg-red-500/10 border-red-500/30 text-red-300";
    ConnIcon = isFirebaseReady ? Wifi : WifiOff;
  } else if (mode === "indexeddb") {
    icon     = HardDrive;
    label    = t("lan.indicator.local");
    dotCls   = "bg-green-400";
    pillCls  = "bg-green-500/10 border-green-500/30 text-green-300";
    ConnIcon = null;
  } else {
    // local server mode
    const url     = getLocalServerUrl();
    const healthy = getCachedLocalServerHealth();
    icon    = Server;
    label   = t("lan.indicator.lan");
    dotCls  = url
      ? (healthy ? "bg-amber-400 animate-pulse" : "bg-orange-500 animate-pulse")
      : "bg-red-400 animate-pulse";
    pillCls = url
      ? (healthy
          ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
          : "bg-orange-500/10 border-orange-500/30 text-orange-300")
      : "bg-red-500/10 border-red-500/30 text-red-300";
    ConnIcon = url ? (healthy ? Wifi : WifiOff) : WifiOff;
  }

  const Icon = icon;

  return (
    <div
      className={[
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-semibold",
        pillCls,
        className,
      ].join(" ")}
    >
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls}`} />
      <Icon className="w-3 h-3 shrink-0" />
      {showLabel && <span>{label}</span>}
      {ConnIcon && <ConnIcon className="w-3 h-3 shrink-0 opacity-70" />}
    </div>
  );
}
