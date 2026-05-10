import type { UserProfile, Checkpoint, PatrolLog, GuardSession, Alert, CompanyRecord } from '@/types';

export const DEMO_COMPANY_ID = 'demo-company';

export const DEMO_MANAGER_PROFILE: UserProfile = {
  uid: 'demo-manager',
  email: 'manager@demo.arcguard',
  displayName: 'مدیر نمونه',
  role: 'manager',
  companyId: DEMO_COMPANY_ID,
  companyName: 'شرکت امنیتی آرک (نمونه)',
  active: true,
  createdAt: Date.now(),
};

export const DEMO_GUARD_PROFILE: UserProfile = {
  uid: 'demo-guard',
  email: 'guard@demo.arcguard',
  displayName: 'علی محمدی',
  role: 'guard',
  companyId: DEMO_COMPANY_ID,
  companyName: 'شرکت امنیتی آرک (نمونه)',
  guardCode: 'GUARD001',
  active: true,
  createdAt: Date.now(),
};

export const DEMO_SUPER_ADMIN_PROFILE: UserProfile = {
  uid: 'demo-super-admin',
  email: 'admin@arcguard.io',
  displayName: 'سوپر ادمین',
  role: 'super_admin',
  companyId: 'platform',
  companyName: 'ARC Guard Platform',
  active: true,
  createdAt: Date.now(),
};

const now = Date.now();

export const DEMO_COMPANIES: CompanyRecord[] = [
  {
    id: 'demo-company',
    name: 'شرکت امنیتی آرک (نمونه)',
    adminUid: 'demo-manager',
    adminEmail: 'manager@demo.arcguard',
    plan: 'professional',
    active: true,
    suspended: false,
    inviteCode: 'ARC-DEMO',
    guardCount: 3,
    checkpointCount: 4,
    createdAt: now - 30 * 24 * 3600 * 1000,
    trialEndsAt: now + 10 * 24 * 3600 * 1000,
  },
  {
    id: 'company-2',
    name: 'نگهبانان پارس',
    adminUid: 'manager-2',
    adminEmail: 'admin@pars.ir',
    plan: 'basic',
    active: true,
    suspended: false,
    inviteCode: 'ARC-P2R8',
    guardCount: 2,
    checkpointCount: 6,
    createdAt: now - 60 * 24 * 3600 * 1000,
  },
  {
    id: 'company-3',
    name: 'گروه امنیتی سینا',
    adminUid: 'manager-3',
    adminEmail: 'security@sina.ir',
    plan: 'enterprise',
    active: true,
    suspended: false,
    inviteCode: 'ARC-S9N4',
    guardCount: 18,
    checkpointCount: 42,
    createdAt: now - 90 * 24 * 3600 * 1000,
  },
  {
    id: 'company-4',
    name: 'شرکت حفاظتی ستاره',
    adminUid: 'manager-4',
    adminEmail: 'info@sotareh.com',
    plan: 'basic',
    active: false,
    suspended: true,
    inviteCode: 'ARC-ST52',
    guardCount: 0,
    checkpointCount: 0,
    createdAt: now - 15 * 24 * 3600 * 1000,
    notes: 'معلق — عدم پرداخت',
  },
];

export const DEMO_CHECKPOINTS: Checkpoint[] = [
  { id: 'cp1', name: 'دروازه اصلی', location: 'ورودی شمالی', qrCode: 'ARC_GUARD_CP_MAIN_GATE', lat: 35.6892, lng: 51.3890, radiusMeters: 50, patrolIntervalMinutes: 120, active: true, companyId: DEMO_COMPANY_ID, createdAt: now - 86400000 },
  { id: 'cp2', name: 'اتاق سرور', location: 'ساختمان فناوری، طبقه B1', qrCode: 'ARC_GUARD_CP_SERVER_ROOM', lat: 35.6901, lng: 51.3912, radiusMeters: 30, patrolIntervalMinutes: 60, active: true, companyId: DEMO_COMPANY_ID, createdAt: now - 86400000 },
  { id: 'cp3', name: 'پارکینگ B', location: 'زیرزمین، جنوب غربی', qrCode: 'ARC_GUARD_CP_PARKING_B', lat: 35.6855, lng: 51.3775, radiusMeters: 80, patrolIntervalMinutes: 90, active: true, companyId: DEMO_COMPANY_ID, createdAt: now - 86400000 },
  { id: 'cp4', name: 'دسترسی پشت‌بام', location: 'ساختمان اصلی، طبقه آخر', qrCode: 'ARC_GUARD_CP_ROOF', lat: 35.6893, lng: 51.3891, radiusMeters: 25, patrolIntervalMinutes: 240, active: true, companyId: DEMO_COMPANY_ID, createdAt: now - 86400000 },
];

