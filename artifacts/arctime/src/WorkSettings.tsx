import React, { useState } from "react";
import { Clock, CalendarDays } from "lucide-react";
import ShiftManager from "./ShiftManager";
import HolidayManager from "./HolidayManager";

export default function WorkSettings() {
  const [tab, setTab] = useState<"shifts" | "holidays">("shifts");

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tab bar */}
      <div className="flex rounded-2xl overflow-hidden border border-white/10">
        <button
          onClick={() => setTab("shifts")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
            tab === "shifts" ? "bg-white/15 text-white" : "text-white/45 hover:text-white/70"
          }`}
          data-testid="subtab-shifts"
        >
          <Clock size={14} />
          شیفت‌ها
        </button>
        <button
          onClick={() => setTab("holidays")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors border-r border-white/10 ${
            tab === "holidays" ? "bg-white/15 text-white" : "text-white/45 hover:text-white/70"
          }`}
          data-testid="subtab-holidays"
        >
          <CalendarDays size={14} />
          تعطیلات
        </button>
      </div>

      {tab === "shifts" && <ShiftManager />}
      {tab === "holidays" && <HolidayManager />}
    </div>
  );
}
