import { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "@/pages/LandingPage";
import ManagerApp from "@/pages/ManagerApp";
import GuardApp from "@/pages/GuardApp";
import SplashScreen from "@/pages/SplashScreen";
import QAPage from "@/pages/QAPage";
import InstallPrompt, { UpdateBanner } from "@/components/InstallPrompt";
import { isFirebaseReady } from "@/firebase";
import { initPWA, applyUpdate, isPWAInstalled } from "@/lib/pwa";
import { syncOfflineQueue } from "@/lib/adapter";
import { listenForSyncTrigger, getQueueCount } from "@/lib/offline";
import { onNetworkChange, type NetworkState } from "@/lib/network";
import { logger } from "@/lib/logger";
import { Capacitor } from "@capacitor/core";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30_000 } },
});

// Derive Wouter base from Vite's BASE_URL.
// • Web build:     BASE_URL = '/arc-guard/'  →  routerBase = '/arc-guard'
// • Android build: BASE_URL = './'           →  routerBase = ''
//   Wouter with base="." cannot strip '.' from absolute Android paths,
//   so we fall back to '' which lets Wouter match routes from the root '/'.
const rawBase = import.meta.env.BASE_URL;
const routerBase = rawBase === "./" ? "" : rawBase.replace(/\/$/, "") || "";

function NetworkBanner({ state }: { state: NetworkState }) {
  const { t, dir } = useI18n();
  if (state === "online") return null;
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[70] flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium"
      style={{ background: "rgba(239,68,68,0.15)", borderBottom: "1px solid rgba(239,68,68,0.3)" }}
      dir={dir}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
      <span className="text-red-400">{t("app.offline.banner")}</span>
    </div>
  );
}

function AppContent() {
  const { t, dir } = useI18n();
  const [splashDone, setSplashDone]         = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [offlineCount, setOfflineCount]     = useState(0);
  const [networkState, setNetworkState]     = useState<NetworkState>("online");
  const [isStandalone]                      = useState(isPWAInstalled);

  useEffect(() => {
    // PWA service-worker registration only applies on the web.
    // Skip it entirely when running inside a Capacitor native container:
    // the SW scope / manifest paths use '/arc-guard/' which doesn't match
    // Capacitor's http://localhost origin, and registerSW() can interfere
    // with startup on some Android WebView versions.
    if (!Capacitor.isNativePlatform()) {
      initPWA(() => setUpdateAvailable(true));
    }
    logger.info("app", "ARC Guard starting", { pwa: isPWAInstalled(), firebase: isFirebaseReady, native: Capacitor.isNativePlatform() });
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
          dir={dir}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          {t("app.syncing", { n: offlineCount })}
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
            <Route path="/qa"      component={QAPage} />
            <Route component={LandingPage} />
          </Switch>
        </Router>
      </div>
    </>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
