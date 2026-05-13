/**
 * ARC Guard Manager — Capacitor configuration
 *
 * Used when building the Manager APK (default config).
 * For the Guard APK, use capacitor.guard.config.ts instead:
 *   cp capacitor.guard.config.ts capacitor.config.ts && npx cap sync
 *
 * appId follows reverse-domain convention: com.arcguard.manager
 * webDir points at the Vite build output.
 */

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'com.arcguard.manager',
  appName: 'ARC Guard Manager',
  webDir:  'dist/public',

  // ── Server (dev only — remove for production builds) ───────────────────────
  // Uncomment to load from dev server during development:
  // server: {
  //   url: 'https://YOUR_REPLIT_DOMAIN/arc-guard/',
  //   cleartext: true,
  // },

  // ── Plugins ────────────────────────────────────────────────────────────────
  plugins: {
    PushNotifications: {
      // Show system popup for permission on first launch
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon:   'ic_stat_icon_config_sample',
      iconColor:   '#0ea5e9',
      sound:       'beep.wav',
    },
    Geolocation: {
      // Required for background GPS on Android — also declared in AndroidManifest
    },
    SplashScreen: {
      launchShowDuration:    2000,
      backgroundColor:       '#0c1829',
      showSpinner:           false,
      androidSpinnerStyle:   'small',
      splashFullScreen:      true,
      splashImmersive:       true,
    },
  },

  // ── Android specific ───────────────────────────────────────────────────────
  android: {
    buildOptions: {
      releaseType: 'APK',
    },
    // Minimum SDK 24 (Android 7.0) — required for modern WebView + service workers
    minWebViewVersion: 60,
  },
};

export default config;
