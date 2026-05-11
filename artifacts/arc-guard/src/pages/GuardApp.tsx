import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import LoginPage from "@/pages/LoginPage";
import GuardPatrol from "@/pages/GuardPatrol";
import { onAuthChange, getUserProfile, signOut } from "@/lib/auth";
import { isFirebaseReady } from "@/firebase";
import { logger } from "@/lib/logger";
import type { UserProfile } from "@/types";

type Screen = "loading" | "login" | "patrol";

export default function GuardApp() {
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
            if (p.role === "manager" || p.role === "super_admin") {
              navigate("/manager");
              return;
            }
            setProfile(p);
            setScreen("patrol");
            logger.info("guard-app", `Auth restored: ${p.displayName}`);
          } else {
            setScreen("login");
          }
        } catch (err) {
          logger.error("guard-app", "Failed to restore auth", err);
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
    setProfile(null);
    setScreen("login");
    navigate("/guard");
  }, [navigate]);

  if (screen === "loading") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
          <p className="text-sm text-muted-foreground">در حال بارگذاری...</p>
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
