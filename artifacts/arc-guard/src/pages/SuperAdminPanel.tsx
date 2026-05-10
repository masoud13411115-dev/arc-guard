import { useState, useEffect } from "react";
import {
  Building2, Users, Shield, LogOut, RefreshCw, ChevronDown,
  CheckCircle, XCircle, TrendingUp, Crown, Zap, Star,
  BarChart3, AlertTriangle, Search, MoreVertical, Settings
} from "lucide-react";
import arcGuardLogo from "/arc-guard-logo.png";
import { getAllCompanies, setCompanyPlan, setCompanySuspended } from "@/lib/firestore";
import { isFirebaseReady } from "@/firebase";
import { DEMO_COMPANIES } from "@/lib/demo";
import { PLANS, PLAN_ORDER, getLimitLabel } from "@/lib/plans";
import type { CompanyRecord, UserProfile, PlanId } from "@/types";

interface SuperAdminPanelProps {
  profile: UserProfile;
  onLogout: () => void;
}

const PLAN_ICON: Record<PlanId, React.ElementType> = {
  basic: Shield,
  professional: Star,
  enterprise: Crown,
};

function PlanBadge({ plan }: { plan: PlanId }) {
  const p = PLANS[plan];
  const Icon = PLAN_ICON[plan];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${p.badgeBg}`}>
      <Icon className="w-2.5 h-2.5" />
      {p.name}
    </span>
  );
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("fa-IR", { year: "numeric", month: "short", day: "numeric" });
}

export default function SuperAdminPanel({ profile, onLogout }: SuperAdminPanelProps) {
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanId | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [changingPlan, setChangingPlan] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const isDemo = !isFirebaseReady;

  const load = async () => {
    setLoading(true);
    if (isDemo) {
      setCompanies(DEMO_COMPANIES);
    } else {
      const data = await getAllCompanies();
      setCompanies(data);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = companies.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) &&
        !c.adminEmail.toLowerCase().includes(search.toLowerCase())) return false;
    if (planFilter !== "all" && c.plan !== planFilter) return false;
    if (statusFilter === "active" && (c.suspended || !c.active)) return false;
    if (statusFilter === "suspended" && !c.suspended) return false;
    return true;
  });

  const totalGuards = companies.reduce((s, c) => s + c.guardCount, 0);
  const activeCount = companies.filter((c) => c.active && !c.suspended).length;
  const planCounts = PLAN_ORDER.reduce((acc, p) => {
    acc[p] = companies.filter((c) => c.plan === p).length;
    return acc;
  }, {} as Record<PlanId, number>);

  const handlePlanChange = async (companyId: string, plan: PlanId) => {
    if (isDemo) {
      setCompanies((prev) => prev.map((c) => c.id === companyId ? { ...c, plan } : c));
      setChangingPlan(null);
      setActionMenu(null);
      return;
    }
    setProcessing(true);
    await setCompanyPlan(companyId, plan);
    setProcessing(false);
    setChangingPlan(null);
    setActionMenu(null);
    await load();
  };

  const handleToggleSuspend = async (company: CompanyRecord) => {
    if (isDemo) {
      setCompanies((prev) => prev.map((c) =>
        c.id === company.id ? { ...c, suspended: !c.suspended, active: c.suspended } : c
      ));
      setActionMenu(null);
      return;
    }
    setProcessing(true);
    await setCompanySuspended(company.id, !company.suspended);
    setProcessing(false);
    setActionMenu(null);
    await load();
  };

  return (
    <div className="min-h-screen bg-background arc-grid-bg flex flex-col" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur px-4 py-3 flex items-center gap-3">
        <img src={arcGuardLogo} alt="ARC Guard" className="w-8 h-8 object-contain"
          style={{ filter: "drop-shadow(0 0 10px rgba(14,165,233,0.5))" }} />
        <div className="flex-1">
          <p className="text-sm font-bold text-primary">ARC Guard</p>
          <p className="text-[10px] text-muted-foreground">پنل سوپر ادمین</p>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-yellow-400/10 border border-yellow-500/20">
          <Crown className="w-3 h-3 text-yellow-400" />
          <span className="text-[10px] font-bold text-yellow-400">Super Admin</span>
        </div>
        <button onClick={onLogout} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <main className="flex-1 p-4 md:p-6 space-y-5 max-w-5xl mx-auto w-full">

        {/* Demo notice */}
        {isDemo && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/8 px-3 py-2 flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
            <p className="text-xs text-yellow-300/80">
              <span className="font-bold text-yellow-400">حالت نمونه</span> — داده‌های نمونه چند شرکت نمایش داده می‌شوند. تغییرات ذخیره نمی‌شوند.
            </p>
          </div>
        )}

        {/* ── Platform stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "کل شرکت‌ها", value: companies.length, icon: Building2, color: "text-primary", bg: "bg-primary/10" },
            { label: "شرکت فعال", value: activeCount, icon: CheckCircle, color: "text-green-400", bg: "bg-green-400/10" },
            { label: "کل نگهبانان", value: totalGuards, icon: Users, color: "text-sky-400", bg: "bg-sky-400/10" },
            { label: "معلق", value: companies.filter(c => c.suspended).length, icon: XCircle, color: "text-red-400", bg: "bg-red-400/10" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Plan breakdown ── */}
        <div className="grid grid-cols-3 gap-3">
          {PLAN_ORDER.map((planId) => {
            const p = PLANS[planId];
            const Icon = PLAN_ICON[planId];
            const count = planCounts[planId] ?? 0;
            return (
              <div key={planId} className={`rounded-xl border ${p.border} ${p.bg} p-3 flex flex-col items-center gap-1.5`}>
                <Icon className={`w-5 h-5 ${p.color}`} />
                <p className={`text-lg font-bold ${p.color}`}>{count}</p>
                <p className="text-[10px] text-muted-foreground">{p.name}</p>
              </div>
            );
          })}
        </div>

        {/* ── Company list ── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-wrap gap-y-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجو در شرکت‌ها..."
                className="w-full bg-muted border border-border rounded-lg pr-9 pl-3 py-1.5 text-xs focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-1">
              {(["all", "active", "suspended"] as const).map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}>
                  {s === "all" ? "همه" : s === "active" ? "فعال" : "معلق"}
                </button>
              ))}
            </div>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value as PlanId | "all")}
              className="bg-muted border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary"
            >
              <option value="all">همه پلن‌ها</option>
              {PLAN_ORDER.map((p) => <option key={p} value={p}>{PLANS[p].name}</option>)}
            </select>
            <button onClick={load} className="p-1.5 rounded-lg bg-muted hover:bg-accent transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loading ? (
            <div className="p-10 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-muted-foreground/30 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 flex flex-col items-center gap-2">
              <Building2 className="w-8 h-8 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">شرکتی با این فیلتر یافت نشد</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((company) => (
                <div key={company.id} className={`px-4 py-3 hover:bg-accent/10 transition-colors ${company.suspended ? "opacity-60" : ""}`}>
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-sm font-bold shrink-0 ${PLANS[company.plan].bg} ${PLANS[company.plan].border}`}>
                      <span className={PLANS[company.plan].color}>{company.name.charAt(0)}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-foreground">{company.name}</p>
                        <PlanBadge plan={company.plan} />
                        {company.suspended && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">معلق</span>
                        )}
                        {company.trialEndsAt && company.trialEndsAt > Date.now() && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/20">آزمایشی</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{company.adminEmail}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Users className="w-2.5 h-2.5" />
                          {company.guardCount} / {getLimitLabel(PLANS[company.plan].maxGuards)} نگهبان
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Shield className="w-2.5 h-2.5" />
                          {company.checkpointCount} / {getLimitLabel(PLANS[company.plan].maxCheckpoints)} ایستگاه
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(company.createdAt)}
                        </span>
                        {company.notes && (
                          <span className="text-[10px] text-yellow-400/80">{company.notes}</span>
                        )}
                      </div>
                    </div>

                    {/* Action menu */}
                    <div className="relative shrink-0">
                      <button
                        onClick={() => setActionMenu(actionMenu === company.id ? null : company.id)}
                        className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {actionMenu === company.id && (
                        <div className="absolute left-0 top-8 z-20 w-44 rounded-xl border border-border bg-card shadow-xl overflow-hidden"
                          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
                          <div className="px-3 py-2 border-b border-border">
                            <p className="text-[10px] font-bold text-muted-foreground">تغییر پلن</p>
                          </div>
                          {PLAN_ORDER.map((planId) => {
                            const p = PLANS[planId];
                            const Icon = PLAN_ICON[planId];
                            return (
                              <button key={planId}
                                onClick={() => handlePlanChange(company.id, planId)}
                                disabled={company.plan === planId || processing}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors disabled:opacity-40 ${company.plan === planId ? "font-bold" : ""}`}
                              >
                                <Icon className={`w-3.5 h-3.5 ${p.color}`} />
                                <span className={p.color}>{p.name}</span>
                                {company.plan === planId && <CheckCircle className="w-3 h-3 text-green-400 mr-auto" />}
                              </button>
                            );
                          })}
                          <div className="border-t border-border">
                            <button
                              onClick={() => handleToggleSuspend(company)}
                              disabled={processing}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-accent ${company.suspended ? "text-green-400" : "text-red-400"} disabled:opacity-40`}
                            >
                              {company.suspended
                                ? <><CheckCircle className="w-3.5 h-3.5" />فعال کردن</>
                                : <><XCircle className="w-3.5 h-3.5" />معلق کردن</>}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Platform footer ── */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-primary">ARC Guard SaaS Platform</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {companies.length} شرکت · {totalGuards} نگهبان · {isDemo ? "حالت نمونه" : "Firebase متصل"}
            </p>
          </div>
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
        </div>

      </main>

      {/* Close action menu on outside click */}
      {actionMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setActionMenu(null)} />
      )}
    </div>
  );
}
