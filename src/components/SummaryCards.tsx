import { DashboardSummary } from "@/domain/demo-status";
import { Activity, Users, Clock, ClipboardList, AlertTriangle } from "lucide-react";

interface SummaryCardsProps {
  summary: DashboardSummary;
}

interface CardDef {
  id: string;
  label: string;
  value: number;
  icon: React.ReactNode;
  colorClasses: string;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const cards: CardDef[] = [
    {
      id: "card-working",
      label: "Đang thực hiện",
      value: summary.workingCount,
      icon: <Activity className="h-5 w-5" />,
      colorClasses: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      id: "card-available",
      label: "Đang trống",
      value: summary.availableCount,
      icon: <Users className="h-5 w-5" />,
      colorClasses: "bg-sky-50 text-sky-700 border-sky-200",
    },
    {
      id: "card-completing-soon",
      label: "Sắp hoàn thành (30 phút)",
      value: summary.completingWithin30Count,
      icon: <Clock className="h-5 w-5" />,
      colorClasses: "bg-amber-50 text-amber-700 border-amber-200",
    },
    {
      id: "card-unassigned",
      label: "Đơn chưa phân",
      value: summary.unassignedOrderCount,
      icon: <ClipboardList className="h-5 w-5" />,
      colorClasses: "bg-purple-50 text-purple-700 border-purple-200",
    },
    {
      id: "card-delayed",
      label: "Cảnh báo trễ",
      value: summary.delayedCount,
      icon: <AlertTriangle className="h-5 w-5" />,
      colorClasses: summary.delayedCount > 0
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-gray-50 text-gray-600 border-gray-200",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 px-5 py-4">
      {cards.map((card) => (
        <div
          key={card.id}
          id={card.id}
          className={`flex flex-col gap-2 rounded-xl border p-4 ${card.colorClasses}`}
        >
          <div className="flex items-center justify-between">
            {card.icon}
            <span className="text-3xl font-bold">{card.value}</span>
          </div>
          <p className="text-xs font-medium leading-tight">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
