import { useState } from "react";
import {
  Users, Clock, CheckCircle, XCircle, TrendingUp,
  MapPin, QrCode, LogOut, Search, Filter, Download,
  Activity, Shield, AlertTriangle, ChevronRight
} from "lucide-react";
import arcGuardLogo from "/arc-guard-logo.png";
import MobileHeader from "@/components/MobileHeader";

interface DashboardProps {
  onLogout: () => void;
}

const mockRecords = [
  { id: 1, name: "Ali Mohammadi", code: "EMP001", branch: "Tehran HQ", type: "check-in", time: "08:12", gps: true, status: "on-time" },
  { id: 2, name: "Sara Hosseini", code: "EMP002", branch: "Isfahan", type: "check-in", time: "09:03", gps: true, status: "late" },
  { id: 3, name: "Reza Ahmadi", code: "EMP003", branch: "Tehran HQ", type: "check-out", time: "17:02", gps: true, status: "on-time" },
  { id: 4, name: "Maryam Karimi", code: "EMP004", branch: "Mashhad", type: "check-in", time: "07:55", gps: false, status: "on-time" },
  { id: 5, name: "Hossein Rezaei", code: "EMP005", branch: "Tehran HQ", type: "check-in", time: "08:30", gps: true, status: "on-time" },
  { id: 6, name: "Fateme Sadeghi", code: "EMP006", branch: "Shiraz", type: "check-out", time: "16:45", gps: true, status: "early" },
];

