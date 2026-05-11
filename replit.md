# ARCtime

سیستم حضور و غیاب آنلاین برای کارکنان ایرانی با QR Code و تأیید GPS

## Run & Operate

- `pnpm --filter @workspace/arctime run dev` — run the frontend (port 19585)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, RTL Persian (Vazirmatn font)
- Database: Firebase Firestore (client-side direct access)
- QR Scanning: html5-qrcode
- GPS: browser navigator.geolocation API

## Where things live

- `artifacts/arctime/src/App.tsx` — main single-page app with all 4 screens
- `artifacts/arctime/src/firebase.ts` — Firebase initialization with null guard
- `artifacts/arctime/src/index.css` — dark navy RTL theme with Vazirmatn font
- `lib/api-spec/openapi.yaml` — API spec (only healthz endpoint, Firestore used directly)

## Architecture decisions

- Pure client-side Firebase — no backend proxy needed; Firestore rules handle security
- Single-page app with useState screen management (no routing) — mirrors original MVP design
- Firebase null guard: if env vars missing, db = null and Persian error shown
- html5-qrcode renders into a plain div by id, must be white background for camera preview
- RTL layout: html/body have dir="rtl", Vazirmatn Google Font loaded as first @import in CSS

## Product

- **Home screen**: Logo + two buttons (Employee / Manager)
- **Employee screen**: Code input + جستجو lookup → profile card (name/branch) → QR + GPS status → check-in/out
- **QR Scanner screen**: Camera-based QR scan using html5-qrcode
- **Manager screen (گزارش tab)**: Stats cards, filters (name/code/type/branch/today), records list, Excel export
- **Manager screen (کارمندان tab)**: Add/delete employees (fullName, employeeCode, branchName, branchId) saved to Firestore "employees" collection

## Firestore collections

- `attendance`: companyId, employeeName, employeeCode, type, qrText, branchName, branchId, gps, distanceMeters, createdAt, createdAtText
- `employees`: fullName, employeeCode, branchName, branchId, createdAt

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Vazirmatn `@import url(...)` MUST be first line of index.css before all other imports
- Firebase secrets must use VITE_ prefix to be accessible in Vite frontend
- html5-qrcode scanner div needs `id="qr-reader"` exactly
- Required secrets: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID

## ARC Guard — Key Architecture Notes

- **Secrets injection**: Vite in dev mode does NOT expose `process.env.VITE_*` to `import.meta.env` automatically from Replit Secrets. Fix: define a custom global `__ARC_GUARD_CONFIG__` in `vite.config.ts` → `define` block, then read it in `firebaseConfig.ts`. Never use `import.meta.env.VITE_ARC_GUARD_*` directly.
- **measurementId is optional**: `isFirebaseReady` in `firebase.ts` must NOT include `measurementId` in its check — it will always be empty string if `VITE_ARC_GUARD_MEASUREMENT_ID` secret is not set, causing `every(Boolean)` to return false and triggering demo mode.
- **Firestore composite index**: `where('active', '==', true) + orderBy('createdAt')` requires a composite index. Fresh Firebase projects won't have it. Fix: use only `orderBy('createdAt')` and filter `active` client-side. This is implemented in `subscribeCheckpoints` and `getCheckpoints`.
- **onSnapshot silent errors**: Always pass an error callback (3rd arg) to `onSnapshot` calls. Without it, Firestore errors (missing index, security rules, etc.) are silently dropped and the list stays empty with no user feedback.
- **Checkpoint paths**: `companies/{companyId}/checkpoints` — both save and load use `checkpointPath(companyId)` helper from `firestore.ts` as single source of truth.
- **Optimistic updates**: After `saveCheckpoint`, add the new item to local React state immediately. Don't wait for the subscription snapshot — it can take 1–2 seconds and shows 0 list items in the meantime.
- **localStorage backup**: CheckpointManager keeps a live mirror in `arc_guard_v1:live_{companyId}_checkpoints`. On Firestore error, falls back to this cache so data isn't lost.
- ARC Guard secrets: `VITE_ARC_GUARD_API_KEY`, `VITE_ARC_GUARD_AUTH_DOMAIN`, `VITE_ARC_GUARD_PROJECT_ID`, `VITE_ARC_GUARD_STORAGE_BUCKET`, `VITE_ARC_GUARD_MESSAGING_SENDER_ID`, `VITE_ARC_GUARD_APP_ID` (+ optional `VITE_ARC_GUARD_MEASUREMENT_ID`)

