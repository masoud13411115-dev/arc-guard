import { useState } from "react";
import {
  Users, Clock, CheckCircle, XCircle, TrendingUp,
  MapPin, QrCode, LogOut, Search, Filter, Download,
  Activity, Shield, AlertTriangle, ChevronRight,
  Monitor, Settings, FileText
} from "lucide-react";
import arcGuardLogo from "/arc-guard-logo.png";
import MobileHeader from "@/components/MobileHeader";
import LiveMonitor from "./LiveMonitor";
import CheckpointManager from "./CheckpointManager";
import PatrolLogs from "./PatrolLogs";

interface DashboardProps {
  onLogout: () => void;
}

const mockStats = [
  { label: "Total Guards", value: "12", icon: Users, color: "text-primary", bg: "bg-primary/10", trend: "+1" },
  { label: "Active Now", value: "8", icon: CheckCircle, color: "text-green-400", bg: "bg-green-400/10", trend: "+2" },
  { label: "Open Alerts", value: "3", icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-400/10", trend: "+1" },
  { label: "Scans Today", value: "47", icon: QrCode, color: "text-purple-400", bg: "bg-purple-400/10", trend: "+12" },
];

const mockRecentLogs = [
  { id: 1, guard: "Ali Mohammadi", checkpoint: "Main Gate", time: "14:32", ok: true, dist: 8 },
  { id: 2, guard: "Sara Hosseini", checkpoint: "Server Room", time: "14:18", ok: true, dist: 12 },
  { id: 3, guard: "Reza Ahmadi", checkpoint: "Parking B", time: "14:05", ok: false, dist: 87 },
  { id: 4, guard: "Maryam Karimi", checkpoint: "Main Gate", time: "13:51", ok: true, dist: 5 },
];

type Tab = "overview" | "monitor" | "checkpoints" | "logs";

export default function Dashboard({ onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems: { tab: Tab; label: string; icon: React.ElementType }[] = [
    { tab: "overview", label: "Overview", icon: Activity },
    { tab: "monitor", label: "Live Monitor", icon: Monitor },
    { tab: "checkpoints", label: "Checkpoints", icon: MapPin },
    { tab: "logs", label: "Patrol Logs", icon: FileText },
  ];

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-3 px-2 mb-6 mt-2">
        <img
          src={arcGuardLogo}
          alt="ARC Guard"
          className="w-9 h-9 object-contain"
          style={{ filter: "drop-shadow(0 0 10px rgba(14,165,233,0.4))" }}
        />
        <div>
          <p className="text-xs font-bold text-primary tracking-wider">ARC Guard</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Manager</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1">
        {navItems.map(({ tab, label, icon: Icon }) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              activeTab === tab
                ? "bg-primary/15 text-primary border border-primary/20"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {activeTab === tab && <ChevronRight className="w-3 h-3 ml-auto" />}
          </button>
        ))}
      </nav>
      <button
        onClick={onLogout}
        className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors mt-2"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </>
  );

  return (
    <div className="min-h-screen bg-background arc-grid-bg flex flex-col">
      <MobileHeader
        title="ARC Guard"
        subtitle="Manager"
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        notificationCount={3}
      />

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        >
          <div
            className="absolute left-0 top-0 h-full w-60 bg-card border-r border-border p-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent />
          </div>
        </div>
      )}

      <div className="flex-1 flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card/50 p-4 shrink-0">
          <SidebarContent />
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">

          {/* Overview */}
          {activeTab === "overview" && (
            <div className="space-y-5 animate-fade-in-up max-w-3xl">
              <div>
                <h2 className="text-lg font-bold text-foreground tracking-wide">Security Overview</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {mockStats.map(({ label, value, icon: Icon, color, bg, trend }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>
                      <span className={`text-xs font-medium ${trend.startsWith("+") ? "text-green-400" : "text-destructive"}`}>
                        {trend}
                      </span>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent Patrol Activity */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm font-semibold text-foreground">Recent Patrol Scans</span>
                  </div>
                  <button
                    onClick={() => setActiveTab("logs")}
                    className="text-xs text-primary hover:underline"
                  >
                    View all
                  </button>
                </div>
                <div className="divide-y divide-border">
                  {mockRecentLogs.map((log) => (
                    <div key={log.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${log.ok ? "bg-green-400" : "bg-destructive"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">
                          <span className="font-medium">{log.guard}</span>
                          <span className="text-muted-foreground"> → </span>
                          <span className="text-primary">{log.checkpoint}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{log.time} · {log.dist}m from checkpoint</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                        log.ok ? "bg-green-400/10 text-green-400" : "bg-destructive/10 text-destructive"
                      }`}>
                        {log.ok ? "Valid" : "Outside"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Live Monitor", tab: "monitor" as Tab, icon: Monitor, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
                  { label: "Checkpoints", tab: "checkpoints" as Tab, icon: MapPin, color: "text-green-400", bg: "bg-green-400/10 border-green-500/20" },
                  { label: "Patrol Logs", tab: "logs" as Tab, icon: FileText, color: "text-purple-400", bg: "bg-purple-400/10 border-purple-500/20" },
                ].map(({ label, tab, icon: Icon, color, bg }) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-xl border ${bg} p-4 flex flex-col items-center gap-2 hover:opacity-80 transition-opacity`}
                  >
                    <Icon className={`w-6 h-6 ${color}`} />
                    <span className="text-xs font-medium text-foreground">{label}</span>
                  </button>
                ))}
              </div>

              {/* Security Status */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-primary">System Operational</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    GPS validation active · QR tokens refreshed · Firebase sync enabled
                  </p>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
              </div>
            </div>
          )}

          {/* Live Monitor */}
          {activeTab === "monitor" && (
            <div className="max-w-3xl animate-fade-in-up">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-foreground tracking-wide">Live Monitor</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Real-time guard positions and alerts</p>
              </div>
              <LiveMonitor />
            </div>
          )}

          {/* Checkpoints */}
          {activeTab === "checkpoints" && (
            <div className="max-w-2xl animate-fade-in-up">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-foreground tracking-wide">Checkpoint Manager</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Configure patrol checkpoints with GPS and QR codes</p>
              </div>
              <CheckpointManager />
            </div>
          )}

          {/* Logs */}
          {activeTab === "logs" && (
            <div className="max-w-3xl animate-fade-in-up">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-foreground tracking-wide">Patrol Logs</h2>
                <p className="text-xs text-muted-foreground mt-0.5">All guard patrol scan records with GPS verification</p>
              </div>
              <PatrolLogs />
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
