import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
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
    auth = getAuth(app);

    // Attempt 1: persistent cache with multi-tab support (best for normal browsers)
    // Fails on Safari private mode (IndexedDB blocked) — caught below
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
      logger.info('firebase', 'Initialized — persistent multi-tab cache enabled');
    } catch (persistErr) {
      logger.warn('firebase', 'persistentMultipleTabManager failed (Safari private?), trying persistentLocalCache', persistErr);

      // Attempt 2: persistent cache without multi-tab (works in normal Safari)
      try {
        db = initializeFirestore(app, {
          localCache: persistentLocalCache(),
        });
        logger.info('firebase', 'Initialized — persistent single-tab cache');
      } catch (singleErr) {
        logger.warn('firebase', 'persistentLocalCache failed, falling back to memory cache', singleErr);

        // Attempt 3: memory-only cache (Safari private mode, no persistence)
        db = initializeFirestore(app, {
          localCache: memoryLocalCache(),
        });
        logger.info('firebase', 'Initialized — memory cache (private browsing mode)');
      }
    }
  } catch (e) {
    logger.error('firebase', 'Firebase init completely failed — running in demo mode', e);
    db = null;
    auth = null;
  }
} else {
  logger.warn('firebase', 'Missing VITE_ARC_GUARD_* env vars — demo mode active');
}

export { db, auth };
