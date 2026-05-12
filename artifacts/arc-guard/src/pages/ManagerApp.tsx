import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import LoginPage from "@/pages/LoginPage";
import SetupPage from "@/pages/SetupPage";
import Dashboard from "@/pages/Dashboard";
import SuperAdminPanel from "@/pages/SuperAdminPanel";
import { onAuthChange, getUserProfile, signOut } from "@/lib/auth";
import { isFirebaseReady } from "@/firebase";
import { logger } from "@/lib/logger";
import { useI18n } from "@/lib/i18n";
import type { UserProfile } from "@/types";

type Screen = "loading" | "login" | "setup" | "dashboard" | "super-admin";

// ── Profile localStorage cache for offline auth restoration ───────────────────
const profileCacheKey = (uid: string) => `arc_guard_mgr_profile_${uid}`;

function saveProfileToCache(p: UserProfile): void {
  try { localStorage.setItem(profileCacheKey(p.uid), JSON.stringify(p)); } catch { /* storage full */ }
}

function loadProfileFromCache(uid: string): UserProfile | null {
  try {
    const raw = localStorage.getItem(profileCacheKey(uid));
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch { return null; }
}

function screenForRole(role: UserProfile["role"]): Screen {
  if (role === "super_admin") return "super-admin";
  if (role === "manager") return "dashboard";
  return "login";
}

export default function ManagerApp() {
  const { dir } = useI18n();
  const [, navigate] = useLocation();
  const [screen, setScreen] = useState<Screen>("loading");
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!isFirebaseReady) {
      setScreen("login");
      return;
    }
    const unsub = onAuthChange(async (user) => {
      if (user) {
        try {
          const p = await getUserProfile(user.uid);
          if (p) {
            if (p.role === "guard") {
              navigate("/guard");
              return;
            }
            saveProfileToCache(p);
            setProfile(p);
            setScreen(screenForRole(p.role));
            logger.info("manager-app", `Auth restored: ${p.role}`);
          } else {
            // No profile in Firestore — check localStorage cache when offline
            if (!navigator.onLine) {
              const cached = loadProfileFromCache(user.uid);
              if (cached) {
                setProfile(cached);
                setScreen(screenForRole(cached.role));
                logger.info("manager-app", "Restored profile from localStorage cache (offline)");
                return;
              }
            }
            setScreen("setup");
          }
        } catch (err) {
          // Firestore failed — if offline, try to restore from localStorage cache
          if (!navigator.onLine) {
            const cached = loadProfileFromCache(user.uid);
            if (cached) {
              setProfile(cached);
              setScreen(screenForRole(cached.role));
              logger.info("manager-app", "Auth restored from cache (offline)");
              return;
            }
          }
          logger.error("manager-app", "Failed to restore auth", err);
          setScreen("login");
        }
      } else {
        setProfile(null);
        setScreen("login");
      }
    });
    return unsub;
  }, [navigate]);

  const handleLogin = useCallback((p: UserProfile) => {
    logger.info("manager-app", `Login: ${p.role}`);
    if (p.role === "guard") {
      navigate("/guard");
      return;
    }
    setProfile(p);
    setScreen(screenForRole(p.role));
  }, [navigate]);

  const handleSetupComplete = useCallback((p: UserProfile) => {
    if (p.role === "guard") {
      navigate("/guard");
      return;
    }
    setProfile(p);
    setScreen(screenForRole(p.role));
  }, [navigate]);

  const handleLogout = useCallback(async () => {
    logger.info("manager-app", "Logout");
    if (isFirebaseReady) await signOut().catch(() => {});
    setProfile(null);
    setScreen("login");
    navigate("/manager");
  }, [navigate]);

  if (screen === "loading") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background" dir={dir}>
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (screen === "dashboard" && profile) {
    return <Dashboard profile={profile} onLogout={handleLogout} />;
  }

  if (screen === "super-admin" && profile) {
    return <SuperAdminPanel profile={profile} onLogout={handleLogout} />;
  }

  if (screen === "setup") {
    return (
      <SetupPage
        onComplete={handleSetupComplete}
        onBack={() => setScreen("login")}
      />
    );
  }

  return (
    <LoginPage
      lockedMode="manager"
      onLogin={handleLogin}
      onRegister={() => setScreen("setup")}
    />
  );
}
