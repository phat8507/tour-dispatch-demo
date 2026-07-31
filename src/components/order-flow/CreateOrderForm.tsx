"use client";

import { FormEvent } from "react";
import { Location, Service } from "@/types";
import {
  OrderDraft,
  OrderDraftErrors,
  OrderDraftField,
} from "@/domain/order-flow";
import { Button } from "@/components/ui/button";

interface CreateOrderFormProps {
  draft: OrderDraft;
  errors: OrderDraftErrors;
  locations: Location[];
  services: Service[];
  loading: boolean;
  onChange: (draft: OrderDraft) => void;
  onFind: () => void;
}

function FieldError({
  id,
  error,
}: {
  id: string;
  error: string | undefined;
}) {
  return error ? (
    <p id={id} className="text-xs text-red-600" role="alert">
      {error}
    </p>
  ) : null;
}

function describedBy(
  field: OrderDraftField,
  errors: OrderDraftErrors,
): string | undefined {
  return errors[field] ? `${field}-error` : undefined;
}

const fieldClass =
  "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 aria-invalid:border-red-500";

export function CreateOrderForm({
  draft,
  errors,
  locations,
  services,
  loading,
  onChange,
  onFind,
}: CreateOrderFormProps) {
  function update<K extends keyof OrderDraft>(
    field: K,
    value: OrderDraft[K],
  ) {
    onChange({ ...draft, [field]: value });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onFind();
  }

  function toggleService(serviceId: string, selected: boolean) {
    update(
      "serviceIds",
      selected
        ? [...draft.serviceIds, serviceId]
        : draft.serviceIds.filter((id) => id !== serviceId),
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="customer-name" className="text-sm font-medium">
          Tên khách hàng
        </label>
        <input
          id="customer-name"
          className={fieldClass}
          value={draft.customerName}
          onChange={(event) => update("customerName", event.target.value)}
          aria-invalid={Boolean(errors.customerName)}
          aria-describedby={describedBy("customerName", errors)}
        />
        <FieldError id="customerName-error" error={errors.customerName} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="order-location" className="text-sm font-medium">
          Khu vực / địa điểm
        </label>
        <select
          id="order-location"
          className={fieldClass}
          value={draft.locationId}
          onChange={(event) => update("locationId", event.target.value)}
          aria-invalid={Boolean(errors.locationId)}
          aria-describedby={describedBy("locationId", errors)}
        >
          <option value="">Chọn địa điểm</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name} ({location.branchId})
            </option>
          ))}
        </select>
        <FieldError id="locationId-error" error={errors.locationId} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="requested-time" className="text-sm font-medium">
          Giờ khách yêu cầu
        </label>
        <input
          id="requested-time"
          type="text"
          placeholder="2026-07-31T12:00:00+07:00"
          className={fieldClass}
          value={draft.requestedTime}
          onChange={(event) => update("requestedTime", event.target.value)}
          aria-invalid={Boolean(errors.requestedTime)}
          aria-describedby={describedBy("requestedTime", errors)}
        />
        <FieldError id="requestedTime-error" error={errors.requestedTime} />
      </div>

      <fieldset
        className="space-y-2 rounded-lg border border-gray-200 p-3"
        aria-describedby={describedBy("serviceIds", errors)}
      >
        <legend className="px-1 text-sm font-medium">
          Một hoặc nhiều dịch vụ
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {services.map((service) => (
            <label
              key={service.id}
              className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                name="services"
                value={service.id}
                checked={draft.serviceIds.includes(service.id)}
                onChange={(event) =>
                  toggleService(service.id, event.target.checked)
                }
                className="mt-0.5"
              />
              <span className="text-sm">
                {service.name}
                <span className="block text-xs text-muted-foreground">
                  {service.durationMinutes} phút
                </span>
              </span>
            </label>
          ))}
        </div>
        <FieldError id="serviceIds-error" error={errors.serviceIds} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="order-type" className="text-sm font-medium">
            Loại đơn
          </label>
          <select
            id="order-type"
            className={fieldClass}
            value={draft.orderType}
            onChange={(event) =>
              update(
                "orderType",
                event.target.value as OrderDraft["orderType"],
              )
            }
            aria-invalid={Boolean(errors.orderType)}
            aria-describedby={describedBy("orderType", errors)}
          >
            <option value="">Chọn loại đơn</option>
            <option value="NEW_TOUR">Tour mới</option>
            <option value="REFILL">Đơn dặm</option>
          </select>
          <FieldError id="orderType-error" error={errors.orderType} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="order-urgency" className="text-sm font-medium">
            Mức độ
          </label>
          <select
            id="order-urgency"
            className={fieldClass}
            value={draft.urgency}
            onChange={(event) =>
              update("urgency", event.target.value as OrderDraft["urgency"])
            }
            aria-invalid={Boolean(errors.urgency)}
            aria-describedby={describedBy("urgency", errors)}
          >
            <option value="">Chọn mức độ</option>
            <option value="PREBOOKED">Đặt trước</option>
            <option value="IMMEDIATE">Qua liền</option>
          </select>
          <FieldError id="urgency-error" error={errors.urgency} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="order-notes" className="text-sm font-medium">
          Ghi chú
        </label>
        <textarea
          id="order-notes"
          className={`${fieldClass} min-h-20 py-2`}
          value={draft.notes}
          onChange={(event) => update("notes", event.target.value)}
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Đang tìm nhân viên..." : "Tìm nhân viên"}
      </Button>
    </form>
  );
}
