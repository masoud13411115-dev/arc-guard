# ARC Guard — Production Deployment Guide

## 1. Firebase Project Setup

### Create the project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g. `arcguard-prod`)
3. Disable Google Analytics (optional)

### Enable Authentication
1. Build → Authentication → Get started
2. Sign-in method → **Email/Password** → Enable → Save

### Create Firestore database
1. Build → Firestore Database → Create database
2. Choose **Production mode** (NOT test mode)
3. Select a region close to your users (e.g. `europe-west1` for Middle East)

### Apply Firestore Security Rules
Go to Firestore → Rules and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Companies — only managers of that company can read/write
    match /companies/{companyId} {
      allow read: if request.auth != null &&
        (request.auth.uid == resource.data.adminUid ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId == companyId);
      allow write: if request.auth != null &&
        request.auth.uid == resource.data.adminUid;
    }

    // Users — each user can read their own profile; managers can read company users
    match /users/{uid} {
      allow read: if request.auth != null &&
        (request.auth.uid == uid ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'manager');
      allow write: if request.auth != null && request.auth.uid == uid;
      allow create: if request.auth != null;
    }

    // Checkpoints — managers of the company can write; guards can read
    match /companies/{companyId}/checkpoints/{doc} {
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId == companyId;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'manager' &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId == companyId;
    }

    // Patrol logs — guards can create; managers can read all
    match /companies/{companyId}/patrolLogs/{doc} {
      allow create: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId == companyId;
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId == companyId;
    }

    // Guard sessions — guards write their own; managers read all
    match /companies/{companyId}/guardSessions/{guardId} {
      allow write: if request.auth != null && request.auth.uid == guardId;
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId == companyId;
    }

    // Alerts — guards create; managers read/update (resolve)
    match /companies/{companyId}/alerts/{doc} {
      allow create: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId == companyId;
      allow read, update: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId == companyId &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'manager';
    }
  }
}
```

---

## 2. Get Firebase Config Keys

1. Firebase Console → Project Settings (⚙️) → General
2. Scroll to "Your apps" → Web app → **Add app** if none exists
3. Copy the config object values

---

## 3. Set Replit Secrets

In Replit, go to **Secrets** (🔒) and add these 6 keys:

| Secret Name | Value from Firebase |
|---|---|
| `VITE_ARC_GUARD_API_KEY` | `apiKey` |
| `VITE_ARC_GUARD_AUTH_DOMAIN` | `authDomain` |
| `VITE_ARC_GUARD_PROJECT_ID` | `projectId` |
| `VITE_ARC_GUARD_STORAGE_BUCKET` | `storageBucket` |
| `VITE_ARC_GUARD_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_ARC_GUARD_APP_ID` | `appId` |

### Optional production settings

| Secret Name | Value | Description |
|---|---|---|
| `VITE_SHOW_DEMO` | `false` | Hide demo login buttons in production |

---

## 4. Create First Super Admin

After deploying, use the Firebase Console directly:

1. Authentication → Add user → enter email/password
2. Firestore → `users` collection → Add document with ID = the user's UID:
```json
{
  "email": "admin@yourcompany.com",
  "displayName": "Super Admin",
  "role": "super_admin",
  "companyId": "platform",
  "companyName": "ARC Guard Platform",
  "active": true,
  "createdAt": 1700000000000
}
```
3. Login with that email/password → you'll land in the Super Admin panel

---

## 5. Deploy on Replit

1. Click **Deploy** in the top-right of Replit
2. Select **Reserved VM** (recommended for 24/7 availability) or **Autoscale**
3. Wait for deployment — your app will be at `https://YOUR_APP.replit.app/arc-guard/`
4. The PWA manifest is served at `/arc-guard/manifest.webmanifest`

### Custom domain (optional)
1. Replit Deployments → Custom domains → Add domain
2. Add a CNAME record pointing to your Replit app

---

## 6. Install as Mobile App (PWA)

### Android (Chrome)
1. Open `https://YOUR_APP.replit.app/arc-guard/` in Chrome
2. Chrome menu (⋮) → **Add to Home screen**  
   — OR — wait for the install banner to appear automatically
3. App opens in fullscreen standalone mode

### iOS (Safari)
1. Open the URL in Safari
2. Share button (□↑) → **Add to Home Screen**
3. Confirm name → Add

### Generate real Android APK (optional)
```bash
# Install Bubblewrap CLI (requires Node.js + Java 8+)
npm install -g @bubblewrap/cli

# Initialize from your live manifest
bubblewrap init --manifest https://YOUR_APP.replit.app/arc-guard/manifest.webmanifest

# Build the APK (requires Android SDK)
bubblewrap build
# Output: app-release-signed.apk
```

See `twa-config.json` in the project root for pre-configured values. Replace `YOUR_REPLIT_APP_DOMAIN` with your actual domain.

---

## 7. Production Checklist

- [ ] All 6 `VITE_ARC_GUARD_*` secrets added to Replit
- [ ] Firestore security rules applied (Production mode — NOT test mode)
- [ ] First super admin account created via Firebase Console
- [ ] `VITE_SHOW_DEMO=false` set (hides demo buttons from production login page)
- [ ] PWA installable — manifest accessible at `/arc-guard/manifest.webmanifest`
- [ ] HTTPS — Replit deployments are always HTTPS ✓
- [ ] Firestore indexes created (Firebase Console will prompt if needed)
- [ ] Test login, guard patrol, and alert flow end-to-end

---

## 8. Monitoring

### Check error logs (in browser console)
```javascript
// In browser dev tools on the deployed app:
window.__arcGuardLogs?.()
```

### Firebase usage
- Firebase Console → Usage and billing → check Firestore reads/writes
- Basic plan: 50K reads/day, 20K writes/day (free)

### Backup Firestore data
```bash
# Install Firebase CLI
npm install -g firebase-tools
firebase login
firebase firestore:export gs://YOUR_PROJECT.appspot.com/backups/$(date +%Y%m%d)
```

---

## 9. Environment Variables Summary

```env
# Required — Firebase credentials
VITE_ARC_GUARD_API_KEY=
VITE_ARC_GUARD_AUTH_DOMAIN=
VITE_ARC_GUARD_PROJECT_ID=
VITE_ARC_GUARD_STORAGE_BUCKET=
VITE_ARC_GUARD_MESSAGING_SENDER_ID=
VITE_ARC_GUARD_APP_ID=

# Optional — production UI
VITE_SHOW_DEMO=false        # hide demo login buttons
```
