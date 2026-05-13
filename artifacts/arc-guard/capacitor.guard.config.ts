/**
 * ARC Guard Guard — Capacitor configuration (Guard APK variant)
 *
 * To build the Guard APK, copy this file over the default config:
 *   cp capacitor.guard.config.ts capacitor.config.ts
 *   npx cap sync android
 *   (build in Android Studio)
 *
 * appId: com.arcguard.guard  (different from Manager: com.arcguard.manager)
 * This creates a completely separate app on the device / Play Store listing.
 */

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'com.arcguard.guard',
  appName: 'ARC Guard',
  webDir:  'dist/public',

  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#22c55e',
      sound:     'beep.wav',
    },
    Geolocation: {},
    SplashScreen: {
      launchShowDuration:  2000,
      backgroundColor:     '#0c1829',
      showSpinner:         false,
      splashFullScreen:    true,
      splashImmersive:     true,
    },
  },

  android: {
    buildOptions: {
      releaseType: 'APK',
    },
    minWebViewVersion: 60,
  },
};

export default config;
