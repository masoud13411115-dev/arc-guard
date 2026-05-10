import { Bell, Menu, Shield } from "lucide-react";
import arcGuardLogo from "/arc-guard-logo.png";

interface MobileHeaderProps {
  title?: string;
  subtitle?: string;
  onMenuClick?: () => void;
  notificationCount?: number;
}

export default function MobileHeader({
  title = "ARC Guard",
  subtitle,
  onMenuClick,
  notificationCount = 0,
}: MobileHeaderProps) {
  return (
    <header
      className="sticky top-0 z-50 w-full flex items-center justify-between px-4 py-3 border-b border-border bg-card"
      style={{ boxShadow: "0 1px 0 rgba(14,165,233,0.1), 0 4px 16px rgba(0,0,0,0.4)" }}
    >
      {/* Left: Menu button */}
      <button
        onClick={onMenuClick}
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-muted hover:bg-accent transition-colors"
      >
        <Menu className="w-4 h-4 text-foreground" />
      </button>

      {/* Center: Logo + Title */}
      <div className="flex items-center gap-2.5">
        <img
          src={arcGuardLogo}
          alt="ARC Guard"
          className="w-8 h-8 object-contain"
          style={{ filter: "drop-shadow(0 0 8px rgba(14,165,233,0.5))" }}
        />
        <div className="flex flex-col">
          <span className="text-sm font-bold text-primary leading-tight tracking-wider arc-glow-text">
            {title}
          </span>
          {subtitle && (
            <span className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase leading-tight">
              {subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Right: Notifications */}
      <button className="relative w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-muted hover:bg-accent transition-colors">
        <Bell className="w-4 h-4 text-foreground" />
        {notificationCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
            {notificationCount > 9 ? "9+" : notificationCount}
          </span>
        )}
      </button>
    </header>
  );
}
