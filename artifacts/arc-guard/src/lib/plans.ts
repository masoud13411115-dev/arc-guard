import type { PlanId } from '@/types';

export interface PlanFeatures {
  liveMap: boolean;
  sos: boolean;
  patrolPaths: boolean;
  alertHistory: boolean;
  exportReports: boolean;
  apiAccess: boolean;
  multiManager: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  nameEn: string;
  price: string;
  priceNote: string;
  maxGuards: number;
  maxCheckpoints: number;
  features: PlanFeatures;
  color: string;
  border: string;
  bg: string;
  badgeBg: string;
}

export const PLANS: Record<PlanId, Plan> = {
  basic: {
    id: 'basic',
    name: 'پایه',
    nameEn: 'Basic',
    price: 'رایگان',
    priceNote: 'برای همیشه',
    maxGuards: 5,
    maxCheckpoints: 10,
    features: {
      liveMap: false,
      sos: false,
      patrolPaths: false,
      alertHistory: true,
      exportReports: false,
      apiAccess: false,
      multiManager: false,
    },
    color: 'text-slate-400',
    border: 'border-slate-500/30',
    bg: 'bg-slate-500/5',
    badgeBg: 'bg-slate-500/15 text-slate-400',
  },
  professional: {
    id: 'professional',
    name: 'حرفه‌ای',
    nameEn: 'Professional',
    price: '۵۰۰,۰۰۰ تومان',
    priceNote: 'ماهانه',
    maxGuards: 20,
    maxCheckpoints: 50,
    features: {
      liveMap: true,
      sos: true,
      patrolPaths: true,
      alertHistory: true,
      exportReports: true,
      apiAccess: false,
      multiManager: false,
    },
    color: 'text-primary',
    border: 'border-primary/30',
    bg: 'bg-primary/5',
    badgeBg: 'bg-primary/15 text-primary',
  },
  enterprise: {
    id: 'enterprise',
    name: 'سازمانی',
    nameEn: 'Enterprise',
    price: 'سفارشی',
    priceNote: 'تماس بگیرید',
    maxGuards: -1,
    maxCheckpoints: -1,
    features: {
      liveMap: true,
      sos: true,
      patrolPaths: true,
      alertHistory: true,
      exportReports: true,
      apiAccess: true,
      multiManager: true,
    },
    color: 'text-yellow-400',
    border: 'border-yellow-500/30',
    bg: 'bg-yellow-500/5',
    badgeBg: 'bg-yellow-400/15 text-yellow-400',
  },
};

export const PLAN_ORDER: PlanId[] = ['basic', 'professional', 'enterprise'];

export const FEATURE_LABELS: Record<keyof PlanFeatures, string> = {
  liveMap:       'نقشه زنده',
  sos:           'دکمه اضطراری SOS',
  patrolPaths:   'مسیر گشت روی نقشه',
  alertHistory:  'تاریخچه هشدارها',
  exportReports: 'خروجی اکسل',
  apiAccess:     'دسترسی API',
  multiManager:  'چند مدیر',
};

export function isFeatureAllowed(planId: PlanId, feature: keyof PlanFeatures): boolean {
  return PLANS[planId].features[feature];
}

export function isGuardLimitReached(planId: PlanId, current: number): boolean {
  const max = PLANS[planId].maxGuards;
  return max !== -1 && current >= max;
}

export function isCheckpointLimitReached(planId: PlanId, current: number): boolean {
  const max = PLANS[planId].maxCheckpoints;
  return max !== -1 && current >= max;
}

export function getLimitLabel(max: number): string {
  return max === -1 ? 'نامحدود' : String(max);
}

export function getUsagePct(current: number, max: number): number {
  if (max === -1) return 0;
  return Math.min(100, Math.round((current / max) * 100));
}

/** Generate a random 8-char invite code like ARC-X9F2 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'ARC-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