## ARC Guard — QR Code Format

- **v2 (current)**: `ARCG|{companyId}|{checkpointId}` — embeds both IDs so guard scanner validates company ownership.
- **v1 (legacy)**: `ARC_GUARD_CP_{NAME}_{TIMESTAMP}` — guard falls back to matching by qrCode string.
- QR is **auto-generated in the storage layer** (not the UI): `saveCheckpoint` in firestore.ts pre-generates doc ID via `doc(col(...))`, builds QR, uses `setDoc`. `addCheckpoint` in demo-store.ts does the same.
- On checkpoint create: `qrCode = ARCG|${companyId}|${checkpointId}` — never edited on update.
- `isValidQrFormat` in `scanProtection.ts` accepts both v1 and v2. `parseQrCode` returns `{companyId, checkpointId}` for v2, null for v1.

## ARC Guard — Username-Based Authentication (No Email in UI)

- **No email is shown anywhere in the UI.** Firebase Auth is used internally with synthetic emails — never exposed to users.
- **Managers / Super Admins**: username + password. Synthetic email internally: `{username}@arcguard.local`.
- **Guards**: guardCode + inviteCode + PIN. Synthetic email internally: `{guardCode}.{companyId}@arcg.internal`.
- `usernameToEmail(username)` in `auth.ts` — maps username → `@arcguard.local` for Firebase Auth.
- `signInWithUsername(username, password)` in `auth.ts` — replaces old `signIn(email, password)`.
- `registerManager(username, password, displayName, companyName)` — stores `username` in Firestore, NOT email.
- `registerSuperAdmin(username, password, displayName)` — same pattern.
- `checkUsernameAvailable(username)` — queries Firestore `users` collection to enforce uniqueness.
- `UserProfile.username` field — shown in UI as `@username`. `email` field removed.
- `CompanyRecord.adminUsername` — replaces `adminEmail`. Shown as `@username` in SuperAdminPanel and CompanySettings.
- Guard registration: fullName + guardCode + inviteCode + PIN (min 6 chars). `registerGuardWithCode` in `auth.ts`. Guard's `username` = their `guardCode`.
- Guard login: guardCode + inviteCode (to resolve companyId) + PIN. `signInWithGuardCode` in `auth.ts`.
- LoginPage has two tabs: Manager+Admin / Guard.
- Username rules: lowercase letters, numbers, dot, dash only (`/[^a-z0-9._-]/g` stripped).

## ARC Guard — Guard Scanner Logic

- Scanner parses QR → calls `parseQrCode(text)`.
- v2 QR: extracts `qrCompanyId` and `qrCheckpointId`. Cross-checks `qrCompanyId === guard.companyId` (security). Looks up checkpoint by `cp.id === qrCheckpointId`.
- v1 QR: falls back to `checkpoints.find(cp => cp.qrCode === qrText)`.
- If not found: shows exact reason (companyId mismatch, or checkpoint not in loaded list of N items).
- DEV debug panel: after each scan shows qrCompanyId, qrCheckpointId, guardCompanyId, lookup path, error reason. Hidden in production (`import.meta.env.DEV`).

## ARC Guard — Guard UX (Simple One-Tap Flow)

- **One big button**: Guard sees a single large "اسکن ایستگاه" circle button (144px) on their screen.
- **Auto GPS**: `navigator.geolocation.watchPosition` runs continuously in background — GPS is always fresh when scan happens. Guard never manually refreshes GPS.
- **Scan → auto-process**: Camera opens as full-screen overlay → QR scanned → camera closes → GPS distance computed → log saved → result shown automatically.
- **Full-screen result overlay**: Green (valid) / Orange (outside) / Red (failed) with auto-dismiss after 4.5s. Guard can tap to dismiss early.
- **Next checkpoint card**: Shows the most overdue checkpoint or the soonest due one. Color-coded orange if overdue.
- **SOS**: Hold-to-activate button (3 seconds) with animated progress fill. Saves alert to Firestore instantly.
- **Recent scans**: Last 5 scans shown as color-coded list (green/orange/red) with checkpoint name, distance, and time.
- **Offline queue**: Yellow chip shows count of unsynced logs. Auto-syncs when back online.
- **Guard inputs nothing**: Checkpoint name, GPS, radius, interval — all defined by manager. Guard only taps scan.
- Guard page: `artifacts/arc-guard/src/pages/GuardPatrol.tsx` (~350 lines, no tabs, no complex state machines).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
