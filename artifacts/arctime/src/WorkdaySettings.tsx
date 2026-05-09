import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { CalendarCheck, RefreshCw, Check } from "lucide-react";

const DAYS = [
  { label: "شنبه",     short: "ش",  dow: 6 },
  { label: "یکشنبه",   short: "ی",  dow: 0 },
  { label: "دوشنبه",   short: "د",  dow: 1 },
  { label: "سه‌شنبه",  short: "س",  dow: 2 },
  { label: "چهارشنبه", short: "چ",  dow: 3 },
  { label: "پنجشنبه",  short: "پ",  dow: 4 },
  { label: "جمعه",     short: "ج",  dow: 5 },
];

export const DEFAULT_WORKING_DAYS = [6, 0, 1, 2, 3, 4]; // Sat–Thu (جمعه off)

export default function WorkdaySettings() {
  const [workingDays, setWorkingDays] = useState<number[]>(DEFAULT_WORKING_DAYS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSettings = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "settings", "workdays"));
      if (snap.exists()) {
        setWorkingDays(snap.data().workingDays as number[]);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  const toggle = async (dow: number) => {
    const newDays = workingDays.includes(dow)
      ? workingDays.filter(d => d !== dow)
      : [...workingDays, dow];
    setWorkingDays(newDays);
    if (!db) return;
    setSaving(true);
    setSaved(false);
    try {
      await setDoc(doc(db, "settings", "workdays"), {
        workingDays: newDays,
        updatedAt: new Date().toISOString(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-white/60">
          <CalendarCheck size={14} />
          <span>روزهای کاری هفته</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSettings}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          {saving && <span className="text-xs text-white/35">ذخیره...</span>}
          {saved && !saving && (
            <span className="flex items-center gap-1 text-xs text-teal-300 bg-teal-500/15 px-2.5 py-1 rounded-xl">
              <Check size={11} /> ذخیره شد
            </span>
          )}
        </div>
      </div>

      {/* Day toggle grid */}
      <div className="glass-card p-4 flex flex-col gap-3">
        <p className="text-xs text-white/45 leading-relaxed">
          روزهایی که کارمندان موظف به حضور هستند را انتخاب کنید.
          کار در روزهای غیرکاری به‌عنوان «تعطیل کاری» در گزارش‌ها ثبت می‌شود.
        </p>

        <div className="grid grid-cols-7 gap-1">
          {DAYS.map(day => {
            const on = workingDays.includes(day.dow);
            return (
              <button
                key={day.dow}
                onClick={() => toggle(day.dow)}
                data-testid={`toggle-day-${day.dow}`}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-center transition-all ${
                  on
                    ? "bg-blue-500/20 border-blue-400/40 text-blue-300"
                    : "bg-white/5 border-white/8 text-white/30 hover:text-white/50"
                }`}
              >
                <span className="text-xs font-bold">{day.short}</span>
                <div className={`w-1.5 h-1.5 rounded-full transition-colors ${on ? "bg-blue-400" : "bg-white/15"}`} />
              </button>
            );
          })}
        </div>

        {/* Full day name labels */}
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map(day => (
            <p key={day.dow} className={`text-center text-[8px] leading-tight ${
              workingDays.includes(day.dow) ? "text-blue-300/50" : "text-white/20"
            }`}>
              {day.label}
            </p>
          ))}
        </div>
      </div>

      {/* Status summary */}
      <div className="glass-card p-4 flex flex-col gap-2.5">
        <p className="text-xs text-white/55 font-semibold">وضعیت جاری</p>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-blue-300/60 font-medium ml-1">کاری:</span>
            {DAYS.filter(d => workingDays.includes(d.dow)).map(d => (
              <span key={d.dow} className="text-[10px] bg-blue-500/15 text-blue-300 px-2 py-0.5 rounded-lg">
                {d.label}
              </span>
            ))}
            {DAYS.filter(d => workingDays.includes(d.dow)).length === 0 && (
              <span className="text-[10px] text-white/30">هیچ روزی انتخاب نشده</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-white/35 font-medium ml-1">تعطیل:</span>
            {DAYS.filter(d => !workingDays.includes(d.dow)).map(d => (
              <span key={d.dow} className="text-[10px] bg-white/8 text-white/30 px-2 py-0.5 rounded-lg">
                {d.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
