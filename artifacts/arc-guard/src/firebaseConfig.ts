// ═══════════════════════════════════════════════════════════════════
//  FIREBASE CONFIGURATION — ARC Guard (جداگانه از ARCtime)
// ═══════════════════════════════════════════════════════════════════
//
//  Secrets stored in Replit → Secrets tab (lock icon):
//
//    VITE_ARC_GUARD_API_KEY
//    VITE_ARC_GUARD_AUTH_DOMAIN
//    VITE_ARC_GUARD_PROJECT_ID
//    VITE_ARC_GUARD_STORAGE_BUCKET
//    VITE_ARC_GUARD_MESSAGING_SENDER_ID
//    VITE_ARC_GUARD_APP_ID
//    VITE_ARC_GUARD_MEASUREMENT_ID   (optional — Analytics)
//
//  Without these, the app falls back to demo/localStorage mode.
// ═══════════════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_ARC_GUARD_API_KEY             ?? "",
  authDomain:        import.meta.env.VITE_ARC_GUARD_AUTH_DOMAIN         ?? "",
  projectId:         import.meta.env.VITE_ARC_GUARD_PROJECT_ID          ?? "",
  storageBucket:     import.meta.env.VITE_ARC_GUARD_STORAGE_BUCKET      ?? "",
  messagingSenderId: import.meta.env.VITE_ARC_GUARD_MESSAGING_SENDER_ID ?? "",
  appId:             import.meta.env.VITE_ARC_GUARD_APP_ID              ?? "",
  measurementId:     import.meta.env.VITE_ARC_GUARD_MEASUREMENT_ID      ?? "",
};

export default firebaseConfig;
