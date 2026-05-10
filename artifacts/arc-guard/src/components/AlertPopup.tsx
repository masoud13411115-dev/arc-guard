import { useEffect, useRef, useState } from "react";
import { X, AlertTriangle, Clock, MapPin, Radio, CheckCheck } from "lucide-react";
import { playEmergency, playMissed, playOutside } from "@/lib/audioFeedback";
import type { Alert, AlertKind } from "@/types";

interface AlertPopupProps {
  alerts: Alert[];
  onResolve: (id: string) => void;
}

const KIND_META: Record<AlertKind, { label: string; color: string; bg: string; border: string; pulse: string }> = {
  sos: {
    label: "🚨 اضطراری SOS",
    color: "text-red-400",
    bg: "bg-red-950/90",
    border: "border-red-500",
    pulse: "bg-red-500",
  },
  missed: {
    label: "⏰ ایستگاه از دست رفت",
    color: "text-yellow-400",
    bg: "bg-yellow-950/90",
    border: "border-yellow-500",
    pulse: "bg-yellow-500",
  },
  outside: {
    label: "⚠ خارج از محدوده",
    color: "text-orange-400",
    bg: "bg-orange-950/90",
    border: "border-orange-500",
    pulse: "bg-orange-500",
  },
};

export default function AlertPopup({ alerts, onResolve }: AlertPopupProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  const visible = alerts.filter(
    (a) => a.id && !dismissed.has(a.id)
  );

  // Play sound when new alert arrives
  useEffect(() => {
    for (const alert of alerts) {
      if (!alert.id || seenRef.current.has(alert.id)) continue;
      seenRef.current.add(alert.id);
      if (alert.kind === "sos") playEmergency();
      else if (alert.kind === "missed") playMissed();
      else if (alert.kind === "outside") playOutside();
    }
  }, [alerts]);

  // Auto-dismiss non-SOS after 12s
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const a of visible) {
      if (a.kind !== "sos" && a.id) {
        const t = setTimeout(() => {
          setDismissed((prev) => new Set([...prev, a.id!]));
        }, 12000);
        timers.push(t);
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [visible.length]);

  if (visible.length === 0) return null;

  const top = visible[0];
  const rest = visible.slice(1);
  const meta = KIND_META[top.kind];
  const ago = Math.round((Date.now() - top.alertedAt) / 60000);

  return (
    <div className="fixed top-4 left-0 right-0 z-[9999] flex flex-col items-center gap-2 px-3 pointer-events-none">

      {/* ── Main alert card ── */}
      <div
        className={`pointer-events-auto w-full max-w-sm rounded-xl border-2 ${meta.border} ${meta.bg} backdrop-blur-md shadow-2xl animate-fade-in-up overflow-hidden`}
        dir="rtl"
      >
        {/* Header */}
        <div className={`flex items-center gap-2 px-4 py-3 border-b ${meta.border}/40`}>
          <div className={`w-2.5 h-2.5 rounded-full ${meta.pulse} ${top.kind === "sos" ? "animate-ping" : "animate-pulse"} shrink-0`} />
          <span className={`text-sm font-bold flex-1 ${meta.color}`}>{meta.label}</span>
          <button
            onClick={() => top.id && setDismissed((prev) => new Set([...prev, top.id!]))}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${meta.color} bg-current/10`}>
              {top.guardName.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{top.guardName}</p>
              {top.checkpointName && (
                <p className="text-xs text-muted-foreground">ایستگاه: {top.checkpointName}</p>
              )}
            </div>
          </div>

          {top.message && (
            <p className="text-xs text-muted-foreground leading-relaxed">{top.message}</p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {ago === 0 ? "همین الان" : `${ago} دقیقه پیش`}
            </span>
            {top.gps && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                ±{Math.round(top.gps.accuracy)} متر
              </span>
            )}
            {top.distanceMeters != null && (
              <span className="text-xs text-orange-400 font-medium">{top.distanceMeters} متر از ایستگاه</span>
            )}
          </div>

          {/* Actions */}
          {top.id && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => onResolve(top.id!)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-medium hover:bg-green-500/25 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                تأیید و بستن
              </button>
              <button
                onClick={() => top.id && setDismissed((prev) => new Set([...prev, top.id!]))}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-muted-foreground text-xs hover:bg-accent transition-colors"
              >
                بعداً
              </button>
            </div>
          )}
        </div>

        {/* SOS pulsing bottom bar */}
        {top.kind === "sos" && (
          <div className="h-1 bg-red-500 animate-pulse" />
        )}
      </div>

      {/* ── Stacked remaining alerts ── */}
      {rest.length > 0 && (
        <div className="pointer-events-auto w-full max-w-sm">
          <button
            onClick={() => setExpanded(expanded ? null : "all")}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-border bg-card/90 backdrop-blur text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
            {rest.length} هشدار دیگر در انتظار
          </button>

          {expanded && (
            <div className="mt-1 space-y-1">
              {rest.map((a) => {
                const m = KIND_META[a.kind];
                return (
                  <div key={a.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${m.border}/40 ${m.bg} backdrop-blur text-xs`}
                    dir="rtl"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${m.pulse} shrink-0`} />
                    <span className={`font-bold ${m.color} shrink-0`}>{m.label}</span>
                    <span className="text-muted-foreground flex-1 truncate">{a.guardName}</span>
                    {a.id && (
                      <button onClick={() => onResolve(a.id!)} className="text-green-400 hover:text-green-300 shrink-0">
                        <CheckCheck className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
