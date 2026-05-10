// ═══════════════════════════════════════════════════════════════════
//  FIREBASE CONFIGURATION — ARC Guard (جداگانه از ARCtime)
// ═══════════════════════════════════════════════════════════════════
//
//  ⚠️  این فایل کاملاً جدا از پروژه ARCtime است.
//      از کلیدهای اختصاصی ARC_GUARD_* استفاده می‌کند تا
//      با پروژه حضور و غیاب تداخل نداشته باشد.
//
//  راه‌اندازی (۳ مرحله):
//
//  ۱. یک پروژه Firebase جدید بسازید (جدا از پروژه ARCtime):
//     → console.firebase.google.com → Add project
//
//  ۲. در آن پروژه:
//     → Authentication → Sign-in method → Email/Password → Enable
//     → Firestore Database → Create database → Start in test mode
//
//  ۳. در Replit → Secrets (آیکون قفل) این کلیدها را اضافه کنید:
//
//       VITE_ARC_GUARD_API_KEY
//       VITE_ARC_GUARD_AUTH_DOMAIN
//       VITE_ARC_GUARD_PROJECT_ID
//       VITE_ARC_GUARD_STORAGE_BUCKET
//       VITE_ARC_GUARD_MESSAGING_SENDER_ID
//       VITE_ARC_GUARD_APP_ID
//
//  مقادیر را از: Firebase Console → Project Settings → General
//  → Your apps → Web app → firebaseConfig کپی کنید.
//
//  تا زمان پیکربندی، برنامه در حالت نمونه (Demo) کار می‌کند.
// ═══════════════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_ARC_GUARD_API_KEY            ?? "",
  authDomain:        import.meta.env.VITE_ARC_GUARD_AUTH_DOMAIN        ?? "",
  projectId:         import.meta.env.VITE_ARC_GUARD_PROJECT_ID         ?? "",
  storageBucket:     import.meta.env.VITE_ARC_GUARD_STORAGE_BUCKET     ?? "",
  messagingSenderId: import.meta.env.VITE_ARC_GUARD_MESSAGING_SENDER_ID ?? "",
  appId:             import.meta.env.VITE_ARC_GUARD_APP_ID             ?? "",
};

export default firebaseConfig;
