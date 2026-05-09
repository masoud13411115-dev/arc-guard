import React, { useState } from "react";
import { Clock, CalendarDays, CalendarCheck } from "lucide-react";
import ShiftManager from "./ShiftManager";
import HolidayManager from "./HolidayManager";
import WorkdaySettings from "./WorkdaySettings";

type Tab = "shifts" | "holidays" | "workdays";

export default function WorkSettings() {
  const [tab, setTab] = useState<Tab>("shifts");

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "shifts",   label: "شیفت‌ها",     icon: <Clock size={13} /> },
    { key: "holidays", label: "تعطیلات",     icon: <CalendarDays size={13} /> },
    { key: "workdays", label: "روزهای کاری", icon: <CalendarCheck size={13} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tab bar */}
      <div className="flex rounded-2xl overflow-hidden border border-white/10">
        {tabs.map((t, i) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            data-testid={`subtab-${t.key}`}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
              i > 0 ? "border-r border-white/10" : ""
            } ${
              tab === t.key ? "bg-white/15 text-white" : "text-white/45 hover:text-white/70"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "shifts"   && <ShiftManager />}
      {tab === "holidays" && <HolidayManager />}
      {tab === "workdays" && <WorkdaySettings />}
    </div>
  );
}
