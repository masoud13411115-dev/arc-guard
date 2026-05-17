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
import {
  saveProfileCache, loadProfileCache,
  saveLastManagerProfile, loadLastManagerProfile, clearLastManagerProfile,
} from "@/lib/offlineAuth";
import type { UserProfile } from "@/types";

type Screen = "loading" | "login" | "setup" | "dashboard" | "super-admin";

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
      // Firebase not configured (IndexedDB-only or no secrets set).
      // Try to restore the last manager session from the uid-agnostic cache
      // so the manager doesn't have to log in again on every app start.
      const cached = loadLastManagerProfile();
      if (cached) {
        setProfile(cached);
        setScreen(screenForRole(cached.role));
        logger.info("manager-app", "Restored from last-session cache (no Firebase)");
      } else {
        setScreen("login");
      }
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
            // Keep both caches fresh on every successful Firestore read
            saveProfileCache(p);
            saveLastManagerProfile(p);
            setProfile(p);
            setScreen(screenForRole(p.role));
            logger.info("manager-app", `Auth restored: ${p.role}`);
          } else {
            // No Firestore profile — fall back to cache before sending to setup
            const cached = loadProfileCache(user.uid) ?? loadLastManagerProfile();
            if (cached) {
              setProfile(cached);
              setScreen(screenForRole(cached.role));
              logger.info("manager-app", "Restored profile from cache (Firestore empty)");
              return;
            }
            setScreen("setup");
          }
        } catch (err) {
          // Firestore failed (offline, quota, rules, etc.) — use cache.
          // Do NOT gate on navigator.onLine: Firestore can fail even when online.
          const cached = loadProfileCache(user.uid) ?? loadLastManagerProfile();
          if (cached) {
            setProfile(cached);
            setScreen(screenForRole(cached.role));
            logger.info("manager-app", "Auth restored from cache (Firestore error)");
            return;
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
    clearLastManagerProfile();
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
