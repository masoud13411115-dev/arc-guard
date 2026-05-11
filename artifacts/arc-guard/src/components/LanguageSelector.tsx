import { useState, useRef, useEffect } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { useI18n, LANGUAGES, type Lang } from "@/lib/i18n";

interface LanguageSelectorProps {
  /** compact = just a small globe icon button, full = globe + current lang label */
  variant?: "compact" | "full";
  className?: string;
}

export default function LanguageSelector({ variant = "full", className = "" }: LanguageSelectorProps) {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = LANGUAGES.find((l) => l.code === lang)!;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-border bg-muted/60 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors text-[13px]"
      >
        <Globe className="w-3.5 h-3.5 shrink-0" />
        {variant === "full" && (
          <span className="font-medium">{current.nativeLabel}</span>
        )}
        <span>{current.flag}</span>
        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 min-w-[160px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          style={{ top: "calc(100% + 4px)", right: 0 }}
        >
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => { setLang(l.code as Lang); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-[14px] text-left transition-colors ${
                lang === l.code
                  ? "bg-primary/10 text-primary font-bold"
                  : "text-foreground hover:bg-accent"
              }`}
            >
              <span className="text-lg">{l.flag}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold leading-none">{l.nativeLabel}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{l.label}</p>
              </div>
              {lang === l.code && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
