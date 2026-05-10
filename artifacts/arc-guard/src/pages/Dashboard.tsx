import { useState, useEffect, useCallback } from "react";
import {
  Users, CheckCircle, QrCode, LogOut, Activity, Shield, AlertTriangle,
  Monitor, FileText, Map, MapPin, Radio, Bell, Settings, Crown, Star
} from "lucide-react";
import arcGuardLogo from "/arc-guard-logo.png";
import MobileHeader from "@/components/MobileHeader";
import LiveMonitor from "./LiveMonitor";
import CheckpointManager from "./CheckpointManager";
import PatrolLogs from "./PatrolLogs";
import LiveMapView from "@/components/LiveMapView";
import AlertPopup from "@/components/AlertPopup";
import AlertHistory from "./AlertHistory";
import CompanySettings from "./CompanySettings";
import {
  subscribePatrolLogs, subscribeGuardSessions, subscribeAlerts,
  subscribeCheckpoints, resolveAlert,
} from "@/lib/firestore";
import { db, isFirebaseReady } from "@/firebase";
import { DEMO_SESSIONS, DEMO_CHECKPOINTS, DEMO_LOGS, DEMO_ALERTS, DEMO_COMPANIES } from "@/lib/demo";
import { PLANS } from "@/lib/plans";
import type { UserProfile, PatrolLog, GuardSession, Alert, Checkpoint } from "@/types";

interface DashboardProps {
  profile: UserProfile;
  onLogout: () => void;
}

type Tab = "overview" | "map" | "monitor" | "alerts" | "checkpoints" | "logs" | "settings";

const PLAN_ICON: Record<string, React.ElementType> = {
  basic: Shield,
  professional: Star,
  enterprise: Crown,
};

