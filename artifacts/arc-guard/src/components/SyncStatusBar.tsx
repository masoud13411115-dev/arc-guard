/**
 * ARC Guard — SyncStatusBar
 *
 * Two rendering modes:
 *   compact=true  — a small row of chips (for use inside GuardPatrol header)
 *   compact=false — a full info card with 4 stat tiles + manual sync button
 *                   (for use in BackupPage / Dashboard)
 */

import { Wifi, WifiOff, RefreshCw, Clock, Database, CloudOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { SyncState } from "@/lib/syncManager";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAgo(ts: number | null, t: (k: string) => string): string {
  if (!ts) return t("sync.never");
  const diff = Date.now() - ts;
  const m    = Math.floor(diff / 60_000);
  const h    = Math.floor(m / 60);
  if (h > 0) return `${h}${t("sync.time.h")}`;
  if (m > 0) return `${m}${t("sync.time.m")}`;
  return t("sync.time.now");
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface SyncStatusBarProps {
  sync:    SyncState;
  dbSize?: string;
  compact?: boolean;
}

// ── Compact mode (chips row) ──────────────────────────────────────────────────

function CompactBar({ sync }: { sync: SyncState }) {
  const { t } = useI18n();
  const { online, pendingCount, isSyncing, syncNow } = sync;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Online/Offline chip */}
      <span className={`inline-flex items-center gap-1 text-[13px] px-2.5 py-1 rounded-full font-semibold border ${
        online
          ? "bg-green-500/12 border-green-500/35 text-green-400"
          : "bg-red-500/12 border-red-500/35 text-red-400"
      }`}>
        {online
          ? <Wifi    className="w-3.5 h-3.5" />
          : <WifiOff className="w-3.5 h-3.5" />}
        {online ? t("common.status.online") : t("common.status.offline")}
      </span>

      {/* Pending chip (amber when > 0) */}
      {pendingCount > 0 && (
        <button
          onClick={online ? syncNow : undefined}
          disabled={!online || isSyncing}
          className="inline-flex items-center gap-1.5 text-[13px] px-2.5 py-1 rounded-full border bg-amber-500/12 border-amber-500/35 text-amber-400 font-semibold disabled:opacity-60"
        >
          {isSyncing
            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            : <CloudOff  className="w-3.5 h-3.5" />}
          {isSyncing
            ? t("sync.syncing")
            : t("sync.n.pending", { n: String(pendingCount) })}
        </button>
      )}
    </div>
  );
}

// ── Full card mode ─────────────────────────────────────────────────────────────

function FullCard({ sync, dbSize }: { sync: SyncState; dbSize?: string }) {
  const { t } = useI18n();
  const { online, pendingCount, lastSyncAt, isSyncing, syncNow } = sync;

  const tiles = [
    {
      label: t("sync.status"),
      value: online ? t("common.status.online") : t("common.status.offline"),
      color: online ? "text-green-400" : "text-red-400",
      icon:  online
        ? <Wifi    className="w-3.5 h-3.5 shrink-0" />
        : <WifiOff className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      label: t("sync.pending"),
      value: String(pendingCount),
      color: pendingCount > 0 ? "text-amber-400" : "text-green-400",
      icon:  <CloudOff className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      label: t("sync.last"),
      value: fmtAgo(lastSyncAt, t),
      color: "text-foreground",
      icon:  <Clock className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      label: t("sync.local.size"),
      value: dbSize ?? "—",
      color: "text-foreground",
      icon:  <Database className="w-3.5 h-3.5 shrink-0" />,
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
        <RefreshCw className={`w-4 h-4 text-primary shrink-0 ${isSyncing ? "animate-spin" : ""}`} />
        <span className="text-sm font-bold text-foreground flex-1">{t("sync.title")}</span>
        <button
          onClick={syncNow}
          disabled={!online || isSyncing || pendingCount === 0}
          className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent
                     disabled:opacity-40 transition-colors flex items-center gap-1.5 font-medium"
        >
          {isSyncing && <RefreshCw className="w-3 h-3 animate-spin" />}
          {isSyncing ? t("sync.syncing") : t("sync.sync.now")}
        </button>
      </div>

      {/* Tiles */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {tiles.map(({ label, value, color, icon }) => (
          <div key={label} className="rounded-lg bg-muted/20 p-3">
            <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
            <div className={`flex items-center gap-1.5 text-sm font-bold ${color}`}>
              {icon}
              <span>{value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Offline warning banner */}
      {!online && pendingCount > 0 && (
        <div className="mx-4 mb-4 flex items-center gap-2 p-2.5 rounded-lg
                        bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
          <CloudOff className="w-3.5 h-3.5 shrink-0" />
          <span>{t("sync.offline.pending.note", { n: String(pendingCount) })}</span>
        </div>
      )}
    </div>
  );
}

// ── Exported component ────────────────────────────────────────────────────────

export default function SyncStatusBar({ sync, dbSize, compact = false }: SyncStatusBarProps) {
  return compact
    ? <CompactBar sync={sync} />
    : <FullCard   sync={sync} dbSize={dbSize} />;
}
