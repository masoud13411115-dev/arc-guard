import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import SplashScreen from "@/pages/SplashScreen";
import LoginPage from "@/pages/LoginPage";
import Dashboard from "@/pages/Dashboard";
import GuardPatrol from "@/pages/GuardPatrol";

const queryClient = new QueryClient();

type Screen = "splash" | "login" | "manager-dashboard" | "guard-patrol";

interface User {
  id: string;
  name: string;
  role: "manager" | "employee";
}

function AppContent() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [user, setUser] = useState<User | null>(null);

  const handleSplashComplete = () => setScreen("login");

  const handleLogin = (role: "manager" | "employee", username: string) => {
    const id = `guard_${username.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`;
    setUser({ id, name: username, role });
    setScreen(role === "manager" ? "manager-dashboard" : "guard-patrol");
  };

  const handleLogout = () => {
    setUser(null);
    setScreen("login");
  };

  if (screen === "splash") return <SplashScreen onComplete={handleSplashComplete} />;
  if (screen === "login") return <LoginPage onLogin={handleLogin} />;
  if (screen === "manager-dashboard") return <Dashboard onLogout={handleLogout} />;
  if (screen === "guard-patrol" && user) {
    return (
      <GuardPatrol
        guardId={user.id}
        guardName={user.name}
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
