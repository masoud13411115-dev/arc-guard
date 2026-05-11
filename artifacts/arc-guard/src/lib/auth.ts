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
import type { UserProfile, CompanyRecord } from '@/types';
import { generateInviteCode } from '@/lib/plans';

export type { User };

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Maps a username to a synthetic Firebase Auth email. Never shown in UI.
 * Throws `invalid-username` if the username contains no valid characters.
 */
function usernameToEmail(username: string): string {
  const safe = username.toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (!safe) {
    throw Object.assign(
      new Error('نام کاربری فقط می‌تواند حروف انگلیسی، اعداد، نقطه و خط تیره داشته باشد.'),
      { code: 'invalid-username' },
    );
  }
  return `${safe}@arcguard.local`;
}

/** Derives a stable synthetic email for a guard. Never shown to the guard. */
function guardSyntheticEmail(guardCode: string, companyId: string): string {
  const code = guardCode.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cid = companyId.slice(0, 16).toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${code}.${cid}@arcg.internal`;
}

// ── Auth state ────────────────────────────────────────────────────────────────
export function onAuthChange(cb: (user: User | null) => void): () => void {
  if (!auth || !isFirebaseReady) { cb(null); return () => {}; }
  return onAuthStateChanged(auth, cb);
}

// ── Username availability check ───────────────────────────────────────────────
/** Returns true if the username is available (not taken). */
export async function checkUsernameAvailable(username: string): Promise<boolean> {
  if (!db) throw new Error('Firebase پیکربندی نشده است.');
  const snap = await getDocs(
    query(collection(db, 'users'), where('username', '==', username.toLowerCase().trim())),
  );
  return snap.empty;
}

// ── Manager / Super Admin login (username + password) ─────────────────────────
export async function signInWithUsername(username: string, password: string): Promise<User> {
  if (!auth) throw new Error('Firebase پیکربندی نشده است.');
  const email = usernameToEmail(username.trim()); // may throw invalid-username
  console.log('[auth] signInWithUsername →', { username: username.trim(), emailDomain: '@arcguard.local' });
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    console.log('[auth] signInWithUsername ✓ uid:', cred.user.uid);
    return cred.user;
  } catch (err: unknown) {
    const code    = (err as { code?: string })?.code    ?? 'unknown';
    const message = (err as Error).message ?? '';
    console.error('[auth] signInWithUsername ✗', { code, message, online: navigator.onLine });
    throw err;
  }
}

// ── Guard login (guardCode + companyId + PIN) ─────────────────────────────────
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
  username: string,
  password: string,
  displayName: string,
  companyName: string,
): Promise<UserProfile> {
  if (!auth || !db) throw new Error('Firebase پیکربندی نشده است.');

  const normalizedUsername = username.toLowerCase().trim();

  // Check username uniqueness
  const available = await checkUsernameAvailable(normalizedUsername);
  if (!available) throw Object.assign(new Error('این نام کاربری قبلاً استفاده شده است.'), { code: 'username-taken' });

  const syntheticEmail = usernameToEmail(normalizedUsername);
  const cred = await createUserWithEmailAndPassword(auth, syntheticEmail, password);
  const uid = cred.user.uid;
  await updateProfile(cred.user, { displayName });

  const inviteCode = generateInviteCode();

  const companyData: Omit<CompanyRecord, 'id'> = {
    name: companyName,
    adminUid: uid,
    adminUsername: normalizedUsername,
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
    username: normalizedUsername,
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

  const normalizedCode = guardCode.trim().toUpperCase();
  const syntheticEmail = guardSyntheticEmail(normalizedCode, companyId);

  const cred = await createUserWithEmailAndPassword(auth, syntheticEmail, pin);
  const uid = cred.user.uid;
  await updateProfile(cred.user, { displayName });

  // Guards use their guardCode as username
  const profile: Omit<UserProfile, 'uid'> = {
    username: normalizedCode,
    displayName,
    role: 'guard',
    companyId,
    companyName,
    guardCode: normalizedCode,
    active: true,
    createdAt: Date.now(),
  };

  await setDoc(doc(db, 'users', uid), profile);
  return { uid, ...profile };
}

// ── Register super admin ──────────────────────────────────────────────────────
export async function registerSuperAdmin(
  username: string,
  password: string,
  displayName: string,
): Promise<UserProfile> {
  if (!auth || !db) throw new Error('Firebase پیکربندی نشده است.');

  const normalizedUsername = username.toLowerCase().trim();

  // Check username uniqueness
  const available = await checkUsernameAvailable(normalizedUsername);
  if (!available) throw Object.assign(new Error('این نام کاربری قبلاً استفاده شده است.'), { code: 'username-taken' });

  const syntheticEmail = usernameToEmail(normalizedUsername);
  const cred = await createUserWithEmailAndPassword(auth, syntheticEmail, password);
  const uid = cred.user.uid;
  await updateProfile(cred.user, { displayName });

  const profile: Omit<UserProfile, 'uid'> = {
    username: normalizedUsername,
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
