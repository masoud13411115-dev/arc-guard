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
import type { UserProfile, Company } from '@/types';
import { DEMO_MANAGER_PROFILE, DEMO_GUARD_PROFILE } from './demo';

export type { User };

// ── Demo login (no Firebase needed) ──────────────────────────────────────────
export function demoLogin(role: 'manager' | 'guard'): UserProfile {
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

  const companyRef = await addDoc(collection(db, 'companies'), {
    name: companyName,
    adminUid: uid,
    adminEmail: email,
    createdAt: Date.now(),
  } satisfies Omit<Company, 'id'>);

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
