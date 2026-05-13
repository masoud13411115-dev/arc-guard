import { useState, useEffect, useCallback, useRef } from "react";
import {
  Users, CheckCircle, QrCode, LogOut, Activity, Shield, AlertTriangle,
  Monitor, FileText, Map, MapPin, Radio, Bell, Settings, Crown, Star,
  BellOff, BellRing, ChevronDown, ChevronUp, AlertOctagon, HelpCircle, Terminal, Database, WifiOff,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import LanguageSelector from "@/components/LanguageSelector";
import arcGuardLogo from "/arc-guard-logo.png";
import MobileHeader from "@/components/MobileHeader";
import LiveMonitor from "./LiveMonitor";
import CheckpointManager from "./CheckpointManager";
import PatrolLogs from "./PatrolLogs";
import LiveMapView from "@/components/LiveMapView";
import AlertPopup from "@/components/AlertPopup";
import AlertHistory from "./AlertHistory";
import CompanySettings from "./CompanySettings";
import HelpPage from "@/pages/HelpPage";
import DiagnosticsPage from "@/pages/DiagnosticsPage";
import BackupPage from "@/pages/BackupPage";
import {
  subscribePatrolLogs, subscribeGuardSessions, subscribeAlerts,
  subscribeCheckpoints, resolveAlert as fbResolveAlert, getCompany,
} from "@/lib/adapter";
import { cacheManagerData, getCachedManagerData } from "@/lib/localDB";
import { PLANS } from "@/lib/plans";
import {
  getPermissionStatus, requestPermission, markAlertsAsSeen, getSeenAlertIds,
  showAlertNotification,
  type NotifPermission,
} from "@/lib/notifications";
import {
  registerFcmServiceWorker, requestFcmToken, buildFcmDiagState,
  isPwaInstalled, isIosDevice,
  type FcmDiagState,
} from "@/lib/fcm";
import { saveFcmToken } from "@/lib/firestore";
import { initFcmMessaging } from "@/firebase";
import firebaseConfig from "@/firebaseConfig";
import type { UserProfile, PatrolLog, GuardSession, Alert, Checkpoint } from "@/types";

interface DashboardProps {
  profile: UserProfile;
  onLogout: () => void;
}

type Tab = "overview" | "map" | "monitor" | "alerts" | "checkpoints" | "logs" | "settings" | "help" | "diagnostics" | "backup";

const PLAN_ICON: Record<string, React.ElementType> = {
  basic: Shield,
  professional: Star,
  enterprise: Crown,
};

// ── Notification permission card ──────────────────────────────────────────────
interface NotifCardProps {
  onPermissionGranted?: () => void;
}

function NotificationPermissionCard({ onPermissionGranted }: NotifCardProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState<NotifPermission>(() => getPermissionStatus());
  const [requesting, setRequesting] = useState(false);
  const pwaInstalled = isPwaInstalled();
  const iosDevice    = isIosDevice();

  const handleRequest = async () => {
    setRequesting(true);
    const result = await requestPermission();
    setStatus(result);
    setRequesting(false);
    if (result === "granted") onPermissionGranted?.();
  };

  if (status === "unsupported") return null;

  return (
    <div className="space-y-2">
      <div className={`rounded-xl border p-4 space-y-3 ${
        status === "granted" ? "border-green-500/20 bg-green-500/5"
        : status === "denied"  ? "border-red-500/20 bg-red-500/5"
        : "border-yellow-500/30 bg-yellow-500/8"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            status === "granted" ? "bg-green-500/15" : status === "denied" ? "bg-red-500/15" : "bg-yellow-500/15"
          }`}>
            {status === "granted" ? <BellRing className="w-4 h-4 text-green-400" />
             : status === "denied" ? <BellOff className="w-4 h-4 text-red-400" />
             : <Bell className="w-4 h-4 text-yellow-400" />}
          </div>
          <div className="flex-1">
            <p className={`text-sm font-bold ${
              status === "granted" ? "text-green-400" : status === "denied" ? "text-red-400" : "text-yellow-400"
            }`}>
              {status === "granted" ? t("notif.granted")
               : status === "denied" ? t("notif.denied")
               : t("notif.default")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {status === "granted" ? t("notif.granted.desc")
                : status === "denied" ? t("notif.denied.desc")
                : t("notif.default.desc")}
            </p>
          </div>
          {status === "default" && (
            <button
              onClick={handleRequest}
              disabled={requesting}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs font-bold hover:bg-yellow-500/30 transition-colors disabled:opacity-60"
            >
              {requesting ? "..." : t("notif.enable.btn")}
            </button>
          )}
        </div>
        {status === "granted" && (
          <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
            {[
              { icon: "🚨", labelKey: "notif.sos.label", subKey: "notif.sos.sub" },
              { icon: "⏰", labelKey: "notif.missed.label", subKey: "notif.missed.sub" },
              { icon: "📍", labelKey: "notif.outside.label", subKey: "notif.outside.sub" },
            ].map(({ icon, labelKey, subKey }) => (
              <div key={labelKey} className="rounded-lg bg-muted/30 p-1.5">
                <div className="text-base">{icon}</div>
                <p className="text-muted-foreground font-medium">{t(labelKey)}</p>
                <p className="text-muted-foreground/60">{t(subKey)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Background push unsupported — shown when permission granted but context disallows push */}
      {status === "granted" && (iosDevice && !pwaInstalled) && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/8 p-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/90 leading-relaxed">{t("push.bg.unsupported.msg")}</p>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard({ profile, onLogout }: DashboardProps) {
  const { t, dir, lang } = useI18n();
  const DATE_LOCALES: Record<string, string> = { fa: "fa-IR", en: "en-US", tr: "tr-TR", "zh-CN": "zh-CN" };
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [recentLogs, setRecentLogs] = useState<PatrolLog[]>([]);
  const [sessions, setSessions] = useState<GuardSession[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => getSeenAlertIds());
  const [currentPlanId, setCurrentPlanId] = useState<string>("basic");
  const [showAlertsDebug, setShowAlertsDebug] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [fcmDiagState, setFcmDiagState] = useState<FcmDiagState | null>(null);

  // Tracks alert IDs seen in the previous Firestore snapshot to detect truly new alerts
  const prevAlertIdsRef = useRef<Set<string>>(new Set());
  // Cached SW registration so token refresh after permission-grant reuses it
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);
  const fcmMsgRef = useRef<import('firebase/messaging').Messaging | null>(null);

  const currentPlan = PLANS[currentPlanId as keyof typeof PLANS] ?? PLANS.basic;
  const PlanIcon = PLAN_ICON[currentPlanId] ?? Shield;

  // ── Online / offline tracking ────────────────────────────────────────────────
  useEffect(() => {
    const onOnline  = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // ── FCM token refresh (called on mount AND after notification permission grant) ─
  const refreshFcmToken = useCallback(async () => {
    const vapidKey     = firebaseConfig.vapidKey;
    const swReg        = swRegRef.current;
    const msgInstance  = fcmMsgRef.current;
    const swActive     = !!swReg;
    const fcmSupported = msgInstance !== null;

    if (fcmSupported && swReg) {
      try {
        const token = await requestFcmToken(msgInstance, vapidKey, swReg);
        let tokenSaved = false;
        if (token) {
          await saveFcmToken(profile.companyId, profile.uid, token);
          tokenSaved = true;
        }
        setFcmDiagState(buildFcmDiagState(tokenSaved, vapidKey, swActive, true));
      } catch (err) {
        console.warn("[Dashboard] FCM token refresh error:", err);
        setFcmDiagState(buildFcmDiagState(false, vapidKey, swActive, true));
      }
    } else {
      setFcmDiagState(buildFcmDiagState(false, vapidKey, swActive, fcmSupported));
    }
  }, [profile.companyId, profile.uid]);

  // ── FCM push notification setup (managers / super_admin only) ───────────────
  useEffect(() => {
    if (profile.role === "guard") return;
    const vapidKey = firebaseConfig.vapidKey;
    let cancelled = false;

    (async () => {
      // Register SW once and cache for reuse on token refresh
      const swReg = await registerFcmServiceWorker();
      if (cancelled) return;
      swRegRef.current = swReg;

      // isSupported() check inside — safe on all browsers including iOS Safari
      const msgInstance = await initFcmMessaging();
      if (cancelled) return;
      fcmMsgRef.current = msgInstance;

      const swActive     = !!swReg;
      const fcmSupported = msgInstance !== null;

      if (fcmSupported && swReg) {
        try {
          const token = await requestFcmToken(msgInstance, vapidKey, swReg);
          let tokenSaved = false;
          if (token) {
            await saveFcmToken(profile.companyId, profile.uid, token);
            tokenSaved = true;
          }
          if (!cancelled) setFcmDiagState(buildFcmDiagState(tokenSaved, vapidKey, swActive, true));
        } catch (err) {
          console.warn("[Dashboard] FCM setup error:", err);
          if (!cancelled) setFcmDiagState(buildFcmDiagState(false, vapidKey, swActive, true));
        }
      } else {
        // FCM unsupported (iOS Safari, Firefox, etc.) or SW failed — degrade gracefully
        if (!cancelled) setFcmDiagState(buildFcmDiagState(false, vapidKey, swActive, fcmSupported));
      }
    })();

    return () => { cancelled = true; };
  }, [profile.companyId, profile.uid, profile.role]);

  // ── Service Worker → app message listener (notification click → alerts tab) ─
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (evt: MessageEvent<{ type?: string }>) => {
      if (evt.data?.type === "NAVIGATE_TO_ALERTS") setActiveTab("alerts");
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  // ── Data loading ────────────────────────────────────────────────────────────
  useEffect(() => {
    getCompany(profile.companyId).then((c) => {
      if (c?.plan) setCurrentPlanId(c.plan);
    }).catch(() => {});
  }, [profile.companyId]);

  // If offline on mount, pre-load cached data so the dashboard isn't empty
  useEffect(() => {
    if (navigator.onLine) return;
    const cid = profile.companyId;
    getCachedManagerData(cid, "patrolLogs").then((d)  => { if (d?.length) setRecentLogs(d  as typeof recentLogs);  }).catch(console.error);
    getCachedManagerData(cid, "sessions"  ).then((d)  => { if (d?.length) setSessions(d    as typeof sessions);    }).catch(console.error);
    getCachedManagerData(cid, "alerts"    ).then((d)  => { if (d?.length) setAlerts(d      as typeof alerts);      }).catch(console.error);
    getCachedManagerData(cid, "checkpoints").then((d) => { if (d?.length) setCheckpoints(d as typeof checkpoints); }).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.companyId]);

  useEffect(() => {
    const cid = profile.companyId;

    const u1 = subscribePatrolLogs(cid, (logs) => {
      setRecentLogs(logs);
      cacheManagerData(cid, "patrolLogs", logs).catch(console.error);
    }, 100);

    const u2 = subscribeGuardSessions(cid, (s) => {
      setSessions(s);
      cacheManagerData(cid, "sessions", s).catch(console.error);
    });

    const u3 = subscribeAlerts(
      cid,
      (newAlerts) => {
        // Show browser notifications for genuinely new (just-arrived) alerts
        const prevIds = prevAlertIdsRef.current;
        if (prevIds.size > 0) {
          newAlerts
            .filter((a) => a.id && !prevIds.has(a.id) && !a.resolved)
            .forEach((a) => { showAlertNotification(a).catch(() => {}); });
        }
        prevAlertIdsRef.current = new Set(
          newAlerts.map((a) => a.id).filter((id): id is string => !!id),
        );
        setAlerts(newAlerts);
        setAlertsError(null);
        cacheManagerData(cid, "alerts", newAlerts).catch(console.error);
      },
      (err) => {
        console.error("[Dashboard] subscribeAlerts failed:", (err as {code?:string}).code, err.message);
        setAlertsError(err.message);
        if (!navigator.onLine) {
          getCachedManagerData(cid, "alerts").then((d) => { if (d?.length) setAlerts(d as typeof alerts); }).catch(console.error);
        }
      },
    );

    const u4 = subscribeCheckpoints(
      cid,
      (cps) => {
        setCheckpoints(cps);
        cacheManagerData(cid, "checkpoints", cps).catch(console.error);
      },
      (err) => {
        console.error("[Dashboard] subscribeCheckpoints failed:", err.message);
        if (!navigator.onLine) {
          getCachedManagerData(cid, "checkpoints").then((d) => { if (d?.length) setCheckpoints(d as typeof checkpoints); }).catch(console.error);
        }
      },
    );

    return () => { u1(); u2(); u3(); u4(); };
  }, [profile.companyId]);

  const handleResolveAlert = useCallback(async (id: string) => {
    await fbResolveAlert(profile.companyId, id);
  }, [profile.companyId]);

  const handleMarkSeen = useCallback((ids: string[]) => {
    markAlertsAsSeen(ids);
    setSeenIds(getSeenAlertIds());
  }, []);

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    if (tab === "alerts") {
      const openIds = alerts.filter((a) => a.id && !a.resolved).map((a) => a.id!);
      if (openIds.length > 0) {
        markAlertsAsSeen(openIds);
        setSeenIds(getSeenAlertIds());
      }
    }
  }, [alerts]);

  const openAlerts = alerts.filter((a) => !a.resolved);
  const sosAlerts = openAlerts.filter((a) => a.kind === "sos");
  const unseenOpenCount = openAlerts.filter((a) => a.id && !seenIds.has(a.id)).length;

  const activeGuards = sessions.filter((s) => s.status === "active").length;
  const scansToday = recentLogs.filter((l) => {
    const today = new Date();
    return new Date(l.scanTime ?? l.scannedAt).toDateString() === today.toDateString();
  }).length;

  const stats = [
    { label: t("dash.stat.total"),  value: String(sessions.length),   icon: Users,         color: "text-primary",                                                    bg: "bg-primary/10" },
    { label: t("dash.stat.active"), value: String(activeGuards),       icon: CheckCircle,   color: "text-green-400",                                                  bg: "bg-green-400/10" },
    { label: t("dash.stat.alerts"), value: String(openAlerts.length),  icon: AlertTriangle, color: openAlerts.length > 0 ? "text-red-400" : "text-yellow-400",        bg: openAlerts.length > 0 ? "bg-red-400/10" : "bg-yellow-400/10" },
    { label: t("dash.stat.scans"),  value: String(scansToday),         icon: QrCode,        color: "text-purple-400",                                                 bg: "bg-purple-400/10" },
  ];

  const navItems: { tab: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { tab: "overview",    label: t("dash.tab.overview"),     icon: Activity },
    { tab: "map",         label: t("dash.tab.map"),          icon: Map },
    { tab: "monitor",     label: t("dash.tab.monitor"),      icon: Monitor },
    { tab: "alerts",      label: t("dash.tab.alerts"),       icon: Bell, badge: unseenOpenCount },
    { tab: "checkpoints", label: t("dash.tab.checkpoints"),  icon: MapPin },
    { tab: "logs",        label: t("dash.tab.logs"),         icon: FileText },
    { tab: "settings",    label: t("dash.tab.settings"),      icon: Settings },
    { tab: "backup",      label: t("dash.tab.backup"),        icon: Database },
    { tab: "help",        label: t("dash.tab.help"),          icon: HelpCircle },
    { tab: "diagnostics", label: t("dash.tab.diagnostics"),   icon: Terminal },
  ];

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-3 px-2 mb-4 mt-2">
        <img src={arcGuardLogo} alt="ARC Guard" className="w-9 h-9 object-contain"
          style={{ filter: "drop-shadow(0 0 10px rgba(14,165,233,0.4))" }} />
        <div>
          <p className="text-xs font-bold text-primary tracking-wider">ARC Guard</p>
          <p className="text-[10px] text-muted-foreground truncate max-w-28">{profile.companyName ?? t("dash.management")}</p>
        </div>
      </div>

      {/* Plan badge */}
      <div className={`mx-2 mb-4 rounded-lg border ${currentPlan.border} ${currentPlan.bg} px-3 py-2 flex items-center gap-2`}>
        <PlanIcon className={`w-3.5 h-3.5 ${currentPlan.color} shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-bold ${currentPlan.color}`}>{t("dash.plan.badge", { name: currentPlan.name })}</p>
          <p className="text-[9px] text-muted-foreground">{currentPlan.price}</p>
        </div>
        <button
          onClick={() => { handleTabChange("settings"); setSidebarOpen(false); }}
          className="text-[9px] text-primary hover:underline shrink-0"
        >
          {t("dash.plan.view")}
        </button>
      </div>

      <nav className="flex-1 space-y-0.5">
        {navItems.map(({ tab, label, icon: Icon, badge }) => (
          <button key={tab} onClick={() => { handleTabChange(tab); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              activeTab === tab
                ? "bg-primary/15 text-primary border border-primary/20"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}>
            <Icon className="w-4 h-4" />
            <span className="flex-1 text-start">{label}</span>
            {badge != null && badge > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                tab === "alerts" && sosAlerts.length > 0
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-yellow-500/20 text-yellow-400"
              }`}>{badge}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="pt-3 border-t border-border mt-2">
        <div className="px-2 mb-2">
          <p className="text-[10px] text-muted-foreground truncate">@{profile.username}</p>
        </div>
        <button onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors">
          <LogOut className="w-4 h-4" />{t("common.logout.system")}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background arc-grid-bg flex flex-col" dir={dir}>
      <AlertPopup alerts={openAlerts} onResolve={handleResolveAlert} />

      <MobileHeader
        title="ARC Guard"
        subtitle={profile.companyName ?? t("dash.management")}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        notificationCount={unseenOpenCount}
      />

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}>
          <div
            className="absolute left-0 top-0 h-full w-60 bg-card border-r border-border p-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Mobile tab bar */}
      <div className="md:hidden flex overflow-x-auto border-b border-border bg-card/90 backdrop-blur shrink-0 scrollbar-none">
        {navItems.map(({ tab, label, icon: Icon, badge }) => (
          <button key={tab} onClick={() => handleTabChange(tab)}
            style={activeTab === tab ? { color: '#ffffff' } : {}}
            className={`relative flex flex-col items-center gap-1 px-3.5 py-3 shrink-0 text-[13px] font-bold transition-colors border-b-[3px] ${
              activeTab === tab
                ? "border-primary text-white bg-primary/[0.12] [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]"
                : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]"
            }`}>
            <Icon className={`w-5 h-5 ${activeTab === tab ? "text-white" : "text-gray-400"}`} />
            {label}
            {badge != null && badge > 0 && (
              <span className={`absolute top-1.5 right-1 w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-full ${
                tab === "alerts" && sosAlerts.length > 0 ? "bg-red-500 text-white animate-pulse" : "bg-yellow-500 text-black"
              }`}>{badge > 9 ? "9+" : badge}</span>
            )}
          </button>
        ))}

        {/* Mobile logout — always visible at end of tab bar */}
        <button
          onClick={onLogout}
          className="relative flex flex-col items-center gap-1 px-3.5 py-3 shrink-0 text-[13px] font-bold
                     text-red-400 border-b-[3px] border-transparent hover:bg-red-500/[0.10] transition-colors"
        >
          <LogOut className="w-5 h-5 text-red-400" />
          {t("common.logout.system")}
        </button>
      </div>

      <div className="flex-1 flex">
        <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card/50 p-4 shrink-0 sticky top-0 h-screen overflow-y-auto">
          <SidebarContent />
        </aside>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto">

          {/* ── Offline banner ── */}
          {!online && (
            <div
              className="mb-5 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-yellow-300 animate-fade-in-up"
              style={{ background: "rgba(234,179,8,0.10)", borderColor: "rgba(234,179,8,0.30)" }}
            >
              <WifiOff className="w-4 h-4 shrink-0 text-yellow-400" />
              <p className="text-[13px] font-medium">{t("manager.offline.banner")}</p>
            </div>
          )}

          {/* ── Overview ── */}
          {activeTab === "overview" && (
            <div className="space-y-5 animate-fade-in-up max-w-3xl">
              <div>
                <h2 className="text-lg font-bold text-foreground">{t("dash.section.overview")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date().toLocaleDateString(DATE_LOCALES[lang] ?? "en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>

              {sosAlerts.length > 0 && (
                <div className="rounded-xl border-2 border-red-500 bg-red-950/40 p-4 flex items-center gap-3">
                  <Radio className="w-6 h-6 text-red-400 animate-ping shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-red-400">{t("dash.sos.banner", { n: String(sosAlerts.length) })}</p>
                    <p className="text-xs text-red-300/70 mt-0.5">{sosAlerts.map((a) => a.guardName).join("، ")} — {t("dash.sos.attention")}</p>
                  </div>
                  <button
                    onClick={() => handleTabChange("alerts")}
                    className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors shrink-0"
                  >
                    {t("dash.sos.view")}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {stats.map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label}
                    className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors">
                    <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent scans */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm font-semibold text-foreground">{t("dash.recent.title")}</span>
                  </div>
                  <button onClick={() => handleTabChange("logs")} className="text-xs text-primary hover:underline">{t("dash.recent.all")}</button>
                </div>
                {recentLogs.length === 0 ? (
                  <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                    {t("dash.recent.empty")}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {recentLogs.slice(0, 5).map((log, i) => {
                      const s = log.status ?? (log.withinRadius ? "valid" : "outside");
                      return (
                        <div key={log.id ?? i}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${
                            s === "valid" ? "bg-green-400" : s === "outside" ? "bg-yellow-400" : "bg-destructive"
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">
                              <span className="font-medium">{log.guardName}</span>
                              <span className="text-muted-foreground"> ← </span>
                              <span className="text-primary">{log.checkpointName}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {log.scannedAtText}{log.distanceMeters !== null && ` · ${t("logs.meters", { n: String(log.distanceMeters) })}`}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                            s === "valid" ? "bg-green-400/10 text-green-400"
                            : s === "outside" ? "bg-yellow-400/10 text-yellow-400"
                            : "bg-destructive/10 text-destructive"
                          }`}>
                            {s === "valid" ? t("status.valid") : s === "outside" ? t("status.outside") : t("status.failed")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { labelKey: "dash.tab.map",         tab: "map" as Tab,         icon: Map,      color: "text-green-400",        bg: "bg-green-400/10 border-green-500/20" },
                  { labelKey: "dash.tab.alerts",      tab: "alerts" as Tab,      icon: Bell,     color: "text-red-400",          bg: "bg-red-400/10 border-red-500/20" },
                  { labelKey: "dash.tab.monitor",     tab: "monitor" as Tab,     icon: Monitor,  color: "text-primary",          bg: "bg-primary/10 border-primary/20" },
                  { labelKey: "dash.tab.checkpoints", tab: "checkpoints" as Tab, icon: MapPin,   color: "text-sky-400",          bg: "bg-sky-400/10 border-sky-500/20" },
                  { labelKey: "dash.tab.logs",        tab: "logs" as Tab,        icon: FileText, color: "text-purple-400",       bg: "bg-purple-400/10 border-purple-500/20" },
                  { labelKey: "dash.tab.settings",    tab: "settings" as Tab,    icon: Settings, color: "text-muted-foreground", bg: "bg-muted/30 border-border" },
                ].map(({ labelKey, tab, icon: Icon, color, bg }) => (
                  <button key={tab} onClick={() => handleTabChange(tab)}
                    className={`rounded-xl border ${bg} p-4 flex flex-col items-center gap-2 hover:opacity-80 transition-opacity`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                    <span className="text-xs font-medium text-foreground">{t(labelKey)}</span>
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-primary">{t("dash.system.plan", { name: currentPlan.name })}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {profile.companyName ?? profile.companyId} · {t("dash.system.connected")}
                  </p>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
              </div>
            </div>
          )}

          {activeTab === "map" && (
            <div className="animate-fade-in-up">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-foreground">{t("dash.section.map")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("dash.map.sub")}</p>
              </div>
              <LiveMapView sessions={sessions} checkpoints={checkpoints} logs={recentLogs} />
            </div>
          )}

          {activeTab === "monitor" && (
            <div className="max-w-3xl animate-fade-in-up">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-foreground">{t("dash.section.monitor")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("dash.section.monitor.sub")}</p>
              </div>
              <LiveMonitor companyId={profile.companyId} />
            </div>
          )}

          {activeTab === "alerts" && (
            <div className="max-w-2xl animate-fade-in-up">
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">{t("dash.section.alerts")}</h2>
                  {openAlerts.length > 0 && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      sosAlerts.length > 0 ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-yellow-500/20 text-yellow-400"
                    }`}>{t("dash.alerts.count.open", { n: String(openAlerts.length) })}</span>
                  )}
                  {unseenOpenCount > 0 && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                      {t("dash.alerts.count.new", { n: String(unseenOpenCount) })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{t("dash.section.alerts.sub")}</p>
              </div>

              {/* ── Firestore listener error banner ── */}
              {alertsError && (
                <div className="mb-4 rounded-xl border-2 border-red-500/60 bg-red-950/50 p-4 flex items-start gap-3">
                  <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-red-400">{t("dash.firestore.error")}</p>
                    <p className="text-xs text-red-300/70 mt-1 font-mono break-all">{t("dash.alerts.error", { msg: alertsError })}</p>
                  </div>
                </div>
              )}

              {/* ── SOS Debug panel (DEV only) ── */}
              {import.meta.env.DEV && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowAlertsDebug(v => !v)}
                    className="flex items-center gap-2 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    {showAlertsDebug ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    <span className="font-mono">دیباگ Firestore هشدارها</span>
                  </button>
                  {showAlertsDebug && (
                    <div className="mt-1 rounded-xl border border-white/10 bg-black/70 p-3 space-y-1.5 text-left font-mono text-[11px]" dir="ltr">
                      <div className="flex justify-between gap-3">
                        <span className="text-white/30">Manager companyId</span>
                        <span className="text-white/60 break-all text-right">{profile.companyId}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-white/30">Firestore listener path</span>
                        <span className="text-primary/80 break-all text-right">companies/{profile.companyId}/alerts</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-white/30">Query</span>
                        <span className="text-white/60 text-right">orderBy(alertedAt, desc) limit(50)</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-white/30">Alerts loaded</span>
                        <span className={`${alerts.length > 0 ? "text-green-400" : "text-yellow-400"}`}>
                          {alerts.length} {alertsError ? "⚠ (error)" : "✓"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-white/30">Open / SOS</span>
                        <span className="text-white/60">{openAlerts.length} / {sosAlerts.length}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-white/30">SOS write path</span>
                        <span className="text-white/50 text-right">companies/{profile.companyId}/alerts/{"{autoId}"}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-white/30">Composite index</span>
                        <span className="text-green-400">✓ NOT needed (filtered client-side)</span>
                      </div>
                      {alertsError && (
                        <div className="border-t border-white/10 pt-2">
                          <span className="text-red-400 break-all">{alertsError}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <AlertHistory
                alerts={alerts}
                companyId={profile.companyId}
                onAlertResolved={handleResolveAlert}
                seenIds={seenIds}
                onMarkSeen={handleMarkSeen}
              />
            </div>
          )}

          {activeTab === "checkpoints" && (
            <div className="max-w-2xl animate-fade-in-up">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-foreground">{t("dash.section.checkpoints")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("dash.section.checkpoints.sub")}
                </p>
              </div>
              <CheckpointManager companyId={profile.companyId} />
            </div>
          )}

          {activeTab === "logs" && (
            <div className="max-w-3xl animate-fade-in-up">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-foreground">{t("dash.section.logs")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("dash.section.logs.sub")}</p>
              </div>
              <PatrolLogs companyId={profile.companyId} />
            </div>
          )}

          {activeTab === "settings" && (
            <div className="max-w-2xl animate-fade-in-up space-y-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">{t("dash.section.settings")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("dash.section.settings.sub")}
                </p>
              </div>

              {/* Notification permission */}
              <NotificationPermissionCard onPermissionGranted={refreshFcmToken} />

              <CompanySettings profile={profile} />
            </div>
          )}

          {activeTab === "backup" && (
            <BackupPage
              companyId={profile.companyId}
              companyName={profile.companyName ?? profile.companyId}
              online={online}
            />
          )}

        </main>
      </div>

      {activeTab === "help" && (
        <HelpPage mode="manager" onBack={() => setActiveTab("overview")} />
      )}

      {activeTab === "diagnostics" && (
        <div className="fixed inset-0 z-30 bg-background flex flex-col" dir="ltr">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/90 backdrop-blur shrink-0">
            <Terminal className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground flex-1">{t("dash.section.diagnostics")}</span>
            <button
              onClick={() => setActiveTab("settings")}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-accent transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <DiagnosticsPage fcm={fcmDiagState ?? undefined} />
          </div>
        </div>
      )}
    </div>
  );
}
