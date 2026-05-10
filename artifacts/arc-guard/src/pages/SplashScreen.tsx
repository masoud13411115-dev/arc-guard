import { useEffect } from "react";
import arcGuardLogo from "/arc-guard-logo.png";

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  useEffect(() => {
    // ?skip param lets us screenshot the login page directly
    const delay = new URLSearchParams(location.search).has("skip") ? 0 : 2800;
    const t = setTimeout(onComplete, delay);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-background arc-grid-bg">
      {/* Scan line */}
      <div className="pointer-events-none absolute inset-x-0 h-32 arc-scan-line"
        style={{ animation: "scan 3s linear infinite" }} />

      {/* Radial glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-96 h-96 rounded-full opacity-20 animate-pulse-ring"
          style={{ background: "radial-gradient(circle, rgba(14,165,233,0.4) 0%, transparent 70%)" }} />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-5 animate-fade-in-up">
        <img src={arcGuardLogo} alt="ARC Guard" className="w-40 h-40 object-contain animate-glow-pulse"
          style={{ filter: "drop-shadow(0 0 28px rgba(14,165,233,0.55))" }} />

        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-widest text-primary arc-glow-text">ARC Guard</h1>
          <p className="mt-2 text-sm text-muted-foreground tracking-[0.25em]">سیستم هوشمند گشت امنیتی</p>
        </div>

        {/* Loading bar */}
        <div className="w-48 h-0.5 bg-muted rounded-full overflow-hidden mt-2">
          <div className="h-full bg-primary rounded-full" style={{ animation: "expand-bar 2.4s ease-in-out forwards" }} />
        </div>
      </div>

      {/* Corner brackets */}
      <div className="absolute top-6 left-6 w-8 h-8 border-l-2 border-t-2 border-primary opacity-40" />
      <div className="absolute top-6 right-6 w-8 h-8 border-r-2 border-t-2 border-primary opacity-40" />
      <div className="absolute bottom-6 left-6 w-8 h-8 border-l-2 border-b-2 border-primary opacity-40" />
      <div className="absolute bottom-6 right-6 w-8 h-8 border-r-2 border-b-2 border-primary opacity-40" />

      <style>{`@keyframes expand-bar { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  );
}
