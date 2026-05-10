import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import firebaseConfig from './firebaseConfig';
import { logger } from './lib/logger';

/** True only when all 6 required Firebase env vars are present.
 *  measurementId (Analytics) is optional — excluded from this check. */
export const isFirebaseReady = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.storageBucket &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.appId
);

let db: ReturnType<typeof initializeFirestore> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;

if (isFirebaseReady) {
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

    // Modern persistent cache (replaces deprecated enableIndexedDbPersistence)
    // Multi-tab support keeps multiple browser tabs in sync
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });

    auth = getAuth(app);

    logger.info('firebase', 'Initialized — persistent multi-tab cache enabled');
  } catch (e) {
    logger.error('firebase', 'Init failed — running in demo mode', e);
    db = null;
    auth = null;
  }
} else {
  logger.warn('firebase', 'Missing VITE_ARC_GUARD_* env vars — demo mode active');
}

export { db, auth };
