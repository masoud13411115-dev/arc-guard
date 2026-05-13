# ARC Guard — GitHub Actions Build Guide

Automated Android APK builds via `.github/workflows/android-apk.yml`.

---

## What the workflow does

| Step | Action |
|------|--------|
| 1 | Check out the repository |
| 2 | Install Node.js 20, pnpm 10, JDK 17, Android SDK 34 |
| 3 | `pnpm install` — install all workspace dependencies |
| 4 | Vite build + `cap sync` for **Manager** flavor |
| 5 | Vite build + `cap sync` for **Guard** flavor |
| 6 | `./gradlew assembleManagerDebug` → `ARC-Guard-Manager-debug.apk` |
| 7 | `./gradlew assembleGuardDebug`   → `ARC-Guard-Guard-debug.apk` |
| 8 | Upload both APKs as GitHub Actions Artifacts (retained 30 days) |

---

## Prerequisites — one-time local setup

The `android/` directory must be committed to your repository before CI can run.
It is **not** auto-generated in CI — Capacitor generates it locally via `npx cap add android`.

```bash
# 1. Unzip the Android project scaffold into artifacts/arc-guard/
cd artifacts/arc-guard
unzip ../../ARC_Guard_Android_Project.zip -d .
mv arc-guard-android/android ./android
rm -rf arc-guard-android

# 2. Install Capacitor CLI locally (if not already installed)
pnpm install

# 3. Sync web assets into the android/ folder (needs a prior Vite build)
PORT=3000 BASE_PATH=/arc-guard/ pnpm build
npx cap sync android

# 4. Commit the android/ directory
cd ../..
git add artifacts/arc-guard/android
git commit -m "chore: add Capacitor Android project"
git push
```

After this one-time commit, every push to `main` triggers an automatic APK build.

---

## GitHub Secrets to add

Go to **Settings → Secrets and variables → Actions → New repository secret**
and add the following:

### Firebase config (required for a working app)

| Secret name | Where to find it |
|---|---|
| `VITE_ARC_GUARD_API_KEY` | Firebase Console → Project Settings → General → Web API Key |
| `VITE_ARC_GUARD_AUTH_DOMAIN` | Firebase Console → Project Settings → `authDomain` field |
| `VITE_ARC_GUARD_PROJECT_ID` | Firebase Console → Project Settings → Project ID |
| `VITE_ARC_GUARD_STORAGE_BUCKET` | Firebase Console → Project Settings → `storageBucket` field |
| `VITE_ARC_GUARD_MESSAGING_SENDER_ID` | Firebase Console → Project Settings → `messagingSenderId` field |
| `VITE_ARC_GUARD_APP_ID` | Firebase Console → Project Settings → `appId` field |
| `VITE_ARC_GUARD_MEASUREMENT_ID` | Firebase Console → Project Settings → `measurementId` (optional) |
| `VITE_ARC_GUARD_VAPID_KEY` | Firebase Console → Project Settings → Cloud Messaging → Web Push certificates |

### google-services.json (required for FCM push on Android)

1. Go to **Firebase Console → Project Settings → General → Your apps**
2. Add an Android app with package name `com.arcguard.manager` (and optionally `com.arcguard.guard`)
3. Download `google-services.json`
4. Copy its **entire content** and add it as a secret named `GOOGLE_SERVICES_JSON`

```
Secret name:  GOOGLE_SERVICES_JSON
Secret value: { "project_info": { ... }, "client": [ ... ] }   ← paste full JSON
```

If `GOOGLE_SERVICES_JSON` is not set, the workflow uses a placeholder and the
APK will compile but Firebase/FCM features will not work at runtime.

---

## Triggering a build

### Automatic (on every push)
Any push to `main` that changes a file under `artifacts/arc-guard/` or
the workflow file itself triggers a build automatically.

### Manual (workflow_dispatch)
1. Go to **Actions → Build Android APK → Run workflow**
2. Select the branch
3. Choose flavor: `both` (default), `manager`, or `guard`
4. Click **Run workflow**

---

## Downloading the APKs

1. Go to **Actions → Build Android APK → (click a completed run)**
2. Scroll to the **Artifacts** section at the bottom of the run page
3. Download:
   - `ARC-Guard-Manager-debug` → install on manager devices
   - `ARC-Guard-Guard-debug` → install on guard devices

APKs are retained for **30 days**. Re-run the workflow to generate fresh ones.

---

## Installing on a device (sideload)

```bash
# Enable "Install from unknown sources" in Android Settings → Security first, then:
adb install ARC-Guard-Manager-debug.apk
adb install ARC-Guard-Guard-debug.apk
```

Or copy the `.apk` file to the device and open it with the file manager.

---

## Caching

The workflow caches:
- **pnpm store** — keyed on `pnpm-lock.yaml` hash → fast `pnpm install`
- **Gradle wrapper + caches** — keyed on `*.gradle*` file hashes → fast Gradle builds

First run: ~15–20 min. Subsequent runs with warm cache: ~6–10 min.

---

## Signed (release) APKs

The workflow currently builds **debug** APKs (signed with the Android debug key).
For Play Store submission, change the Gradle task to `assembleManagerRelease` /
`assembleGuardRelease` and add signing secrets:

| Secret | Description |
|---|---|
| `KEYSTORE_BASE64` | `base64 -w 0 your-keystore.jks` |
| `KEYSTORE_PASSWORD` | Keystore password |
| `KEY_ALIAS` | Key alias |
| `KEY_PASSWORD` | Key password |

Then add a step before Gradle:
```yaml
- name: Decode keystore
  run: echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 -d > artifacts/arc-guard/android/app/release.jks
```

And pass signing config via Gradle properties or `signingConfig` in `build.gradle`.
