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
import DemoGuardPicker from "@/pages/DemoGuardPicker";
import InstallPrompt, { UpdateBanner } from "@/components/InstallPrompt";
import { onAuthChange, getUserProfile, signOut, demoLogin } from "@/lib/auth";
import { isFirebaseReady } from "@/firebase";
import { initPWA, applyUpdate, isPWAInstalled } from "@/lib/pwa";
import { syncOfflineQueue } from "@/lib/firestore";
import { listenForSyncTrigger, getQueueCount } from "@/lib/offline";
import { onNetworkChange, type NetworkState } from "@/lib/network";
import { logger } from "@/lib/logger";
import type { UserProfile } from "@/types";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
});

type Screen = "splash" | "login" | "setup" | "manager-dashboard" | "guard-patrol" | "super-admin" | "demo-guard-select";

interface AppState {
  screen: Screen;
  profile: UserProfile | null;
}

function screenForRole(role: UserProfile["role"]): Screen {
  if (role === "super_admin") return "super-admin";
  if (role === "manager") return "manager-dashboard";
  return "guard-patrol";
}

// ── Network status banner ─────────────────────────────────────────────────────
function NetworkBanner({ state }: { state: NetworkState }) {
  if (state === "online") return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[70] flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium"
      style={{ background: "rgba(239,68,68,0.15)", borderBottom: "1px solid rgba(239,68,68,0.3)" }}
      dir="rtl">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
      <span className="text-red-400">اتصال قطع است — اسکن‌ها در صف ذخیره می‌شوند</span>
    </div>
  );
}

function AppContent() {
  const [appState, setAppState] = useState<AppState>({ screen: "splash", profile: null });
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [networkState, setNetworkState] = useState<NetworkState>("online");
  const [isStandalone] = useState(isPWAInstalled);

  // ── PWA init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    initPWA(() => setUpdateAvailable(true));
    logger.info("app", "ARC Guard starting", { pwa: isPWAInstalled(), firebase: isFirebaseReady });

    // Offline queue sync listener
    const unsub = listenForSyncTrigger(async () => {
      if (isFirebaseReady) {
        const synced = await syncOfflineQueue();
        if (synced > 0) {
          setOfflineCount(getQueueCount());
          logger.info("app", `Synced ${synced} offline items`);
        }
      }
    });

    setOfflineCount(getQueueCount());
    return unsub;
  }, []);

  // ── Network monitoring ────────────────────────────────────────────────────
  useEffect(() => {
    return onNetworkChange((state) => {
      setNetworkState(state);
      // When back online, attempt queue sync
      if (state === "online" && isFirebaseReady && getQueueCount() > 0) {
        syncOfflineQueue()
          .then((synced) => {
            if (synced > 0) setOfflineCount(getQueueCount());
          })
          .catch(() => {});
      }
    });
  }, []);

  // ── Firebase auth ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isFirebaseReady) return;
    const unsub = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const p = await getUserProfile(firebaseUser.uid);
          if (p) {
            setAppState({ screen: screenForRole(p.role), profile: p });
            logger.info("app", `Auth restored: ${p.role}`);
          } else {
            setAppState({ screen: "setup", profile: null });
          }
        } catch (err) {
          logger.error("app", "Failed to restore auth session", err);
          setAppState((s) => ({ ...s, profile: null }));
        }
      } else {
        setAppState((s) => {
          if (s.screen === "manager-dashboard" || s.screen === "guard-patrol" || s.screen === "super-admin") {
            return { screen: "login", profile: null };
          }
          return { ...s, profile: null };
        });
      }
    });
    return unsub;
  }, []);

  const handleSplashComplete = useCallback(() => {
    setAppState({ screen: "login", profile: null });
  }, []);

  const handleLogin = useCallback((p: UserProfile) => {
    logger.info("app", `Login: ${p.role} @ ${p.companyId}`);
    // In demo mode, guards must pick their active guard first
    if (!isFirebaseReady && p.role === "guard") {
      setAppState({ screen: "demo-guard-select", profile: p });
      return;
    }
    setAppState({ screen: screenForRole(p.role), profile: p });
  }, []);

  const handleDemoGuardSelect = useCallback((guard: UserProfile) => {
    logger.info("app", `Demo guard selected: ${guard.displayName}`);
    setAppState({ screen: "guard-patrol", profile: guard });
  }, []);

  const handleSwitchGuard = useCallback(() => {
    setAppState((s) => ({ ...s, screen: "demo-guard-select" }));
  }, []);

  const handleGoToManager = useCallback(() => {
    const mp = demoLogin("manager");
    setAppState({ screen: "manager-dashboard", profile: mp });
  }, []);

  const handleSetupComplete = useCallback((p: UserProfile) => {
    setAppState({ screen: screenForRole(p.role), profile: p });
  }, []);

  const handleLogout = useCallback(async () => {
    logger.info("app", "Logout");
    if (isFirebaseReady) await signOut().catch(() => {});
    setAppState({ screen: "login", profile: null });
  }, []);

  const { screen, profile } = appState;
  const topOffset = networkState !== "online" || offlineCount > 0 ? "pt-8" : "";

  return (
    <>
      {/* Network status banner */}
      <NetworkBanner state={networkState} />

      {/* Offline queue indicator */}
      {offlineCount > 0 && networkState === "online" && (
        <div className="fixed top-0 left-0 right-0 z-[65] flex items-center justify-center gap-2 px-4 py-1.5 text-xs text-yellow-400"
          style={{ background: "rgba(234,179,8,0.12)", borderBottom: "1px solid rgba(234,179,8,0.25)" }}
          dir="rtl">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          {offlineCount} اسکن در حال همگام‌سازی...
        </div>
      )}

      {/* Update banner */}
      {updateAvailable && (
        <UpdateBanner
          onUpdate={applyUpdate}
          onDismiss={() => setUpdateAvailable(false)}
        />
      )}

      {/* Install prompt — only show on non-standalone mode, post-login */}
      {!isStandalone && !["splash", "login", "setup"].includes(screen) && (
        <InstallPrompt />
      )}

      {/* Screens */}
      <div className={topOffset}>
        {screen === "splash" && <SplashScreen onComplete={handleSplashComplete} />}
        {screen === "login" && (
          <LoginPage onLogin={handleLogin} onRegister={() => setAppState({ screen: "setup", profile: null })} />
        )}
        {screen === "setup" && (
          <SetupPage onComplete={handleSetupComplete} onBack={() => setAppState({ screen: "login", profile: null })} />
        )}
        {screen === "super-admin" && profile && (
          <SuperAdminPanel profile={profile} onLogout={handleLogout} />
        )}
        {screen === "manager-dashboard" && profile && (
          <Dashboard profile={profile} onLogout={handleLogout} />
        )}
        {screen === "demo-guard-select" && (
          <DemoGuardPicker
            onSelect={handleDemoGuardSelect}
            onBack={() => setAppState({ screen: "login", profile: null })}
            onGoToManager={handleGoToManager}
          />
        )}
        {screen === "guard-patrol" && profile && (
          <GuardPatrol
            guardId={profile.uid}
            guardName={profile.displayName}
            companyId={profile.companyId}
            onLogout={handleLogout}
            onSwitchGuard={!isFirebaseReady ? handleSwitchGuard : undefined}
          />
        )}
        {/* Fallback */}
        {!["splash","login","setup","super-admin","manager-dashboard","guard-patrol","demo-guard-select"].includes(screen) && (
          <LoginPage onLogin={handleLogin} onRegister={() => setAppState({ screen: "setup", profile: null })} />
        )}
      </div>
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
