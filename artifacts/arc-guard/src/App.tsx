import { useState, useEffect } from "react";
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

function AppContent() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(!isFirebaseReady);

  useEffect(() => {
    // No Firebase → skip auth check, go straight to login (demo mode)
    if (!isFirebaseReady) return;

    const unsub = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        const p = await getUserProfile(firebaseUser.uid);
        if (p) {
          setProfile(p);
          setScreen(p.role === "manager" ? "manager-dashboard" : "guard-patrol");
        } else {
          setScreen("setup");
        }
      } else {
        setProfile(null);
      }
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  const handleSplashComplete = () => setScreen("login");

  const handleLogin = (p: UserProfile) => {
    setProfile(p);
    setScreen(p.role === "manager" ? "manager-dashboard" : "guard-patrol");
  };

  const handleSetupComplete = (p: UserProfile) => {
    setProfile(p);
    setScreen(p.role === "manager" ? "manager-dashboard" : "guard-patrol");
  };

  const handleLogout = async () => {
    await signOut();
    setProfile(null);
    setScreen("login");
  };

  if (screen === "splash") return <SplashScreen onComplete={handleSplashComplete} />;
  if (screen === "login") return <LoginPage onLogin={handleLogin} onRegister={() => setScreen("setup")} />;
  if (screen === "setup") return <SetupPage onComplete={handleSetupComplete} onBack={() => setScreen("login")} />;
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
  return <SplashScreen onComplete={handleSplashComplete} />;
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
