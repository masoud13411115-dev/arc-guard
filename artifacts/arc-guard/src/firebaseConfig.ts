// ═══════════════════════════════════════════════════════════════════
//  FIREBASE CONFIGURATION — ARC Guard
// ═══════════════════════════════════════════════════════════════════
//
//  Config is injected at build time via __ARC_GUARD_CONFIG__ (defined
//  in vite.config.ts) so that Replit Secrets reach the browser bundle
//  reliably in both dev and production modes.
//
//  Secrets stored in Replit → Secrets tab:
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

declare const __ARC_GUARD_CONFIG__: {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
};

// In tests / SSR contexts the global may not be injected — fall back to empty strings
const injected: typeof __ARC_GUARD_CONFIG__ =
  typeof __ARC_GUARD_CONFIG__ !== "undefined"
    ? __ARC_GUARD_CONFIG__
    : { apiKey: "", authDomain: "", projectId: "", storageBucket: "", messagingSenderId: "", appId: "", measurementId: "" };

const firebaseConfig = injected;

export default firebaseConfig;
