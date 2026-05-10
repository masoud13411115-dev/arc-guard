import { useState, useEffect } from "react";
import { Download, X, Share, Plus, Smartphone, RefreshCw, Bell } from "lucide-react";
import {
  captureInstallPrompt, triggerInstall, isPWAInstalled,
  requestNotificationPermission, getNotificationPermission,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa";

type Platform = "android" | "ios" | "desktop" | "other";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Windows|Mac|Linux/.test(ua)) return "desktop";
  return "other";
}

interface UpdateBannerProps {
  onUpdate: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({ onUpdate, onDismiss }: UpdateBannerProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }} dir="rtl">
      <div className="mx-auto max-w-sm mb-4 rounded-2xl border border-primary/40 bg-card shadow-2xl overflow-hidden"
        style={{ boxShadow: "0 -4px 40px rgba(14,165,233,0.15)" }}>
        <div className="flex items-center gap-3 p-4">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            <RefreshCw className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">بروزرسانی آماده است</p>
            <p className="text-xs text-muted-foreground mt-0.5">نسخه جدید ARC Guard موجود است</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={onDismiss} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
            <button onClick={onUpdate}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity">
              بروزرسانی
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface InstallPromptProps {
  onDismiss?: () => void;
}

export default function InstallPrompt({ onDismiss }: InstallPromptProps) {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosGuide, setIosGuide] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>("default");
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isPWAInstalled()) return;

    const dismissed = localStorage.getItem("arc-guard-install-dismissed");
    if (dismissed && Date.now() - parseInt(dismissed) < 48 * 3600 * 1000) return;

    const p = detectPlatform();
    setPlatform(p);
    setNotifPerm(getNotificationPermission());

    if (p === "ios") {
      const t = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(t);
    }

    // Android/Desktop: wait for browser install event
    captureInstallPrompt((e) => {
      setInstallEvent(e);
      setShow(true);
    });
    return undefined;
  }, []);

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem("arc-guard-install-dismissed", String(Date.now()));
    onDismiss?.();
  };

  const handleInstall = async () => {
    if (platform === "ios") { setIosGuide(true); return; }
    setInstalling(true);
    const result = await triggerInstall();
    setInstalling(false);
    if (result === "accepted") {
      setShow(false);
      setTimeout(() => requestNotificationPermission().then(setNotifPerm), 2000);
    }
  };

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifPerm(perm);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }} dir="rtl">
      <div className="mx-auto max-w-sm rounded-2xl border border-primary/40 bg-card overflow-hidden"
        style={{ boxShadow: "0 -4px 50px rgba(14,165,233,0.2), 0 4px 60px rgba(0,0,0,0.5)" }}>

        {/* iOS Step-by-step guide */}
        {iosGuide ? (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">نصب روی iPhone / iPad</p>
              <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5">
              {[
                { icon: Share, text: "دکمه اشتراک‌گذاری را در پایین Safari بزنید", color: "text-primary" },
                { icon: Plus, text: "روی «افزودن به صفحه اصلی» ضربه بزنید", color: "text-green-400" },
                { icon: Smartphone, text: "نام ARC Guard را تأیید و «افزودن» را بزنید", color: "text-sky-400" },
              ].map(({ icon: Icon, text, color }, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40">
                  <div className={`w-7 h-7 rounded-full border border-current/30 flex items-center justify-center shrink-0 ${color} bg-current/10`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-xs text-foreground">{text}</p>
                </div>
              ))}
            </div>
            <button onClick={handleDismiss}
              className="w-full py-2 rounded-xl bg-muted text-muted-foreground text-xs hover:bg-accent transition-colors">
              بستن
            </button>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 border border-border">
                <img src="/arc-guard/arc-guard-logo.png" alt="ARC Guard" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-foreground">نصب ARC Guard</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      برنامه را روی {platform === "ios" ? "iPhone" : "دستگاه"} خود نصب کنید
                    </p>
                  </div>
                  <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { icon: "⚡", label: "آفلاین کار می‌کند" },
                { icon: "🔔", label: "هشدار فوری" },
                { icon: "📱", label: "تمام صفحه" },
              ].map(({ icon, label }) => (
                <div key={label} className="rounded-xl bg-muted/40 border border-border p-2 flex flex-col items-center gap-1">
                  <span className="text-lg">{icon}</span>
                  <p className="text-[10px] text-muted-foreground text-center">{label}</p>
                </div>
              ))}
            </div>

            {notifPerm === "default" && (
              <button onClick={handleEnableNotifications}
                className="w-full flex items-center gap-2 p-2.5 rounded-xl border border-yellow-500/30 bg-yellow-500/8 mb-3 hover:bg-yellow-500/12 transition-colors">
                <Bell className="w-4 h-4 text-yellow-400 shrink-0" />
                <p className="text-xs text-yellow-300 text-right">فعال‌سازی هشدارهای اضطراری (پیشنهاد می‌شود)</p>
              </button>
            )}
            {notifPerm === "granted" && (
              <div className="flex items-center gap-2 p-2 mb-3 text-xs text-green-400">
                <Bell className="w-3.5 h-3.5" />
                <span>هشدارها فعال است ✓</span>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={handleDismiss}
                className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">
                بعداً
              </button>
              <button onClick={handleInstall} disabled={installing}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-60 transition-all active:scale-[0.98]">
                {installing
                  ? <><RefreshCw className="w-4 h-4 animate-spin" />در حال نصب...</>
                  : <><Download className="w-4 h-4" />نصب برنامه</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
