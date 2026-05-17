import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import LoginPage from "@/pages/LoginPage";
import GuardPatrol from "@/pages/GuardPatrol";
import { onAuthChange, getUserProfile, signOut } from "@/lib/auth";
import { isFirebaseReady } from "@/firebase";
import {
  saveProfileCache, loadProfileCache,
  saveLastGuardProfile, loadLastGuardProfile, clearLastGuardProfile,
} from "@/lib/offlineAuth";
import { logger } from "@/lib/logger";
import { useI18n } from "@/lib/i18n";
import type { UserProfile } from "@/types";

type Screen = "loading" | "login" | "patrol";

export default function GuardApp() {
  const { t, dir } = useI18n();
  const [, navigate] = useLocation();
  const [screen, setScreen] = useState<Screen>("loading");
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!isFirebaseReady) {
      // Firebase not configured (IndexedDB-only or no secrets set).
      // Try to restore the last guard session from the uid-agnostic cache
      // so the guard doesn't have to re-enter their PIN on every app start.
      const cached = loadLastGuardProfile();
      if (cached) {
        setProfile(cached);
        setScreen("patrol");
        logger.info("guard-app", `Restored from last-session cache (no Firebase): ${cached.displayName}`);
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
            if (p.role === "manager" || p.role === "super_admin") {
              navigate("/manager");
              return;
            }
            // Keep both caches fresh on every successful Firestore read
            saveProfileCache(p);
            saveLastGuardProfile(p);
            setProfile(p);
            setScreen("patrol");
            logger.info("guard-app", `Auth restored: ${p.displayName}`);
          } else {
            setScreen("login");
          }
        } catch (err) {
          // Firestore failed (offline, quota, rules, etc.) — use cache.
          // Do NOT gate on navigator.onLine: Firestore can fail even when online.
          logger.error("guard-app", "Failed to restore auth (trying cache)", err);
          const cached = loadProfileCache(user.uid) ?? loadLastGuardProfile();
          if (cached) {
            logger.info("guard-app", `Cache restore: ${cached.displayName}`);
            if (cached.role === "manager" || cached.role === "super_admin") {
              navigate("/manager");
              return;
            }
            setProfile(cached);
            setScreen("patrol");
          } else {
            setScreen("login");
          }
        }
      } else {
        setProfile(null);
        setScreen("login");
      }
    });
    return unsub;
  }, [navigate]);

  const handleLogin = useCallback((p: UserProfile) => {
    if (p.role === "manager" || p.role === "super_admin") {
      navigate("/manager");
      return;
    }
    logger.info("guard-app", `Login: ${p.displayName}`);
    setProfile(p);
    setScreen("patrol");
  }, [navigate]);

  const handleLogout = useCallback(async () => {
    logger.info("guard-app", "Logout");
    if (isFirebaseReady) await signOut().catch(() => {});
    clearLastGuardProfile();
    setProfile(null);
    setScreen("login");
    navigate("/guard");
  }, [navigate]);

  if (screen === "loading") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background" dir={dir}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
          <p className="text-sm text-muted-foreground">{t("app.loading")}</p>
        </div>
      </div>
    );
  }

  if (screen === "patrol" && profile) {
    return (
      <GuardPatrol
        guardId={profile.uid}
        guardName={profile.displayName}
        guardCode={profile.guardCode}
        companyId={profile.companyId}
        companyName={profile.companyName}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <LoginPage
      lockedMode="guard"
      onLogin={handleLogin}
      onRegister={() => navigate("/manager")}
    />
  );
}
