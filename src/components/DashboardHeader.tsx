"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { formatTimeHHMM } from "@/domain/timeline";

interface DashboardHeaderProps {
  demoTime: string;
  onReset: () => void;
}

export function DashboardHeader({ demoTime, onReset }: DashboardHeaderProps) {
  const demoDate = demoTime.slice(0, 10); // "2026-07-31"
  const formattedDate = new Date(`${demoDate}T00:00:00+07:00`).toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });

  return (
    <header className="flex items-center justify-between flex-wrap gap-3 px-5 py-4 bg-white border-b border-border shadow-sm">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Điều phối tour nhân viên
        </h1>
        <p className="text-sm text-muted-foreground capitalize">{formattedDate}</p>
      </div>

      <div className="flex items-center gap-3">
        <Badge
          variant="secondary"
          className="px-3 py-1.5 text-sm font-medium bg-blue-50 text-blue-700 border-blue-200"
        >
          ⏱ Thời gian mô phỏng: {formatTimeHHMM(demoTime)}
        </Badge>
        <Button
          id="reset-demo-btn"
          variant="outline"
          size="sm"
          onClick={onReset}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Khôi phục dữ liệu demo
        </Button>
      </div>
    </header>
  );
}
