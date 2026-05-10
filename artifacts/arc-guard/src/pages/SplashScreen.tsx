import { useEffect } from "react";
import arcGuardLogo from "/arc-guard-logo.png";

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-background arc-grid-bg">
      {/* Scanning line animation */}
      <div
        className="pointer-events-none absolute inset-x-0 h-32 arc-scan-line"
        style={{ animation: "scan 3s linear infinite" }}
      />

      {/* Radial glow behind logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-96 h-96 rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, rgba(14,165,233,0.4) 0%, transparent 70%)",
            animation: "pulse-ring 2.5s ease-in-out infinite",
          }}
        />
      </div>

      {/* Logo */}
      <div
        className="relative z-10 flex flex-col items-center gap-6 animate-fade-in-up"
        style={{ animationDuration: "0.8s" }}
      >
        <img
          src={arcGuardLogo}
          alt="ARC Guard"
          className="w-44 h-44 object-contain animate-glow-pulse drop-shadow-lg"
          style={{ filter: "drop-shadow(0 0 24px rgba(14,165,233,0.5))" }}
        />

        <div className="text-center">
          <h1
            className="text-4xl font-bold tracking-widest text-primary arc-glow-text"
            style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "0.15em" }}
          >
            ARC Guard
          </h1>
          <p className="mt-2 text-sm text-muted-foreground tracking-[0.3em] uppercase">
            Secure Attendance System
          </p>
        </div>

        {/* Loading bar */}
        <div className="w-48 h-0.5 bg-muted rounded-full overflow-hidden mt-4">
          <div
            className="h-full bg-primary rounded-full"
            style={{
              animation: "expand-bar 2.4s ease-in-out forwards",
            }}
          />
        </div>
      </div>

      {/* Corner decorations */}
      <div className="absolute top-6 left-6 w-8 h-8 border-l-2 border-t-2 border-primary opacity-40" />
      <div className="absolute top-6 right-6 w-8 h-8 border-r-2 border-t-2 border-primary opacity-40" />
      <div className="absolute bottom-6 left-6 w-8 h-8 border-l-2 border-b-2 border-primary opacity-40" />
      <div className="absolute bottom-6 right-6 w-8 h-8 border-r-2 border-b-2 border-primary opacity-40" />

      <style>{`
        @keyframes expand-bar {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
