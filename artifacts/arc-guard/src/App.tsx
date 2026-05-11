import { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "@/pages/LandingPage";
import ManagerApp from "@/pages/ManagerApp";
import GuardApp from "@/pages/GuardApp";
import SplashScreen from "@/pages/SplashScreen";
import InstallPrompt, { UpdateBanner } from "@/components/InstallPrompt";
import { isFirebaseReady } from "@/firebase";
import { initPWA, applyUpdate, isPWAInstalled } from "@/lib/pwa";
import { syncOfflineQueue } from "@/lib/firestore";
import { listenForSyncTrigger, getQueueCount } from "@/lib/offline";
import { onNetworkChange, type NetworkState } from "@/lib/network";
import { logger } from "@/lib/logger";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30_000 } },
});

// Strip trailing slash from Vite BASE_URL for wouter base prop
// e.g. "/arc-guard/" → "/arc-guard"
const routerBase = import.meta.env.BASE_URL.replace(/\/$/, "") || "";

function NetworkBanner({ state }: { state: NetworkState }) {
  if (state === "online") return null;
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[70] flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium"
      style={{ background: "rgba(239,68,68,0.15)", borderBottom: "1px solid rgba(239,68,68,0.3)" }}
      dir="rtl"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
      <span className="text-red-400">اتصال قطع است — اسکن‌ها در صف ذخیره می‌شوند</span>
    </div>
  );
}

function AppContent() {
  const [splashDone, setSplashDone]         = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [offlineCount, setOfflineCount]     = useState(0);
  const [networkState, setNetworkState]     = useState<NetworkState>("online");
  const [isStandalone]                      = useState(isPWAInstalled);

  useEffect(() => {
    initPWA(() => setUpdateAvailable(true));
    logger.info("app", "ARC Guard starting", { pwa: isPWAInstalled(), firebase: isFirebaseReady });
    const unsub = listenForSyncTrigger(async () => {
      if (isFirebaseReady) {
        const synced = await syncOfflineQueue();
        if (synced > 0) { setOfflineCount(getQueueCount()); }
      }
    });
    setOfflineCount(getQueueCount());
    return unsub;
  }, []);

  useEffect(() => {
    return onNetworkChange((state) => {
      setNetworkState(state);
      if (state === "online" && isFirebaseReady && getQueueCount() > 0) {
        syncOfflineQueue().then((n) => { if (n > 0) setOfflineCount(getQueueCount()); }).catch(() => {});
      }
    });
  }, []);

  const handleSplashComplete = useCallback(() => setSplashDone(true), []);
  const topOffset = networkState !== "online" || offlineCount > 0 ? "pt-8" : "";

  if (!splashDone) return <SplashScreen onComplete={handleSplashComplete} />;

  return (
    <>
      <NetworkBanner state={networkState} />

      {offlineCount > 0 && networkState === "online" && (
        <div
          className="fixed top-0 left-0 right-0 z-[65] flex items-center justify-center gap-2 px-4 py-1.5 text-xs text-yellow-400"
          style={{ background: "rgba(234,179,8,0.12)", borderBottom: "1px solid rgba(234,179,8,0.25)" }}
          dir="rtl"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          {offlineCount} اسکن در حال همگام‌سازی...
        </div>
      )}

      {updateAvailable && (
        <UpdateBanner onUpdate={applyUpdate} onDismiss={() => setUpdateAvailable(false)} />
      )}

      {!isStandalone && <InstallPrompt />}

      <div className={topOffset}>
        {/* Browser-location router with Vite base path as prefix */}
        <Router base={routerBase}>
          <Switch>
            <Route path="/manager" component={ManagerApp} />
            <Route path="/guard"   component={GuardApp} />
            <Route component={LandingPage} />
          </Switch>
        </Router>
      </div>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
