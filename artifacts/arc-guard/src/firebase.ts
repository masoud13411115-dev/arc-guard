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

// ── FCM — lazy async init with isSupported() guard ───────────────────────────
//
// getMessaging() MUST NOT be called synchronously at module load.
// On iOS Safari and Firefox, it throws messaging/unsupported-browser before
// the try/catch can even run.  Firebase's async isSupported() is the only
// reliable way to check first.  Call initFcmMessaging() from your component
// after mount.

type MessagingInstance = import('firebase/messaging').Messaging;

/**
 * Initialize Firebase Cloud Messaging if the browser supports it.
 *
 * Uses isSupported() — the only reliable check for FCM browser compatibility.
 * Returns the Messaging instance, or null when:
 *  - Firebase config is missing (demo mode)
 *  - Browser does not support FCM (iOS Safari, Firefox, etc.)
 *  - Any other error during init
 *
 * Safe to call multiple times — subsequent calls return the cached instance.
 */
let _messaging: MessagingInstance | null = null;
let _messagingChecked = false;

export async function initFcmMessaging(): Promise<MessagingInstance | null> {
  if (_messagingChecked) return _messaging;
  _messagingChecked = true;

  if (!isFirebaseReady) {
    logger.warn('firebase', 'FCM skipped — Firebase not configured');
    return null;
  }

  try {
    // Dynamic import so the messaging bundle is only loaded when needed
    const { isSupported, getMessaging } = await import('firebase/messaging');

    const supported = await isSupported();
    if (!supported) {
      logger.warn('firebase', 'FCM not supported in this browser (iOS Safari / Firefox / etc.)');
      return null;
    }

    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    _messaging = getMessaging(app);
    logger.info('firebase', 'FCM messaging initialized');
    return _messaging;
  } catch (err) {
    logger.warn('firebase', 'FCM init failed:', err);
    return null;
  }
}
