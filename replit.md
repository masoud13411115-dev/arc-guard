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

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
