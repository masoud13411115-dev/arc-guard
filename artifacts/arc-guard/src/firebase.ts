import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from './firebaseConfig';

export const isFirebaseReady = Object.values(firebaseConfig).every(Boolean);

let db: ReturnType<typeof getFirestore> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;

if (isFirebaseReady) {
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    enableIndexedDbPersistence(db).catch(() => {});
  } catch (e) {
    console.warn('Firebase init error — running in demo mode:', e);
    db = null;
    auth = null;
  }
}

export { db, auth };
