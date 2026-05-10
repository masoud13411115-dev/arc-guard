import { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import SplashScreen from "@/pages/SplashScreen";
import LoginPage from "@/pages/LoginPage";
import SetupPage from "@/pages/SetupPage";
import Dashboard from "@/pages/Dashboard";
import GuardPatrol from "@/pages/GuardPatrol";
import { onAuthChange, getUserProfile, signOut } from "@/lib/auth";
import { isFirebaseReady } from "@/firebase";
import type { UserProfile } from "@/types";

const queryClient = new QueryClient();

type Screen = "splash" | "login" | "setup" | "manager-dashboard" | "guard-patrol";

interface AppState {
  screen: Screen;
  profile: UserProfile | null;
}

function AppContent() {
  // Combined into one state object so screen + profile always update atomically
  const [appState, setAppState] = useState<AppState>({ screen: "splash", profile: null });

  useEffect(() => {
    if (!isFirebaseReady) return;
    const unsub = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        const p = await getUserProfile(firebaseUser.uid);
        if (p) {
          setAppState({ screen: p.role === "manager" ? "manager-dashboard" : "guard-patrol", profile: p });
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
    setAppState({
      screen: p.role === "manager" ? "manager-dashboard" : "guard-patrol",
      profile: p,
    });
  }, []);

  const handleSetupComplete = useCallback((p: UserProfile) => {
    setAppState({
      screen: p.role === "manager" ? "manager-dashboard" : "guard-patrol",
      profile: p,
    });
  }, []);

  const handleLogout = useCallback(async () => {
    if (isFirebaseReady) await signOut().catch(() => {});
    setAppState({ screen: "login", profile: null });
  }, []);

  const { screen, profile } = appState;

  if (screen === "splash") {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (screen === "login") {
    return <LoginPage onLogin={handleLogin} onRegister={() => setAppState({ screen: "setup", profile: null })} />;
  }

  if (screen === "setup") {
    return <SetupPage onComplete={handleSetupComplete} onBack={() => setAppState({ screen: "login", profile: null })} />;
  }

  if (screen === "manager-dashboard" && profile) {
    return <Dashboard profile={profile} onLogout={handleLogout} />;
  }

  if (screen === "guard-patrol" && profile) {
    return (
      <GuardPatrol
        guardId={profile.uid}
        guardName={profile.displayName}
        companyId={profile.companyId}
        onLogout={handleLogout}
      />
    );
  }

  // Fallback: if we somehow get here, go to login (never back to splash)
  return <LoginPage onLogin={handleLogin} onRegister={() => setAppState({ screen: "setup", profile: null })} />;
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
