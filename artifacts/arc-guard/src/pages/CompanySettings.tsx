import { useState, useEffect } from "react";
import {
  Building2, Users, Shield, Copy, Check, RefreshCw,
  Crown, Star, UserX, UserCheck,
  TrendingUp, Key, Info, Lock
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getCompany, getCompanyGuards, setGuardActive, regenerateInviteCode } from "@/lib/adapter";
import AdapterStatusBadge from "@/components/AdapterStatusBadge";
import AdapterModeSelector from "@/components/AdapterModeSelector";
import {
  PLANS, PLAN_ORDER, FEATURE_LABELS, getUsagePct, getLimitLabel
} from "@/lib/plans";
import type { UserProfile, CompanyRecord, PlanId } from "@/types";

interface CompanySettingsProps {
  profile: UserProfile;
}

const PLAN_ICON: Record<PlanId, React.ElementType> = {
  basic: Shield,
  professional: Star,
  enterprise: Crown,
};

function UsageBar({ current, max, color, usedLabel, maxLabel }: {
  current: number; max: number; color: string; usedLabel: string; maxLabel: string;
}) {
  const pct = getUsagePct(current, max);
  const isUnlimited = max === -1;
  const isWarning = !isUnlimited && pct >= 80;
  const barColor = isWarning ? "bg-yellow-400" : isUnlimited ? "bg-green-400" : color;

  return (
    <div className="space-y-1">
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${isUnlimited ? 30 : pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{usedLabel}</span>
        <span>{getLimitLabel(max)} {maxLabel}</span>
      </div>
    </div>
  );
}

export default function CompanySettings({ profile }: CompanySettingsProps) {
  const { t, dir } = useI18n();
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [guards, setGuards] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [togglingGuard, setTogglingGuard] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [c, gs] = await Promise.all([
      getCompany(profile.companyId),
      getCompanyGuards(profile.companyId),
    ]);
    setCompany(c);
    setGuards(gs);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile.companyId]);

  const handleCopyCode = () => {
    if (!company) return;
    navigator.clipboard.writeText(company.inviteCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerateCode = async () => {
    if (!company) return;
    setRegenerating(true);
    const newCode = await regenerateInviteCode(company.id);
    setCompany((prev) => prev ? { ...prev, inviteCode: newCode } : prev);
    setRegenerating(false);
  };

  const handleToggleGuard = async (guard: UserProfile) => {
    setTogglingGuard(guard.uid);
    await setGuardActive(guard.uid, !guard.active);
    setTogglingGuard(null);
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-6 h-6 text-muted-foreground/30 animate-spin" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
        {t("settings.company.notfound")}
      </div>
    );
  }

  const plan = PLANS[company.plan];
  const PlanIcon = PLAN_ICON[company.plan];
  const trialDaysLeft = company.trialEndsAt
    ? Math.max(0, Math.round((company.trialEndsAt - Date.now()) / 86400000))
    : null;

  return (
    <div className="space-y-4" dir={dir}>

      {/* ── Current plan card ── */}
      <div className={`rounded-xl border-2 ${plan.border} ${plan.bg} p-4`}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl border ${plan.border} flex items-center justify-center shrink-0`}>
            <PlanIcon className={`w-5 h-5 ${plan.color}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className={`text-base font-bold ${plan.color}`}>{t("settings.plan.prefix")} {plan.name}</p>
              {trialDaysLeft !== null && trialDaysLeft > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/20">
                  {t("settings.plan.trial", { n: trialDaysLeft })}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{plan.price} · {plan.priceNote}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Users className="w-3 h-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground font-medium">{t("settings.usage.guards")}</p>
            </div>
            <UsageBar
              current={company.guardCount}
              max={plan.maxGuards}
              color="bg-primary"
              usedLabel={t("settings.usage.used", { n: company.guardCount })}
              maxLabel={t("settings.usage.max", { n: plan.maxGuards === -1 ? "∞" : plan.maxGuards })}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground font-medium">{t("settings.usage.checkpoints")}</p>
            </div>
            <UsageBar
              current={company.checkpointCount}
              max={plan.maxCheckpoints}
              color="bg-sky-400"
              usedLabel={t("settings.usage.used", { n: company.checkpointCount })}
              maxLabel={t("settings.usage.max", { n: plan.maxCheckpoints === -1 ? "∞" : plan.maxCheckpoints })}
            />
          </div>
        </div>
      </div>

      {/* ── Feature comparison ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">{t("settings.features.title")}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">{t("settings.features.feature")}</th>
                {PLAN_ORDER.map((planId) => {
                  const p = PLANS[planId];
                  const Icon = PLAN_ICON[planId];
                  return (
                    <th key={planId} className={`px-3 py-2.5 font-bold text-center ${p.color} ${company.plan === planId ? `bg-current/5` : ""}`}>
                      <div className="flex flex-col items-center gap-0.5">
                        <Icon className="w-3.5 h-3.5" />
                        <span>{p.name}</span>
                        {company.plan === planId && <span className="text-[9px] font-normal text-muted-foreground">{t("settings.features.current")}</span>}
                      </div>
                    </th>
                  );
                })}
              </tr>
              <tr className="border-b border-border bg-muted/20">
                <td className="px-4 py-2 text-muted-foreground">{t("settings.usage.guards")}</td>
                {PLAN_ORDER.map((p) => (
                  <td key={p} className={`px-3 py-2 text-center font-bold ${PLANS[p].color}`}>
                    {getLimitLabel(PLANS[p].maxGuards)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border">
                <td className="px-4 py-2 text-muted-foreground">{t("settings.usage.checkpoints")}</td>
                {PLAN_ORDER.map((p) => (
                  <td key={p} className={`px-3 py-2 text-center font-bold ${PLANS[p].color}`}>
                    {getLimitLabel(PLANS[p].maxCheckpoints)}
                  </td>
                ))}
              </tr>
              {(Object.keys(FEATURE_LABELS) as (keyof typeof FEATURE_LABELS)[]).map((feat) => (
                <tr key={feat} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-muted-foreground">{FEATURE_LABELS[feat]}</td>
                  {PLAN_ORDER.map((planId) => (
                    <td key={planId} className={`px-3 py-2 text-center ${company.plan === planId ? "bg-current/5" : ""}`}>
                      {PLANS[planId].features[feat]
                        ? <Check className="w-3.5 h-3.5 text-green-400 mx-auto" />
                        : <Lock className="w-3 h-3 text-muted-foreground/30 mx-auto" />}
                    </td>
                  ))}
                </tr>
              ))}
            </thead>
          </table>
        </div>
        {company.plan !== "enterprise" && (
          <div className="px-4 py-3 border-t border-border bg-primary/5">
            <p className="text-xs text-primary font-medium">
              {t("settings.upgrade.msg")}
            </p>
          </div>
        )}
      </div>

      {/* ── Invite code ── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">{t("settings.invite.title")}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("settings.invite.desc")}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted border border-border rounded-lg px-4 py-2.5 font-mono text-base font-bold text-primary tracking-[0.2em] text-center select-all">
            {company.inviteCode}
          </div>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? t("common.copied") : t("common.copy")}
          </button>
          <button
            onClick={handleRegenerateCode}
            disabled={regenerating}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-muted border border-border text-muted-foreground text-xs hover:bg-accent transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`} />
            {t("settings.invite.new")}
          </button>
        </div>
        <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{t("settings.invite.hint")}</span>
        </div>
      </div>

      {/* ── Guard management ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">{t("settings.guards.title")}</span>
            <span className="text-xs text-muted-foreground">({guards.length})</span>
          </div>
        </div>
        {guards.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            {t("settings.guards.empty")}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {guards.map((g) => (
              <div key={g.uid} className={`flex items-center gap-3 px-4 py-3 ${!g.active ? "opacity-50" : ""}`}>
                <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {g.displayName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{g.displayName}</p>
                  {g.guardCode && (
                    <p className="text-[10px] font-mono text-primary/70">{g.guardCode}</p>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    g.active ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                  }`}>
                    {g.active ? t("settings.guard.active") : t("settings.guard.inactive")}
                  </span>
                  <button
                    onClick={() => handleToggleGuard(g)}
                    disabled={togglingGuard === g.uid}
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                      g.active ? "hover:bg-red-500/10 text-muted-foreground hover:text-red-400" : "hover:bg-green-500/10 text-muted-foreground hover:text-green-400"
                    }`}
                  >
                    {togglingGuard === g.uid
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : g.active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Company info ── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-bold text-foreground">{t("settings.company.title")}</span>
        </div>
        {[
          { label: t("settings.company.name"), value: company.name },
          { label: t("settings.company.admin"), value: "@" + company.adminUsername },
          { label: t("settings.company.id"), value: company.id, mono: true },
          { label: t("settings.company.date"), value: new Date(company.createdAt).toLocaleDateString("fa-IR") },
        ].map(({ label, value, mono }) => (
          <div key={label} className="flex items-center justify-between gap-3 py-1 border-b border-border/50 last:border-0">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className={`text-xs font-medium text-foreground ${mono ? "font-mono text-[10px]" : ""}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* ── Adapter status + mode selector ── */}
      <AdapterStatusBadge />
      <AdapterModeSelector />
    </div>
  );
}
