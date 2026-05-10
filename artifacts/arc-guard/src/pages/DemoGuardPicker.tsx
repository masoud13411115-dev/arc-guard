/**
 * DemoGuardPicker — Guard selection screen for Real Test Mode.
 * Shown before GuardPatrol when Firebase is not configured.
 * Reads guards from demo-store (reactive), persists selection in localStorage.
 */

import { useState, useEffect } from "react";
import {
  Shield, ChevronLeft, Users, CheckCircle, Settings,
  UserCircle, Hash, ArrowLeft,
} from "lucide-react";
import arcGuardLogo from "/arc-guard-logo.png";
import * as demoStore from "@/lib/demo-store";
import type { UserProfile } from "@/types";

interface DemoGuardPickerProps {
  onSelect: (guard: UserProfile) => void;
  onBack: () => void;
  onGoToManager: () => void;
}

export default function DemoGuardPicker({ onSelect, onBack, onGoToManager }: DemoGuardPickerProps) {
  const [guards, setGuards] = useState<UserProfile[]>([]);
  const [selected, setSelected] = useState<UserProfile | null>(() => demoStore.getActiveGuard());

  useEffect(() => demoStore.subscribeGuards(setGuards), []);

  const handleConfirm = () => {
    if (!selected) return;
    demoStore.setActiveGuard(selected);
    onSelect(selected);
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-background arc-grid-bg" dir="rtl"
      style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>

      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div className="w-[400px] h-[400px] rounded-full opacity-8"
          style={{ background: "radial-gradient(circle,rgba(14,165,233,.4) 0%,transparent 65%)" }} />
      </div>

      {/* Header */}
      <div className="relative flex items-center justify-between px-4 pt-4 pb-3 border-b border-border bg-card/50 backdrop-blur shrink-0"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" />
          <span className="text-xs">بازگشت</span>
        </button>
        <div className="flex items-center gap-2">
          <img src={arcGuardLogo} alt="ARC Guard" className="w-7 h-7 object-contain"
            style={{ filter: "drop-shadow(0 0 8px rgba(14,165,233,0.4))" }} />
          <p className="text-sm font-bold text-primary tracking-wider">ARC Guard</p>
        </div>
        <div className="w-16" />
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pt-6 pb-4 overflow-y-auto max-w-md mx-auto w-full">

        {/* Title */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">انتخاب نگهبان</h1>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            نگهبانی که امروز گشت می‌زند را انتخاب کنید
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            <span className="text-[11px] text-sky-400 font-medium">حالت آزمایشی</span>
          </div>
        </div>

        {/* No guards state */}
        {guards.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">هنوز نگهبانی ثبت نشده</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                ابتدا از پنل مدیریت، نگهبانان را اضافه کنید، سپس وارد حالت گشت شوید.
              </p>
            </div>
            <button
              onClick={onGoToManager}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary/10 border border-primary/30 text-sm font-bold text-primary hover:bg-primary/20 transition-colors"
            >
              <Settings className="w-4 h-4" />
              ورود به پنل مدیر → افزودن نگهبان
            </button>
            <button
              onClick={onBack}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              بازگشت
            </button>
          </div>
        )}

        {/* Guard list */}
        {guards.length > 0 && (
          <div className="space-y-2.5">
            {guards.map((g) => {
              const isActive = selected?.uid === g.uid;
              return (
                <button
                  key={g.uid}
                  onClick={() => setSelected(g)}
                  className={`w-full rounded-2xl border-2 p-4 flex items-center gap-4 text-right transition-all ${
                    isActive
                      ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                      : "border-border bg-card hover:border-primary/40 hover:bg-card/80"
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-xl font-bold border-2 transition-colors ${
                    isActive
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-muted border-border text-foreground"
                  }`}>
                    {g.displayName.charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 text-right">
                    <p className={`text-base font-bold truncate ${isActive ? "text-primary" : "text-foreground"}`}>
                      {g.displayName}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {g.guardCode && (
                        <span className={`flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md ${
                          isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          <Hash className="w-3 h-3" />{g.guardCode}
                        </span>
                      )}
                      <span className={`text-xs truncate ${isActive ? "text-primary/70" : "text-muted-foreground"}`}>
                        {g.email}
                      </span>
                    </div>
                  </div>

                  {/* Check */}
                  <div className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isActive
                      ? "border-primary bg-primary"
                      : "border-border bg-transparent"
                  }`}>
                    {isActive && <CheckCircle className="w-4 h-4 text-primary-foreground" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Last selected hint */}
        {selected && guards.length > 0 && (
          <div className="mt-4 rounded-xl border border-border bg-muted/30 px-4 py-3 flex items-center gap-2.5">
            <UserCircle className="w-4 h-4 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground flex-1">
              انتخاب شده:{" "}
              <span className="font-bold text-foreground">{selected.displayName}</span>
              {selected.guardCode && (
                <span className="font-mono text-primary"> · {selected.guardCode}</span>
              )}
            </p>
          </div>
        )}

        {/* Confirm button */}
        {guards.length > 0 && (
          <button
            onClick={handleConfirm}
            disabled={!selected}
            className="mt-5 w-full py-4 rounded-2xl bg-primary text-primary-foreground text-base font-bold
              disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]
              transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            <Shield className="w-5 h-5" />
            شروع گشت امنیتی
          </button>
        )}

        <p className="text-center text-[10px] text-muted-foreground/40 mt-4">
          اسکن‌ها زیر نام نگهبان انتخابی ذخیره می‌شوند
        </p>
      </div>
    </div>
  );
}
