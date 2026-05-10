import { useState } from "react";
import { Shield, Eye, EyeOff, Lock, User } from "lucide-react";
import arcGuardLogo from "/arc-guard-logo.png";

interface LoginPageProps {
  onLogin: (role: "manager" | "employee", username: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("نام کاربری و رمز عبور الزامی است.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const lower = username.toLowerCase();
      if (lower.includes("manager") || lower.includes("مدیر") || lower === "admin") {
        onLogin("manager", username);
      } else {
        onLogin("employee", username);
      }
    }, 1200);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-background arc-grid-bg">
      {/* Glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, rgba(14,165,233,0.5) 0%, transparent 65%)" }} />
      </div>

      {/* Corners */}
      <div className="absolute top-5 left-5 w-7 h-7 border-l-2 border-t-2 border-primary opacity-30" />
      <div className="absolute top-5 right-5 w-7 h-7 border-r-2 border-t-2 border-primary opacity-30" />
      <div className="absolute bottom-5 left-5 w-7 h-7 border-l-2 border-b-2 border-primary opacity-30" />
      <div className="absolute bottom-5 right-5 w-7 h-7 border-r-2 border-b-2 border-primary opacity-30" />

      <div className="relative z-10 w-full max-w-sm mx-auto px-6 animate-fade-in-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src={arcGuardLogo} alt="ARC Guard" className="w-28 h-28 object-contain mb-4"
            style={{ filter: "drop-shadow(0 0 20px rgba(14,165,233,0.5))" }} />
          <h1 className="text-2xl font-bold text-primary arc-glow-text tracking-wider">ARC Guard</h1>
          <p className="text-xs text-muted-foreground tracking-wide mt-1.5">سیستم هوشمند گشت امنیتی</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-6"
          style={{ boxShadow: "0 0 40px rgba(14,165,233,0.08), inset 0 1px 0 rgba(14,165,233,0.08)" }}>
          <div className="flex items-center gap-2 mb-5">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">ورود به سیستم</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground tracking-wide">نام کاربری</label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder="نام کاربری یا شناسه نگهبان"
                  className="w-full bg-muted border border-border rounded-lg pr-10 pl-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground tracking-wide">رمز عبور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type={showPassword ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  className="w-full bg-muted border border-border rounded-lg pr-10 pl-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-primary text-primary-foreground rounded-lg py-3 text-sm font-bold tracking-wide transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 mt-2"
              style={{ boxShadow: "0 0 20px rgba(14,165,233,0.25)" }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  در حال احراز هویت...
                </span>
              ) : "ورود"}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-border flex items-center justify-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-muted-foreground">اتصال رمزگذاری شده</span>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5 opacity-40">ARC Guard v2.0</p>

        {/* Login hint */}
        <div className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-center">
          <p className="text-xs text-muted-foreground">مدیر: نام کاربری شامل «manager» یا «مدیر»</p>
          <p className="text-xs text-muted-foreground">نگهبان: هر نام کاربری دیگر</p>
        </div>
      </div>
    </div>
  );
}
