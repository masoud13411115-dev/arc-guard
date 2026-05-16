/**
 * ARC Guard — Sync Queue Viewer
 *
 * Admin tool showing all queued items with per-item status, retry count,
 * and dead-letter management. Auto-refreshes every 5 seconds.
 */

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, CloudOff, CheckCircle, XCircle, Skull, RotateCcw, Trash2,
  AlertTriangle, Clock, ChevronDown, ChevronUp, Info,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  getQueuedItems, getDeadLetterItems, deleteDeadLetterItem,
  requeueDeadLetterItem, clearDeadLetterQueue,
  type QueuedItem, type DeadLetterItem, type QueueItemStatus,
} from "@/lib/localDB";
import {
  syncAll, clearTransitionLog, getTransitionLog,
  type TransitionEntry,
} from "@/lib/syncManager";
import { getAdapterMode } from "@/lib/adapter";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTs(ts: number): string {
  const d    = new Date(ts);
  const now  = new Date();
  const diff = Date.now() - ts;
  const m    = Math.floor(diff / 60_000);
  const h    = Math.floor(m / 60);
  if (h > 0)  return `${h}h ago`;
  if (m > 0)  return `${m}m ago`;
  return "just now";
}

function fmtFull(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function statusColor(s: QueueItemStatus | undefined): string {
  if (s === "pending")  return "text-amber-400  bg-amber-400/10  border-amber-400/30";
  if (s === "syncing")  return "text-blue-400   bg-blue-400/10   border-blue-400/30";
  if (s === "failed")   return "text-red-400    bg-red-400/10    border-red-400/30";
  if (s === "dead")     return "text-red-500    bg-red-500/10    border-red-500/30";
  return "text-muted-foreground bg-muted/20 border-border";
}

function statusIcon(s: QueueItemStatus | undefined) {
  if (s === "pending")  return <Clock      className="w-3 h-3" />;
  if (s === "syncing")  return <RefreshCw  className="w-3 h-3 animate-spin" />;
  if (s === "failed")   return <XCircle    className="w-3 h-3" />;
  if (s === "dead")     return <Skull      className="w-3 h-3" />;
  return <CloudOff className="w-3 h-3" />;
}

function eventColor(e: TransitionEntry["event"]): string {
  if (e === "item_ok"  || e === "sync_ok")   return "text-green-400";
  if (e === "item_dead"|| e === "sync_failed") return "text-red-400";
  if (e === "item_failed")                    return "text-orange-400";
  if (e === "item_dedup")                     return "text-purple-400";
  if (e === "online")                         return "text-green-400";
  if (e === "offline")                        return "text-red-400";
  return "text-muted-foreground";
}

// ── QueueRow ──────────────────────────────────────────────────────────────────

function QueueRow({ item }: { item: QueuedItem }) {
  const [expanded, setExpanded] = useState(false);
  const cpName   = (item.payload.checkpointName as string) ?? (item.payload.checkpointId as string) ?? "—";
  const guardId  = (item.payload.guardId as string)  ?? "—";
  const sc       = statusColor(item.status);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-accent/10 transition-colors">
        {/* Status badge */}
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${sc} shrink-0`}>
          {statusIcon(item.status)}
          {item.status ?? "pending"}
        </span>

        {/* Type */}
        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
          {item.type === "patrol_log" ? "PATROL" : "SOS"}
        </span>

        {/* Info */}
        <div className="flex-1 min-w-0 text-xs truncate" dir="ltr">
          {item.type === "patrol_log" ? cpName : `Guard ${guardId.slice(-6)}`}
        </div>

        {/* Retry count */}
        {item.attempts > 0 && (
          <span className="text-[10px] text-orange-400 shrink-0">{item.attempts}×</span>
        )}

        {/* Age */}
        <span className="text-[10px] text-muted-foreground shrink-0">{fmtTs(item.createdAt)}</span>

        {/* Expand button */}
        <button onClick={() => setExpanded(v => !v)} className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-1.5 border-t border-border bg-muted/5" dir="ltr">
          <p className="text-[10px] font-mono text-muted-foreground">id: {item.id}</p>
          <p className="text-[10px] font-mono text-muted-foreground">key: {item.idempotencyKey ?? "—"}</p>
          {item.lastError && (
            <p className="text-[10px] text-red-400 font-mono">{item.lastError}</p>
          )}
          {item.lastAttemptAt && (
            <p className="text-[10px] text-muted-foreground">Last attempt: {fmtFull(item.lastAttemptAt)}</p>
          )}
          <details className="text-[10px]">
            <summary className="cursor-pointer text-muted-foreground/60 hover:text-muted-foreground">payload</summary>
            <pre className="mt-1 text-muted-foreground/70 text-[9px] overflow-x-auto max-h-28 leading-relaxed">
              {JSON.stringify(item.payload, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

// ── DeadRow ───────────────────────────────────────────────────────────────────

function DeadRow({
  item, onRequeue, onDelete,
}: { item: DeadLetterItem; onRequeue: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const cpName = (item.payload.checkpointName as string) ?? (item.payload.checkpointId as string) ?? "—";

  return (
    <div className="border border-red-500/30 rounded-lg overflow-hidden bg-red-500/3">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Skull className="w-3.5 h-3.5 text-red-400 shrink-0" />
        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
          {item.type === "patrol_log" ? "PATROL" : "SOS"}
        </span>
        <div className="flex-1 min-w-0 text-xs truncate text-red-300" dir="ltr">
          {item.type === "patrol_log" ? cpName : `Guard ${((item.payload.guardId as string) ?? "?").slice(-6)}`}
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">{item.attempts}× failed</span>
        <span className="text-[10px] text-muted-foreground shrink-0">{fmtTs(item.diedAt)}</span>
        <button onClick={() => setExpanded(v => !v)} className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>
      {expanded && (
        <div className="px-3 pb-2 pt-1 border-t border-red-500/20 space-y-2" dir="ltr">
          <p className="text-[10px] font-mono text-muted-foreground">id: {item.id}</p>
          {item.lastError && (
            <p className="text-[10px] text-red-400 font-mono">{item.lastError}</p>
          )}
          <div className="flex gap-2">
            <button onClick={onRequeue}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors">
              <RotateCcw className="w-3 h-3" /> Retry
            </button>
            <button onClick={onDelete}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface SyncQueueViewerProps {
  companyId: string;
}

export default function SyncQueueViewer({ companyId }: SyncQueueViewerProps) {
  const { t }                    = useI18n();
  const [queue,     setQueue]    = useState<QueuedItem[]>([]);
  const [deadItems, setDead]     = useState<DeadLetterItem[]>([]);
  const [log,       setLog]      = useState<TransitionEntry[]>([]);
  const [isSyncing, setSyncing]  = useState(false);
  const [lastRefresh, setLast]   = useState(Date.now());
  const [showLog,   setShowLog]  = useState(false);
  const mode = getAdapterMode();

  const refresh = useCallback(async () => {
    const [q, d, l] = await Promise.all([
      getQueuedItems(companyId),
      getDeadLetterItems(companyId),
      Promise.resolve(getTransitionLog()),
    ]);
    setQueue(q);
    setDead(d);
    setLog(l);
    setLast(Date.now());
  }, [companyId]);

  useEffect(() => {
    refresh().catch(console.error);
    const id = setInterval(() => refresh().catch(console.error), 5_000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleForceSyncAll = async () => {
    if (isSyncing) return;
    setSyncing(true);
    try {
      await syncAll(companyId);
      await refresh();
    } finally {
      setSyncing(false);
    }
  };

  const handleRequeue = async (id: string) => {
    await requeueDeadLetterItem(id);
    await refresh();
  };

  const handleDelete = async (id: string) => {
    await deleteDeadLetterItem(id);
    await refresh();
  };

  const handleClearDead = async () => {
    await clearDeadLetterQueue(companyId);
    await refresh();
  };

  const handleClearLog = async () => {
    clearTransitionLog();
    setLog([]);
  };

  const pendingItems = queue.filter((i) => i.status === "pending" || i.status === "syncing");
  const failedItems  = queue.filter((i) => i.status === "failed");

  return (
    <div className="max-w-2xl animate-fade-in-up space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">{t("queue.title")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t("queue.sub")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => refresh().catch(console.error)}
            className="p-2 rounded-lg border border-border hover:bg-accent transition-colors">
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={handleForceSyncAll}
            disabled={isSyncing || (queue.length === 0 && mode !== "indexeddb")}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border hover:bg-accent disabled:opacity-40 transition-colors font-medium"
          >
            {isSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {isSyncing ? t("sync.syncing") : t("sync.sync.now")}
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t("queue.stat.pending"), value: pendingItems.length, color: pendingItems.length > 0 ? "text-amber-400" : "text-muted-foreground" },
          { label: t("queue.stat.failed"),  value: failedItems.length,  color: failedItems.length > 0  ? "text-orange-400" : "text-muted-foreground" },
          { label: t("queue.stat.dead"),    value: deadItems.length,    color: deadItems.length > 0    ? "text-red-400"    : "text-muted-foreground" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-3 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Mode note ── */}
      {mode === "indexeddb" && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
          <span>{t("queue.indexeddb.note")}</span>
        </div>
      )}

      {/* ── Pending / Failed queue ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <CloudOff className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm font-bold text-foreground flex-1">{t("queue.section.pending")}</span>
          <span className="text-xs text-muted-foreground">{queue.length} {t("queue.items")}</span>
        </div>
        {queue.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <CheckCircle className="w-8 h-8 text-green-400/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t("queue.empty")}</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {queue.map((item) => (
              <QueueRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* ── Dead letter queue ── */}
      <div className="rounded-xl border border-red-500/20 bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-red-500/20">
          <Skull className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-sm font-bold text-foreground flex-1">{t("queue.section.dead")}</span>
          {deadItems.length > 0 && (
            <button onClick={handleClearDead}
              className="text-xs text-red-400 hover:text-red-300 hover:underline">
              {t("queue.clear.all")}
            </button>
          )}
          <span className="text-xs text-muted-foreground">{deadItems.length} {t("queue.items")}</span>
        </div>
        {deadItems.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">{t("queue.dead.empty")}</div>
        ) : (
          <div className="p-3 space-y-2">
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/8 border border-red-500/20 mb-3">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-300/80 leading-relaxed">{t("queue.dead.note")}</p>
            </div>
            {deadItems.map((item) => (
              <DeadRow
                key={item.id} item={item}
                onRequeue={() => handleRequeue(item.id)}
                onDelete={() => handleDelete(item.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Transition log ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <button
            onClick={() => setShowLog(v => !v)}
            className="flex items-center gap-2 flex-1 text-left"
          >
            <span className="text-sm font-bold text-foreground">{t("queue.section.log")}</span>
            {showLog ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
          {showLog && log.length > 0 && (
            <button onClick={handleClearLog} className="text-xs text-muted-foreground hover:text-foreground">
              {t("queue.log.clear")}
            </button>
          )}
          <span className="text-xs text-muted-foreground shrink-0">{log.length}</span>
        </div>
        {showLog && (
          log.length === 0 ? (
            <div className="px-4 py-5 text-center text-sm text-muted-foreground">{t("queue.log.empty")}</div>
          ) : (
            <div className="divide-y divide-border max-h-72 overflow-y-auto" dir="ltr">
              {log.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
                  <span className="text-muted-foreground/50 font-mono w-16 shrink-0 text-right">{fmtTs(entry.ts)}</span>
                  <span className={`font-mono font-semibold w-28 shrink-0 ${eventColor(entry.event)}`}>{entry.event}</span>
                  <span className="text-muted-foreground/70 truncate">{entry.detail ?? ""}</span>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ── Last refresh ── */}
      <p className="text-[10px] text-muted-foreground/40 text-center" dir="ltr">
        {t("queue.last.refresh")}: {fmtFull(lastRefresh)}
      </p>
    </div>
  );
}
