"use client";

import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface DashboardHeaderProps {
  demoTime: string;
  timeMode: "SIMULATED" | "LIVE";
  onTimeModeChange: (mode: "SIMULATED" | "LIVE") => void;
  onReset: () => void;
}

export function DashboardHeader({
  demoTime,
  timeMode,
  onTimeModeChange,
  onReset,
}: DashboardHeaderProps) {
  const dateObj = new Date(demoTime);
  const formattedTime = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: timeMode === "LIVE" ? "2-digit" : undefined,
  }).format(dateObj);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-5 py-3 shadow-sm flex-wrap gap-3">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-900">
          Điều phối tour nhân viên
        </h1>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-600">
            {timeMode === "LIVE" ? (
              <>
                <span className="relative flex h-3 w-3 inline-block mr-2 align-middle">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                Thời gian thực trên ngày dữ liệu mô phỏng 31/07/2026: {formattedTime}
              </>
            ) : (
              `Thời gian mô phỏng: ${formattedTime}`
            )}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <select
          value={timeMode}
          onChange={(e) => onTimeModeChange(e.target.value as "SIMULATED" | "LIVE")}
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          <option value="SIMULATED">Thời gian mô phỏng</option>
          <option value="LIVE">Thời gian thực</option>
        </select>
        <Button id="reset-demo-btn" variant="outline" size="sm" onClick={onReset} className="h-9 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700">
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Khôi phục dữ liệu demo
        </Button>
      </div>
    </header>
  );
}
