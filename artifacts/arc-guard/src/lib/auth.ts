import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, collection, addDoc, query, where, getDocs,
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

// ── Manager login (email + password) ─────────────────────────────────────────
export async function signIn(email: string, password: string): Promise<User> {
  if (!auth) throw new Error('Firebase پیکربندی نشده است.');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ── Guard login (guardCode + companyId + PIN) ─────────────────────────────────
// Guards do not know their email — we derive a synthetic email internally.

/** Derives a stable synthetic email for a guard. Never shown to the guard. */
function guardSyntheticEmail(guardCode: string, companyId: string): string {
  const code = guardCode.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cid = companyId.slice(0, 16).toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${code}.${cid}@arcg.internal`;
}

/**
 * Look up a company document by its inviteCode.
 * Returns { id, name } or throws if not found.
 */
export async function resolveCompanyByInviteCode(
  inviteCode: string,
): Promise<{ id: string; name: string }> {
  if (!db) throw new Error('Firebase پیکربندی نشده است.');
  const snap = await getDocs(
    query(collection(db, 'companies'), where('inviteCode', '==', inviteCode.trim().toUpperCase())),
  );
  if (snap.empty) throw new Error('کد دعوت نامعتبر است. این کد را از مدیر شرکت بگیرید.');
  const d = snap.docs[0];
  return { id: d.id, name: (d.data() as CompanyRecord).name };
}

/**
 * Guard login using guardCode + inviteCode (to find companyId) + PIN.
 * The guard never needs to know their synthetic email.
 */
export async function signInWithGuardCode(
  guardCode: string,
  companyId: string,
  pin: string,
): Promise<User> {
  if (!auth) throw new Error('Firebase پیکربندی نشده است.');
  const email = guardSyntheticEmail(guardCode, companyId);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pin);
    return cred.user;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code ?? '';
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      throw Object.assign(new Error('کد نگهبان یا PIN اشتباه است.'), { code });
    }
    throw err;
  }
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
    trialEndsAt: Date.now() + 30 * 24 * 3600 * 1000,
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

/**
 * Register a guard using guardCode + inviteCode + PIN (no real email needed).
 * A synthetic email is derived internally for Firebase Auth.
 */
export async function registerGuardWithCode(
  displayName: string,
  guardCode: string,
  companyId: string,
  companyName: string,
  pin: string,
): Promise<UserProfile> {
  if (!auth || !db) throw new Error('Firebase پیکربندی نشده است.');

  const email = guardSyntheticEmail(guardCode, companyId);

  const cred = await createUserWithEmailAndPassword(auth, email, pin);
  const uid = cred.user.uid;
  await updateProfile(cred.user, { displayName });

  const profile: Omit<UserProfile, 'uid'> = {
    email,
    displayName,
    role: 'guard',
    companyId,
    companyName,
    guardCode: guardCode.trim().toUpperCase(),
    active: true,
    createdAt: Date.now(),
  };

  await setDoc(doc(db, 'users', uid), profile);
  return { uid, ...profile };
}

/** @deprecated Use registerGuardWithCode instead */
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