export default function Dashboard({ profile, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [recentLogs, setRecentLogs] = useState<PatrolLog[]>([]);
  const [sessions, setSessions] = useState<GuardSession[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);

  const isDemo = !isFirebaseReady;

  // Find company record for plan info (demo only)
  const demoCompany = isDemo ? DEMO_COMPANIES.find(c => c.id === profile.companyId) ?? DEMO_COMPANIES[0] : null;
  const currentPlanId = demoCompany?.plan ?? "basic";
  const currentPlan = PLANS[currentPlanId];
  const PlanIcon = PLAN_ICON[currentPlanId] ?? Shield;

  useEffect(() => {
    if (isDemo) {
      setSessions(DEMO_SESSIONS);
      setCheckpoints(DEMO_CHECKPOINTS);
      setRecentLogs(DEMO_LOGS);
      setAlerts(DEMO_ALERTS);
      return;
    }
    const u1 = subscribePatrolLogs(profile.companyId, setRecentLogs, 100);
    const u2 = subscribeGuardSessions(profile.companyId, setSessions);
    const u3 = subscribeAlerts(profile.companyId, setAlerts);
    const u4 = subscribeCheckpoints(profile.companyId, setCheckpoints);
    return () => { u1(); u2(); u3(); u4(); };
  }, [profile.companyId, isDemo]);

  const handleResolveAlert = useCallback(async (id: string) => {
    if (isDemo) {
      setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, resolved: true, resolvedAt: Date.now() } : a));
      return;
    }
    await resolveAlert(profile.companyId, id);
  }, [isDemo, profile.companyId]);

  const openAlerts = alerts.filter((a) => !a.resolved);
  const sosAlerts = openAlerts.filter((a) => a.kind === "sos");
  const activeGuards = sessions.filter((s) => s.status === "active").length;
  const scansToday = recentLogs.filter((l) => {
    const today = new Date();
    return new Date(l.scanTime ?? l.scannedAt).toDateString() === today.toDateString();
  }).length;

  const stats = [
    { label: "کل نگهبانان", value: String(sessions.length), icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { label: "فعال اکنون", value: String(activeGuards), icon: CheckCircle, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "هشدار باز", value: String(openAlerts.length), icon: AlertTriangle, color: openAlerts.length > 0 ? "text-red-400" : "text-yellow-400", bg: openAlerts.length > 0 ? "bg-red-400/10" : "bg-yellow-400/10" },
    { label: "اسکن‌های امروز", value: String(scansToday), icon: QrCode, color: "text-purple-400", bg: "bg-purple-400/10" },
  ];

  const navItems: { tab: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { tab: "overview",    label: "داشبورد",       icon: Activity },
    { tab: "map",         label: "نقشه زنده",      icon: Map },
    { tab: "monitor",     label: "مانیتور زنده",   icon: Monitor },
    { tab: "alerts",      label: "هشدارها",        icon: Bell, badge: openAlerts.length },
    { tab: "checkpoints", label: "ایستگاه‌ها",     icon: MapPin },
    { tab: "logs",        label: "گزارش گشت",      icon: FileText },
    { tab: "settings",    label: "تنظیمات",        icon: Settings },
  ];

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-3 px-2 mb-4 mt-2">
        <img src={arcGuardLogo} alt="ARC Guard" className="w-9 h-9 object-contain"
          style={{ filter: "drop-shadow(0 0 10px rgba(14,165,233,0.4))" }} />
        <div>
          <p className="text-xs font-bold text-primary tracking-wider">ARC Guard</p>
          <p className="text-[10px] text-muted-foreground truncate max-w-28">{profile.companyName ?? "مدیریت"}</p>
        </div>
      </div>

      {/* Plan badge */}
      <div className={`mx-2 mb-4 rounded-lg border ${currentPlan.border} ${currentPlan.bg} px-3 py-2 flex items-center gap-2`}>
        <PlanIcon className={`w-3.5 h-3.5 ${currentPlan.color} shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-bold ${currentPlan.color}`}>پلن {currentPlan.name}</p>
          <p className="text-[9px] text-muted-foreground">{currentPlan.price}</p>
        </div>
        <button onClick={() => { setActiveTab("settings"); setSidebarOpen(false); }}
          className="text-[9px] text-primary hover:underline shrink-0">
          مشاهده
        </button>
      </div>

      <nav className="flex-1 space-y-0.5">
        {navItems.map(({ tab, label, icon: Icon, badge }) => (
          <button key={tab} onClick={() => { setActiveTab(tab); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              activeTab === tab
                ? "bg-primary/15 text-primary border border-primary/20"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}>
            <Icon className="w-4 h-4" />
            <span className="flex-1 text-right">{label}</span>
            {badge != null && badge > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                tab === "alerts" && sosAlerts.length > 0 ? "bg-red-500 text-white animate-pulse" : "bg-yellow-500/20 text-yellow-400"
              }`}>{badge}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="pt-3 border-t border-border mt-2">
        <div className="px-2 mb-2">
          <p className="text-[10px] text-muted-foreground truncate">{profile.email}</p>
        </div>
        <button onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors">
          <LogOut className="w-4 h-4" />خروج از سیستم
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background arc-grid-bg flex flex-col">
      <AlertPopup alerts={openAlerts} onResolve={handleResolveAlert} />

      <MobileHeader
        title="ARC Guard"
        subtitle={profile.companyName ?? "مدیریت"}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        notificationCount={openAlerts.length}
      />

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}>
          <div className="absolute left-0 top-0 h-full w-60 bg-card border-r border-border p-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Mobile tab bar */}
      <div className="md:hidden flex overflow-x-auto border-b border-border bg-card/80 backdrop-blur shrink-0 scrollbar-none">
        {navItems.map(({ tab, label, icon: Icon, badge }) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`relative flex flex-col items-center gap-0.5 px-3 py-2 shrink-0 text-[9px] font-medium transition-colors border-b-2 ${
              activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}>
            <Icon className="w-4 h-4" />
            {label}
            {badge != null && badge > 0 && (
              <span className={`absolute top-1 right-1 w-3.5 h-3.5 flex items-center justify-center text-[8px] font-bold rounded-full ${
                tab === "alerts" && sosAlerts.length > 0 ? "bg-red-500 text-white animate-pulse" : "bg-yellow-500 text-black"
              }`}>{badge > 9 ? "9+" : badge}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 flex">
        <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card/50 p-4 shrink-0">
          <SidebarContent />
        </aside>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto">

          {/* ── Overview ── */}
          {activeTab === "overview" && (
            <div className="space-y-5 animate-fade-in-up max-w-3xl">
              <div>
                <h2 className="text-lg font-bold text-foreground">داشبورد امنیتی</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date().toLocaleDateString("fa-IR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>

              {sosAlerts.length > 0 && (
                <div className="rounded-xl border-2 border-red-500 bg-red-950/40 p-4 flex items-center gap-3">
                  <Radio className="w-6 h-6 text-red-400 animate-ping shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-red-400">🚨 {sosAlerts.length} هشدار SOS فعال</p>
                    <p className="text-xs text-red-300/70 mt-0.5">{sosAlerts.map(a => a.guardName).join("، ")} — نیاز به توجه فوری</p>
                  </div>
                  <button onClick={() => setActiveTab("alerts")}
                    className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors shrink-0">مشاهده</button>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {stats.map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors">
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

              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm font-semibold text-foreground">آخرین اسکن‌های گشت</span>
                  </div>
                  <button onClick={() => setActiveTab("logs")} className="text-xs text-primary hover:underline">همه</button>
                </div>
                {recentLogs.length === 0 ? (
                  <div className="px-4 py-8 text-center text-muted-foreground text-sm">هنوز هیچ اسکنی ثبت نشده است.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {recentLogs.slice(0, 5).map((log, i) => {
                      const s = log.status ?? (log.withinRadius ? "valid" : "outside");
                      return (
                        <div key={log.id ?? i} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${s === "valid" ? "bg-green-400" : s === "outside" ? "bg-yellow-400" : "bg-destructive"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">
                              <span className="font-medium">{log.guardName}</span>
                              <span className="text-muted-foreground"> ← </span>
                              <span className="text-primary">{log.checkpointName}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">{log.scannedAtText}{log.distanceMeters !== null && ` · ${log.distanceMeters} متر`}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                            s === "valid" ? "bg-green-400/10 text-green-400" :
                            s === "outside" ? "bg-yellow-400/10 text-yellow-400" : "bg-destructive/10 text-destructive"
                          }`}>{s === "valid" ? "معتبر" : s === "outside" ? "خارج" : "ناموفق"}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "نقشه زنده", tab: "map" as Tab, icon: Map, color: "text-green-400", bg: "bg-green-400/10 border-green-500/20" },
                  { label: "هشدارها", tab: "alerts" as Tab, icon: Bell, color: "text-red-400", bg: "bg-red-400/10 border-red-500/20" },
                  { label: "مانیتور زنده", tab: "monitor" as Tab, icon: Monitor, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
                  { label: "ایستگاه‌ها", tab: "checkpoints" as Tab, icon: MapPin, color: "text-sky-400", bg: "bg-sky-400/10 border-sky-500/20" },
                  { label: "گزارش گشت", tab: "logs" as Tab, icon: FileText, color: "text-purple-400", bg: "bg-purple-400/10 border-purple-500/20" },
                  { label: "تنظیمات", tab: "settings" as Tab, icon: Settings, color: "text-muted-foreground", bg: "bg-muted/30 border-border" },
                ].map(({ label, tab, icon: Icon, color, bg }) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`rounded-xl border ${bg} p-4 flex flex-col items-center gap-2 hover:opacity-80 transition-opacity`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                    <span className="text-xs font-medium text-foreground">{label}</span>
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-primary">سیستم عملیاتی · پلن {currentPlan.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {profile.companyName ?? profile.companyId} · {isDemo ? "حالت نمونه" : "Firebase متصل"} · GPS فعال
                  </p>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
              </div>
            </div>
          )}

          {activeTab === "map" && (
            <div className="animate-fade-in-up">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-foreground">نقشه زنده گشت</h2>
                <p className="text-xs text-muted-foreground mt-0.5">موقعیت نگهبانان، ایستگاه‌ها و مسیر گشت روی نقشه</p>
              </div>
              <LiveMapView sessions={sessions} checkpoints={checkpoints} logs={recentLogs} isDemo={isDemo} />
            </div>
          )}

          {activeTab === "monitor" && (
            <div className="max-w-3xl animate-fade-in-up">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-foreground">مانیتور زنده</h2>
                <p className="text-xs text-muted-foreground mt-0.5">موقعیت و وضعیت نگهبانان در لحظه</p>
              </div>
              <LiveMonitor companyId={profile.companyId} />
            </div>
          )}

          {activeTab === "alerts" && (
            <div className="max-w-2xl animate-fade-in-up">
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">هشدارها و اضطراری</h2>
                  {openAlerts.length > 0 && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      sosAlerts.length > 0 ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-yellow-500/20 text-yellow-400"
                    }`}>{openAlerts.length} باز</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">SOS نگهبانان، ایستگاه‌های از دست رفته، تخلفات GPS</p>
              </div>
              <AlertHistory alerts={alerts} companyId={profile.companyId} onAlertResolved={handleResolveAlert} />
            </div>
          )}

          {activeTab === "checkpoints" && (
            <div className="max-w-2xl animate-fade-in-up">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-foreground">مدیریت ایستگاه‌ها</h2>
                <p className="text-xs text-muted-foreground mt-0.5">تعریف نقاط گشت با GPS و کد QR</p>
              </div>
              <CheckpointManager companyId={profile.companyId} />
            </div>
          )}

          {activeTab === "logs" && (
            <div className="max-w-3xl animate-fade-in-up">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-foreground">گزارش گشت</h2>
                <p className="text-xs text-muted-foreground mt-0.5">تمام اسکن‌های نگهبانان با تأیید GPS</p>
              </div>
              <PatrolLogs companyId={profile.companyId} />
            </div>
          )}

          {activeTab === "settings" && (
            <div className="max-w-2xl animate-fade-in-up">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-foreground">تنظیمات شرکت</h2>
                <p className="text-xs text-muted-foreground mt-0.5">اطلاعات شرکت، پلن اشتراک، کد دعوت و مدیریت نگهبانان</p>
              </div>
              <CompanySettings profile={profile} />
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
