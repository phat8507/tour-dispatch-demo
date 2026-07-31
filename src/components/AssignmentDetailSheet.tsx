"use client";

import { Assignment, Employee, Location, Order, Service } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ASSIGNMENT_STATUS_LABEL,
  ORDER_TYPE_LABEL,
  URGENCY_LABEL,
  PERFORMANCE_LEVEL_LABEL,
  BRANCH_LABEL,
  formatTimeHHMM,
} from "@/domain/timeline";

interface AssignmentDetailSheetProps {
  assignment: Assignment | null;
  order: Order | null;
  employee: Employee | null;
  location: Location | null;
  services: Service[];
  open: boolean;
  onClose: () => void;
}

const statusColors: Record<Assignment["status"], string> = {
  SCHEDULED: "bg-sky-100 text-sky-700",
  IN_PROGRESS: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-gray-100 text-gray-600",
  DELAYED: "bg-red-100 text-red-700",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-sm py-1.5">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

export function AssignmentDetailSheet({
  assignment,
  order,
  employee,
  location,
  services,
  open,
  onClose,
}: AssignmentDetailSheetProps) {
  if (!assignment || !order || !employee) return null;

  const displayStatus = ASSIGNMENT_STATUS_LABEL[assignment.status];

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent id="assignment-detail-sheet" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-lg">Chi tiết đơn hàng</SheetTitle>
        </SheetHeader>

        <div className="mb-4">
          <Badge className={`text-xs px-2 py-1 ${statusColors[assignment.status]}`}>
            {displayStatus}
          </Badge>
        </div>

        <div className="space-y-0.5">
          <Separator className="my-3" />
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Khách hàng</p>
          <Row label="Tên khách" value={order.customerName} />
          <Row label="Vị trí" value={location?.name ?? order.locationId} />
          <Row label="Loại đơn" value={ORDER_TYPE_LABEL[order.orderType]} />
          <Row label="Đặt lịch" value={URGENCY_LABEL[order.urgency]} />
          <Row label="Ghi chú" value={order.notes || "—"} />

          <Separator className="my-3" />
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Dịch vụ</p>
          <Row
            label="Tên dịch vụ"
            value={
              services.length > 0
                ? services.map((service) => service.name).join(", ")
                : order.serviceId
            }
          />
          <Row
            label="Thời lượng"
            value={
              services.length > 0
                ? `${services.reduce(
                    (total, service) => total + service.durationMinutes,
                    0,
                  )} phút`
                : "—"
            }
          />

          <Separator className="my-3" />
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Nhân viên</p>
          <Row label="Tên" value={employee.name} />
          <Row label="Chi nhánh" value={BRANCH_LABEL[employee.branchId]} />
          <Row label="Cấp độ" value={PERFORMANCE_LEVEL_LABEL[employee.performanceLevel]} />

          <Separator className="my-3" />
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Lịch hẹn</p>
          <Row label="Giờ bắt đầu" value={formatTimeHHMM(assignment.startTime)} />
          <Row label="Giờ kết thúc" value={formatTimeHHMM(assignment.endTime)} />
          <Row label="Trạng thái" value={displayStatus} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
