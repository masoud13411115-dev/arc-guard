import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, collection, addDoc,
} from 'firebase/firestore';
import { auth, db, isFirebaseReady } from '@/firebase';
import type { UserProfile, Company, CompanyRecord } from '@/types';
import { generateInviteCode } from '@/lib/plans';
import { DEMO_MANAGER_PROFILE, DEMO_GUARD_PROFILE, DEMO_SUPER_ADMIN_PROFILE } from './demo';

export type { User };

// ── Demo login ────────────────────────────────────────────────────────────────
export function demoLogin(role: 'manager' | 'guard' | 'super_admin'): UserProfile {
  if (role === 'super_admin') return DEMO_SUPER_ADMIN_PROFILE;
  return role === 'manager' ? DEMO_MANAGER_PROFILE : DEMO_GUARD_PROFILE;
}

// ── Auth state ────────────────────────────────────────────────────────────────
export function onAuthChange(cb: (user: User | null) => void): () => void {
  if (!auth || !isFirebaseReady) { cb(null); return () => {}; }
  return onAuthStateChanged(auth, cb);
}

// ── Login ─────────────────────────────────────────────────────────────────────
export async function signIn(email: string, password: string): Promise<User> {
  if (!auth) throw new Error('Firebase پیکربندی نشده است.');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ── Logout ────────────────────────────────────────────────────────────────────
export async function signOut(): Promise<void> {
  if (!auth) return;
  await firebaseSignOut(auth);
}

// ── User profile ──────────────────────────────────────────────────────────────
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as UserProfile;
}

// ── Register manager + create company ────────────────────────────────────────
export async function registerManager(
  email: string,
  password: string,
  displayName: string,
  companyName: string,
): Promise<UserProfile> {
  if (!auth || !db) throw new Error('Firebase پیکربندی نشده است.');

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  await updateProfile(cred.user, { displayName });

  const inviteCode = generateInviteCode();

  const companyData: Omit<CompanyRecord, 'id'> = {
    name: companyName,
    adminUid: uid,
    adminEmail: email,
    plan: 'basic',
    active: true,
    suspended: false,
    inviteCode,
    guardCount: 0,
    checkpointCount: 0,
    createdAt: Date.now(),
    trialEndsAt: Date.now() + 30 * 24 * 3600 * 1000, // 30 day trial
  };

  const companyRef = await addDoc(collection(db, 'companies'), companyData);

  const profile: Omit<UserProfile, 'uid'> = {
    email,
    displayName,
    role: 'manager',
    companyId: companyRef.id,
    companyName,
    active: true,
    createdAt: Date.now(),
  };

  await setDoc(doc(db, 'users', uid), profile);
  return { uid, ...profile };
}

// ── Register guard ────────────────────────────────────────────────────────────
export async function registerGuard(
  email: string,
  password: string,
  displayName: string,
  companyId: string,
  companyName: string,
  guardCode: string,
): Promise<UserProfile> {
  if (!auth || !db) throw new Error('Firebase پیکربندی نشده است.');

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  await updateProfile(cred.user, { displayName });

  const profile: Omit<UserProfile, 'uid'> = {
    email,
    displayName,
    role: 'guard',
    companyId,
    companyName,
    guardCode,
    active: true,
    createdAt: Date.now(),
  };

  await setDoc(doc(db, 'users', uid), profile);
  return { uid, ...profile };
}

// ── Register super admin ──────────────────────────────────────────────────────
export async function registerSuperAdmin(
  email: string,
  password: string,
  displayName: string,
): Promise<UserProfile> {
  if (!auth || !db) throw new Error('Firebase پیکربندی نشده است.');

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  await updateProfile(cred.user, { displayName });

  const profile: Omit<UserProfile, 'uid'> = {
    email,
    displayName,
    role: 'super_admin',
    companyId: 'platform',
    companyName: 'ARC Guard Platform',
    active: true,
    createdAt: Date.now(),
  };

  await setDoc(doc(db, 'users', uid), profile);
  return { uid, ...profile };
}
