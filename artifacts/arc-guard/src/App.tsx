import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import SplashScreen from "@/pages/SplashScreen";
import LoginPage from "@/pages/LoginPage";
import Dashboard from "@/pages/Dashboard";

const queryClient = new QueryClient();

type Screen = "splash" | "login" | "dashboard";

function AppContent() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [role, setRole] = useState<"manager" | "employee" | null>(null);

  const handleSplashComplete = () => setScreen("login");

  const handleLogin = (loginRole: "manager" | "employee") => {
    setRole(loginRole);
    setScreen("dashboard");
  };

  const handleLogout = () => {
    setRole(null);
    setScreen("login");
  };

  if (screen === "splash") {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (screen === "login") {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <Dashboard onLogout={handleLogout} />;
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