export const DEMO_LOGS: PatrolLog[] = [
  { id: 'dl1', guardId: 'demo-guard', guardName: 'علی محمدی', checkpointId: 'cp1', checkpointName: 'دروازه اصلی', qrScanned: 'ARC_GUARD_CP_MAIN_GATE', gps: { lat: 35.6892, lng: 51.389, accuracy: 8 }, distanceMeters: 6, withinRadius: true, status: 'valid', scanTime: now - 3 * 60000, scannedAt: now - 3 * 60000, scannedAtText: new Date(now - 3 * 60000).toLocaleString('fa-IR'), companyId: DEMO_COMPANY_ID, synced: true },
  { id: 'dl2', guardId: 'demo-guard2', guardName: 'سارا حسینی', checkpointId: 'cp2', checkpointName: 'اتاق سرور', qrScanned: 'ARC_GUARD_CP_SERVER_ROOM', gps: { lat: 35.6901, lng: 51.3912, accuracy: 15 }, distanceMeters: 12, withinRadius: true, status: 'valid', scanTime: now - 11 * 60000, scannedAt: now - 11 * 60000, scannedAtText: new Date(now - 11 * 60000).toLocaleString('fa-IR'), companyId: DEMO_COMPANY_ID, synced: true },
  { id: 'dl3', guardId: 'demo-guard3', guardName: 'رضا احمدی', checkpointId: 'cp3', checkpointName: 'پارکینگ B', qrScanned: 'ARC_GUARD_CP_PARKING_B', gps: { lat: 35.6855, lng: 51.3775, accuracy: 42 }, distanceMeters: 94, withinRadius: false, status: 'outside', scanTime: now - 48 * 60000, scannedAt: now - 48 * 60000, scannedAtText: new Date(now - 48 * 60000).toLocaleString('fa-IR'), companyId: DEMO_COMPANY_ID, synced: true },
  { id: 'dl4', guardId: 'demo-guard', guardName: 'علی محمدی', checkpointId: 'cp4', checkpointName: 'دسترسی پشت‌بام', qrScanned: 'ARC_GUARD_CP_ROOF', gps: { lat: 35.6893, lng: 51.3891, accuracy: 10 }, distanceMeters: 3, withinRadius: true, status: 'valid', scanTime: now - 65 * 60000, scannedAt: now - 65 * 60000, scannedAtText: new Date(now - 65 * 60000).toLocaleString('fa-IR'), companyId: DEMO_COMPANY_ID, synced: true },
];

export const DEMO_SESSIONS: GuardSession[] = [
  { guardId: 'demo-guard', guardName: 'علی محمدی', lastSeen: now - 3 * 60000, lastCheckpoint: 'دروازه اصلی', lastGps: { lat: 35.6892, lng: 51.389, accuracy: 8 }, status: 'active', companyId: DEMO_COMPANY_ID },
  { guardId: 'demo-guard2', guardName: 'سارا حسینی', lastSeen: now - 11 * 60000, lastCheckpoint: 'اتاق سرور', lastGps: { lat: 35.6901, lng: 51.3912, accuracy: 15 }, status: 'active', companyId: DEMO_COMPANY_ID },
  { guardId: 'demo-guard3', guardName: 'رضا احمدی', lastSeen: now - 45 * 60000, lastCheckpoint: 'پارکینگ B', lastGps: null, status: 'idle', companyId: DEMO_COMPANY_ID },
];

export const DEMO_ALERTS: Alert[] = [
  {
    id: 'da1',
    kind: 'sos',
    guardId: 'demo-guard3',
    guardName: 'رضا احمدی',
    gps: { lat: 35.6855, lng: 51.3775, accuracy: 20 },
    alertedAt: now - 8 * 60000,
    companyId: DEMO_COMPANY_ID,
    resolved: false,
    message: 'اضطراری توسط نگهبان فعال شد',
  },
  {
    id: 'da2',
    kind: 'missed',
    guardId: 'demo-guard3',
    guardName: 'رضا احمدی',
    checkpointId: 'cp1',
    checkpointName: 'دروازه اصلی',
    scheduledAt: now - 35 * 60000,
    alertedAt: now - 20 * 60000,
    companyId: DEMO_COMPANY_ID,
    resolved: false,
    message: 'بازدید از ایستگاه در زمان مقرر انجام نشد',
  },
  {
    id: 'da3',
    kind: 'outside',
    guardId: 'demo-guard3',
    guardName: 'رضا احمدی',
    checkpointId: 'cp3',
    checkpointName: 'پارکینگ B',
    gps: { lat: 35.6855, lng: 51.3775, accuracy: 42 },
    distanceMeters: 94,
    alertedAt: now - 48 * 60000,
    companyId: DEMO_COMPANY_ID,
    resolved: true,
    resolvedAt: now - 30 * 60000,
    message: 'اسکن از خارج از محدوده مجاز انجام شد (۹۴ متر)',
  },
  {
    id: 'da4',
    kind: 'missed',
    guardId: 'demo-guard2',
    guardName: 'سارا حسینی',
    checkpointId: 'cp4',
    checkpointName: 'دسترسی پشت‌بام',
    scheduledAt: now - 4 * 3600000,
    alertedAt: now - 3.5 * 3600000,
    companyId: DEMO_COMPANY_ID,
    resolved: true,
    resolvedAt: now - 3 * 3600000,
    message: 'بازدید از ایستگاه در زمان مقرر انجام نشد',
  },
];

export const DEMO_GUARDS: UserProfile[] = [
  { uid: 'demo-guard', email: 'guard@demo.arcguard', displayName: 'علی محمدی', role: 'guard', companyId: DEMO_COMPANY_ID, companyName: 'شرکت امنیتی آرک (نمونه)', guardCode: 'GUARD001', active: true, createdAt: now - 20 * 24 * 3600000 },
  { uid: 'demo-guard2', email: 'sara@demo.arcguard', displayName: 'سارا حسینی', role: 'guard', companyId: DEMO_COMPANY_ID, companyName: 'شرکت امنیتی آرک (نمونه)', guardCode: 'GUARD002', active: true, createdAt: now - 15 * 24 * 3600000 },
  { uid: 'demo-guard3', email: 'reza@demo.arcguard', displayName: 'رضا احمدی', role: 'guard', companyId: DEMO_COMPANY_ID, companyName: 'شرکت امنیتی آرک (نمونه)', guardCode: 'GUARD003', active: true, createdAt: now - 10 * 24 * 3600000 },
];
