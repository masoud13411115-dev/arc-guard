# ARC Guard — Android APK Build Guide

ARC Guard uses **Capacitor** to wrap the existing web app into a native Android APK.
The web app, PWA, and APK all run the same React codebase. No native code changes are needed.

---

## What you get

| App | Package ID | Description |
|-----|-----------|-------------|
| **ARC Guard Manager** | `com.arcguard.manager` | Manager dashboard — alerts, checkpoints, patrols, backup |
| **ARC Guard Guard** | `com.arcguard.guard` | Guard patrol — QR scan, GPS, SOS |

Both APKs are built from the same source. Capacitor routes FCM push natively on Android.

---

## Prerequisites

Install these on your local machine (not Replit — Android builds require a desktop environment):

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| pnpm | 10+ | `npm i -g pnpm` |
| JDK | 17 | https://adoptium.net |
| Android Studio | Latest | https://developer.android.com/studio |
| Android SDK | API 34 | via Android Studio SDK Manager |
| `ANDROID_HOME` env var | — | Set to your SDK path |

### Verify prerequisites
```bash
node --version       # v20+
java --version       # 17+
echo $ANDROID_HOME   # /Users/you/Library/Android/sdk (macOS)
                     # C:\Users\you\AppData\Local\Android\Sdk (Windows)
```

---

## Firebase setup (required for push notifications)

1. Open [Firebase Console](https://console.firebase.google.com) → your ARC Guard project
2. Go to **Project Settings → General → Your apps → Add app → Android**
3. Register two Android apps:
   - Package name: `com.arcguard.manager`
   - Package name: `com.arcguard.guard`
4. Download `google-services.json` for each
5. Place each file at `android/app/google-services.json` before building that variant

> The same Firebase project can serve both apps. Just register both package IDs.

---

## Step 1 — Clone & install

```bash
git clone <your-repo-url>
cd <repo-root>
pnpm install
```

---

## Step 2 — Build the web assets

```bash
# From the repo root
pnpm --filter @workspace/arc-guard run build
```

This outputs the built web app to `artifacts/arc-guard/dist/public/`.

> **Important:** `BASE_PATH` and `PORT` are not needed for the APK build.
> Run the build with them empty or set to defaults:
> ```bash
> PORT=3000 BASE_PATH=/ pnpm --filter @workspace/arc-guard run build
> ```

---

## Step 3 — Initialize Capacitor (first time only)

```bash
cd artifacts/arc-guard
npx cap init "ARC Guard Manager" com.arcguard.manager --web-dir dist/public
```

---

## Step 4 — Add Android platform (first time only)

```bash
cd artifacts/arc-guard
npx cap add android
```

This creates the `android/` directory with a full Gradle project.

---

## Step 5 — Apply Android permissions

Open `android/app/src/main/AndroidManifest.xml` and add these permissions
inside `<manifest>` before `<application>`:

```xml
<!-- Network -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- Push Notifications (Android 13+) -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.WAKE_LOCK" />

<!-- GPS -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

<!-- Camera (QR scanning) -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="true" />

<!-- Vibration -->
<uses-permission android:name="android.permission.VIBRATE" />
```

See `android-config/AndroidManifest-permissions.xml` for the full annotated reference.

---

## Step 6 — Add google-services.json

```bash
cp /path/to/google-services-manager.json android/app/google-services.json
```

---

## Step 7 — Sync web assets to Android

```bash
cd artifacts/arc-guard
npx cap sync android
```

This copies the built web assets + Capacitor plugins into the Android project.

---

## Step 8 — Build the Manager APK

### Option A — Android Studio (recommended)
```bash
npx cap open android
```
Then in Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**

### Option B — Command line (Gradle)
```bash
cd android
./gradlew assembleDebug
# APK output: android/app/build/outputs/apk/debug/app-debug.apk
```

### Release APK (signed)
```bash
cd android
./gradlew assembleRelease
# Then sign with apksigner or jarsigner
```

---

## Building the Guard APK

The Guard APK uses a different `appId` and `appName`. Switch configs before syncing:

```bash
cd artifacts/arc-guard

# 1. Activate Guard config
cp capacitor.guard.config.ts capacitor.config.ts

# 2. Switch google-services.json for Guard package ID
cp /path/to/google-services-guard.json android/app/google-services.json

# 3. Sync + open Android Studio
npx cap sync android
npx cap open android

# 4. In Android Studio: Build APK
# 5. Restore Manager config when done
git checkout capacitor.config.ts
```

Or use the npm script shorthand:
```bash
pnpm --filter @workspace/arc-guard run cap:build:guard
```

---

## Capacitor build scripts (from repo root)

```bash
# Build web + sync Manager
pnpm --filter @workspace/arc-guard run cap:build:manager

# Build web + sync Guard
pnpm --filter @workspace/arc-guard run cap:build:guard

# Just sync (web already built)
pnpm --filter @workspace/arc-guard run cap:sync

# Open Android Studio
pnpm --filter @workspace/arc-guard run cap:open
```

---

## After making web code changes

```bash
# Rebuild + sync
pnpm --filter @workspace/arc-guard run cap:build:manager

# Then rebuild in Android Studio (or via Gradle)
```

---

## FCM Push Notifications on Android

Native push is handled by `@capacitor/push-notifications` — no web service worker needed.

The flow in `src/lib/nativePush.ts`:
1. `PushNotifications.requestPermissions()` — shows system permission dialog
2. `PushNotifications.register()` — registers with FCM
3. FCM token saved to Firestore: `companies/{companyId}/fcmTokens/{uid}`
4. Foreground pushes shown via `@capacitor/local-notifications`
5. Background pushes handled by the Android system FCM bridge

> In-app realtime SOS alerts (Firestore `subscribeAlerts`) work independently and
> require no FCM configuration — they work offline too via cached data.

---

## RTL / Persian support on Android

Persian RTL layout, Vazirmatn font, and all 4 languages (FA/EN/TR/ZH) work out of
the box in the Android WebView. No Android-side changes are needed.

Add to `android/app/src/main/res/values/strings.xml`:
```xml
<string name="app_name">ARC Guard</string>
```

---

## Minimum Android version

| Setting | Value |
|---------|-------|
| `minSdkVersion` | 24 (Android 7.0) |
| `targetSdkVersion` | 34 (Android 14) |
| `compileSdkVersion` | 34 |
| WebView | Chromium 60+ (auto-updated via Play Store) |

---

## Troubleshooting

### "Camera permission denied on first scan"
The app requests camera permission automatically when the QR scanner opens.
If denied, the user must go to Android Settings → Apps → ARC Guard → Permissions → Camera.

### "FCM token not saved"
- Ensure `google-services.json` is in `android/app/`
- Ensure Firebase project has the correct package ID registered
- Check `nativePush.ts` logs in Android Studio Logcat

### "GPS not working after closing app"
Background GPS requires `ACCESS_BACKGROUND_LOCATION` (declared in AndroidManifest)
plus a Play Store declaration. For patrol use, foreground GPS is sufficient.

### "Build fails: SDK not found"
Set `ANDROID_HOME` environment variable and ensure Android SDK Build-Tools 34 is installed
via Android Studio SDK Manager.

### "Sync fails: capacitor.config.ts not found"
Run `npx cap init` first (Step 3) before `npx cap add android`.
