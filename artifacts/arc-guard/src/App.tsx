import { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import SplashScreen from "@/pages/SplashScreen";
import LoginPage from "@/pages/LoginPage";
import SetupPage from "@/pages/SetupPage";
import Dashboard from "@/pages/Dashboard";
import GuardPatrol from "@/pages/GuardPatrol";
import SuperAdminPanel from "@/pages/SuperAdminPanel";
import InstallPrompt, { UpdateBanner } from "@/components/InstallPrompt";
import { onAuthChange, getUserProfile, signOut } from "@/lib/auth";
import { isFirebaseReady } from "@/firebase";
import { initPWA, applyUpdate, isPWAInstalled } from "@/lib/pwa";
import { syncOfflineQueue } from "@/lib/firestore";
import { listenForSyncTrigger, getQueueCount } from "@/lib/offline";
import type { UserProfile } from "@/types";

const queryClient = new QueryClient();

type Screen = "splash" | "login" | "setup" | "manager-dashboard" | "guard-patrol" | "super-admin";

interface AppState {
  screen: Screen;
  profile: UserProfile | null;
}

function screenForRole(role: UserProfile["role"]): Screen {
  if (role === "super_admin") return "super-admin";
  if (role === "manager") return "manager-dashboard";
  return "guard-patrol";
}

function AppContent() {
  const [appState, setAppState] = useState<AppState>({ screen: "splash", profile: null });
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isStandalone] = useState(isPWAInstalled);

  // ── PWA init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    initPWA(() => setUpdateAvailable(true));

    // Offline queue listener — sync when back online or SW triggers
    const unsub = listenForSyncTrigger(async () => {
      if (isFirebaseReady) {
        const synced = await syncOfflineQueue();
        if (synced > 0) setOfflineCount(getQueueCount());
      }
    });

    setOfflineCount(getQueueCount());
    return unsub;
  }, []);

  // ── Firebase auth ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isFirebaseReady) return;
    const unsub = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        const p = await getUserProfile(firebaseUser.uid);
        if (p) {
          setAppState({ screen: screenForRole(p.role), profile: p });
        } else {
          setAppState({ screen: "setup", profile: null });
        }
      } else {
        setAppState(s => ({ ...s, profile: null }));
      }
    });
    return unsub;
  }, []);

  const handleSplashComplete = useCallback(() => {
    setAppState({ screen: "login", profile: null });
  }, []);

  const handleLogin = useCallback((p: UserProfile) => {
    setAppState({ screen: screenForRole(p.role), profile: p });
  }, []);

  const handleSetupComplete = useCallback((p: UserProfile) => {
    setAppState({ screen: screenForRole(p.role), profile: p });
  }, []);

  const handleLogout = useCallback(async () => {
    if (isFirebaseReady) await signOut().catch(() => {});
    setAppState({ screen: "login", profile: null });
  }, []);

  const { screen, profile } = appState;

  return (
    <>
      {/* Offline queue indicator */}
      {offlineCount > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-yellow-500/20 border-b border-yellow-500/30 px-4 py-1.5 flex items-center justify-center gap-2 text-xs text-yellow-400" dir="rtl">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          {offlineCount} اسکن در صف همگام‌سازی — در انتظار اتصال اینترنت
        </div>
      )}

      {/* Update banner */}
      {updateAvailable && (
        <UpdateBanner
          onUpdate={applyUpdate}
          onDismiss={() => setUpdateAvailable(false)}
        />
      )}

      {/* Install prompt — only show on non-standalone mode */}
      {!isStandalone && screen !== "splash" && screen !== "login" && screen !== "setup" && (
        <InstallPrompt />
      )}

      {/* Screens */}
      {screen === "splash" && <SplashScreen onComplete={handleSplashComplete} />}
      {screen === "login" && <LoginPage onLogin={handleLogin} onRegister={() => setAppState({ screen: "setup", profile: null })} />}
      {screen === "setup" && <SetupPage onComplete={handleSetupComplete} onBack={() => setAppState({ screen: "login", profile: null })} />}
      {screen === "super-admin" && profile && <SuperAdminPanel profile={profile} onLogout={handleLogout} />}
      {screen === "manager-dashboard" && profile && <Dashboard profile={profile} onLogout={handleLogout} />}
      {screen === "guard-patrol" && profile && (
        <GuardPatrol guardId={profile.uid} guardName={profile.displayName} companyId={profile.companyId} onLogout={handleLogout} />
      )}
      {/* Fallback */}
      {!["splash","login","setup","super-admin","manager-dashboard","guard-patrol"].includes(screen) && (
        <LoginPage onLogin={handleLogin} onRegister={() => setAppState({ screen: "setup", profile: null })} />
      )}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