const stats = [
  { label: "Total Employees", value: "124", icon: Users, color: "text-primary", bg: "bg-primary/10", trend: "+3" },
  { label: "Present Today", value: "98", icon: CheckCircle, color: "text-green-400", bg: "bg-green-400/10", trend: "+5" },
  { label: "Absent", value: "18", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", trend: "-2" },
  { label: "Late Check-ins", value: "8", icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-400/10", trend: "+1" },
];

export default function Dashboard({ onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "records" | "employees">("overview");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filtered = mockRecords.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      r.branch.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background arc-grid-bg flex flex-col">
      {/* Mobile Header */}
      <MobileHeader
        title="ARC Guard"
        subtitle="Manager Panel"
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        notificationCount={3}
      />

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        >
          <div
            className="absolute left-0 top-0 h-full w-64 bg-card border-r border-border p-6 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-8">
              <img
                src={arcGuardLogo}
                alt="ARC Guard"
                className="w-10 h-10 object-contain"
                style={{ filter: "drop-shadow(0 0 10px rgba(14,165,233,0.5))" }}
              />
              <div>
                <p className="text-sm font-bold text-primary tracking-wider">ARC Guard</p>
                <p className="text-xs text-muted-foreground">Manager Panel</p>
              </div>
            </div>
            <nav className="flex-1 space-y-1">
              {[
                { label: "Overview", tab: "overview", icon: Activity },
                { label: "Records", tab: "records", icon: Clock },
                { label: "Employees", tab: "employees", icon: Users },
              ].map(({ label, tab, icon: Icon }) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab as typeof activeTab); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    activeTab === tab
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </nav>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors mt-4"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card/50 p-4 shrink-0">
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
            {[
              { label: "Overview", tab: "overview", icon: Activity },
              { label: "Records", tab: "records", icon: Clock },
              { label: "Employees", tab: "employees", icon: Users },
            ].map(({ label, tab, icon: Icon }) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as typeof activeTab)}
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
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {/* Tab: Overview */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-fade-in-up">
              <div>
                <h2 className="text-lg font-bold text-foreground tracking-wide">Dashboard Overview</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Today · {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {stats.map(({ label, value, icon: Icon, color, bg, trend }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors"
                    style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}
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

              {/* Recent Activity */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Recent Activity</span>
                  </div>
                  <button
                    onClick={() => setActiveTab("records")}
                    className="text-xs text-primary hover:underline"
                  >
                    View all
                  </button>
                </div>
                <div className="divide-y divide-border">
                  {mockRecords.slice(0, 4).map((rec) => (
                    <div key={rec.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        rec.type === "check-in" ? "bg-green-400/15 text-green-400" : "bg-blue-400/15 text-blue-400"
                      }`}>
                        {rec.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{rec.name}</p>
                        <p className="text-xs text-muted-foreground">{rec.branch} · {rec.code}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          rec.type === "check-in"
                            ? "bg-green-400/10 text-green-400"
                            : "bg-blue-400/10 text-blue-400"
                        }`}>
                          {rec.type === "check-in" ? "In" : "Out"}
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">{rec.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security Status */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-primary">System Secure</p>
                  <p className="text-xs text-muted-foreground mt-0.5">All GPS validations active · QR tokens refreshed</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
              </div>
            </div>
          )}

          {/* Tab: Records */}
          {activeTab === "records" && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground tracking-wide">Attendance Records</h2>
                <button className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition-colors">
                  <Download className="w-3 h-3" />
                  Export
                </button>
              </div>

              {/* Search & Filter */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, code, branch..."
                    className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <button className="flex items-center gap-1.5 px-3 py-2 bg-card border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors">
                  <Filter className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Records Table */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="hidden md:grid grid-cols-6 gap-4 px-4 py-2.5 border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase tracking-wider">
                  <span className="col-span-2">Employee</span>
                  <span>Branch</span>
                  <span>Type</span>
                  <span>Time</span>
                  <span>GPS</span>
                </div>
                <div className="divide-y divide-border">
                  {filtered.map((rec) => (
                    <div key={rec.id} className="flex md:grid md:grid-cols-6 gap-3 md:gap-4 items-center px-4 py-3 hover:bg-accent/20 transition-colors">
                      <div className="col-span-2 flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {rec.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{rec.name}</p>
                          <p className="text-xs text-muted-foreground">{rec.code}</p>
                        </div>
                      </div>
                      <span className="hidden md:block text-xs text-muted-foreground truncate">{rec.branch}</span>
                      <span className={`hidden md:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium w-fit ${
                        rec.type === "check-in" ? "bg-green-400/10 text-green-400" : "bg-blue-400/10 text-blue-400"
                      }`}>
                        {rec.type === "check-in" ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {rec.type}
                      </span>
                      <span className="hidden md:block text-sm text-foreground font-mono">{rec.time}</span>
                      <div className="hidden md:flex items-center gap-1">
                        {rec.gps ? (
                          <MapPin className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <MapPin className="w-3.5 h-3.5 text-destructive" />
                        )}
                        <span className={`text-xs ${rec.gps ? "text-green-400" : "text-destructive"}`}>
                          {rec.gps ? "Valid" : "None"}
                        </span>
                      </div>
                      {/* Mobile condensed view */}
                      <div className="md:hidden ml-auto text-right shrink-0">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          rec.status === "on-time" ? "text-green-400" : rec.status === "late" ? "text-yellow-400" : "text-blue-400"
                        }`}>
                          {rec.time}
                        </span>
                        <p className="text-xs text-muted-foreground">{rec.branch}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Employees */}
          {activeTab === "employees" && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground tracking-wide">Employee Directory</h2>
                <button className="flex items-center gap-1.5 text-xs text-primary-foreground bg-primary rounded-lg px-3 py-1.5 hover:opacity-90 transition-opacity font-medium">
                  + Add Employee
                </button>
              </div>
              <div className="grid gap-3">
                {mockRecords.map((emp) => (
                  <div
                    key={emp.id}
                    className="rounded-xl border border-border bg-card p-4 flex items-center gap-4 hover:border-primary/30 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                      {emp.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{emp.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{emp.code} · {emp.branch}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="hidden sm:flex items-center gap-1 text-xs">
                        <QrCode className="w-3.5 h-3.5 text-primary" />
                        <span className="text-muted-foreground">QR Active</span>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
