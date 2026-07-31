"use client";

import {
  AssignmentSuggestion,
  Employee,
  Location,
  Order,
  Service,
} from "@/types";
import { Button } from "@/components/ui/button";
import {
  formatTimeHHMM,
  formatTimeHHMMInTimeZone,
} from "@/domain/timeline";
import { DEMO_TIMEZONE } from "@/data/mockData";

interface AssignmentConfirmationProps {
  order: Order;
  suggestion: AssignmentSuggestion | null;
  employees: Employee[];
  locations: Location[];
  services: Service[];
  confirming: boolean;
  error: string | null;
  onConfirm: () => void;
}

export function AssignmentConfirmation({
  order,
  suggestion,
  employees,
  locations,
  services,
  confirming,
  error,
  onConfirm,
}: AssignmentConfirmationProps) {
  const employee = suggestion
    ? employees.find((candidate) => candidate.id === suggestion.employeeId)
    : undefined;
  const location = locations.find(
    (candidate) => candidate.id === order.locationId,
  );
  const selectedServiceIds = order.serviceIds ?? [order.serviceId];
  const selectedServices = selectedServiceIds
    .map((serviceId) =>
      services.find((candidate) => candidate.id === serviceId),
    )
    .filter((service): service is Service => Boolean(service));

  return (
    <section
      aria-labelledby="confirmation-title"
      className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4"
    >
      <h3 id="confirmation-title" className="font-semibold">
        Xác nhận phân công
      </h3>

      {suggestion && employee ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Khách hàng</dt>
            <dd className="font-medium">{order.customerName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Địa điểm</dt>
            <dd>{location?.name ?? order.locationId}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Dịch vụ</dt>
            <dd>{selectedServices.map((service) => service.name).join(", ")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Giờ yêu cầu</dt>
            <dd>{formatTimeHHMM(order.requestedTime)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Nhân viên</dt>
            <dd className="font-medium">{employee.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Di chuyển</dt>
            <dd>{suggestion.estimatedTravelMinutes} phút</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Dự kiến đến</dt>
            <dd>
              {formatTimeHHMMInTimeZone(
                suggestion.estimatedArrivalAt,
                DEMO_TIMEZONE,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Điểm</dt>
            <dd>{suggestion.score.toFixed(2)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Cảnh báo</dt>
            <dd>
              {suggestion.warnings.length > 0
                ? suggestion.warnings.join(" ")
                : "Không có cảnh báo."}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          Chọn một nhân viên để xem tóm tắt và xác nhận.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <Button
        type="button"
        onClick={onConfirm}
        disabled={!suggestion || confirming}
        title={
          suggestion
            ? "Xác nhận giao đơn cho nhân viên đã chọn"
            : "Hãy chọn một nhân viên trước khi xác nhận"
        }
        className="w-full"
      >
        {confirming ? "Đang xác nhận..." : "Xác nhận giao Đơn"}
      </Button>
    </section>
  );
}
