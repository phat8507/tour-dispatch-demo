"use client";

import { useEffect, useRef, useState } from "react";
import {
  AssignmentSuggestion,
  Employee,
  Location,
  Order,
  Service,
} from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DispatchState,
  OrderDraft,
  OrderDraftErrors,
  suggestOrderAssignments,
} from "@/domain/order-flow";
import { TravelTimeProvider } from "@/domain/travel-time";
import { CreateOrderButton } from "./CreateOrderButton";
import { CreateOrderForm } from "./CreateOrderForm";
import { AssignmentSuggestions } from "./AssignmentSuggestions";
import { AssignmentConfirmation } from "./AssignmentConfirmation";

const EMPTY_DRAFT: OrderDraft = {
  customerName: "",
  locationId: "",
  requestedTime: "",
  serviceIds: [],
  orderType: "",
  urgency: "",
  notes: "",
};

export interface OrderConfirmationRequest {
  order: Order;
  employeeId: string;
}

interface OrderFlowDialogProps {
  state: DispatchState;
  employees: Employee[];
  services: Service[];
  locations: Location[];
  currentTime: string;
  travelTimeProvider: TravelTimeProvider;
  onSuggest?: (draft: OrderDraft, suggestions: AssignmentSuggestion[] | null) => void;
  onConfirm: (request: OrderConfirmationRequest) => {
    ok: boolean;
    message?: string;
  };
}

export function OrderFlowDialog({
  state,
  employees,
  services,
  locations,
  currentTime,
  travelTimeProvider,
  onSuggest,
  onConfirm,
}: OrderFlowDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<OrderDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<OrderDraftErrors>({});
  const [loading, setLoading] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  const [suggestions, setSuggestions] = useState<
    AssignmentSuggestion[] | null
  >(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  );
  const [confirming, setConfirming] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(
    null,
  );
  const calculationTimerRef = useRef<number | null>(null);
  const confirmingRef = useRef(false);

  function cancelPendingCalculation() {
    if (calculationTimerRef.current !== null) {
      window.clearTimeout(calculationTimerRef.current);
      calculationTimerRef.current = null;
    }
  }

  useEffect(
    () => () => {
      cancelPendingCalculation();
    },
    [],
  );

  useEffect(() => {
    if (onSuggest) {
      onSuggest(draft, suggestions);
    }
  }, [suggestions, draft, onSuggest]);

  function resetTransientState() {
    cancelPendingCalculation();
    confirmingRef.current = false;
    setDraft(EMPTY_DRAFT);
    setErrors({});
    setLoading(false);
    setPendingOrder(null);
    setSuggestions(null);
    setSelectedEmployeeId(null);
    setConfirming(false);
    setConfirmationError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetTransientState();
    }
  }

  function handleDraftChange(nextDraft: OrderDraft) {
    cancelPendingCalculation();
    setDraft(nextDraft);
    setErrors({});
    setLoading(false);
    setPendingOrder(null);
    setSuggestions(null);
    setSelectedEmployeeId(null);
    setConfirmationError(null);
  }

  function handleFind() {
    if (loading) {
      return;
    }

    setLoading(true);
    setConfirmationError(null);
    calculationTimerRef.current = window.setTimeout(() => {
      calculationTimerRef.current = null;
      const result = suggestOrderAssignments({
        draft,
        state,
        employees,
        services,
        locations,
        currentTime,
        travelTimeProvider,
      });

      if (!result.ok) {
        setErrors(result.errors);
        setPendingOrder(null);
        setSuggestions(null);
      } else {
        setErrors({});
        setPendingOrder(result.order);
        setSuggestions(result.suggestions);
      }
      setSelectedEmployeeId(null);
      setLoading(false);
    }, 50);
  }

  function handleConfirm() {
    if (
      !pendingOrder ||
      !selectedEmployeeId ||
      confirming ||
      confirmingRef.current
    ) {
      return;
    }

    confirmingRef.current = true;
    setConfirming(true);
    setConfirmationError(null);
    const result = onConfirm({
      order: pendingOrder,
      employeeId: selectedEmployeeId,
    });

    if (!result.ok) {
      setConfirmationError(
        result.message ??
          "Đề xuất không còn hợp lệ. Vui lòng tìm lại nhân viên.",
      );
      confirmingRef.current = false;
      setConfirming(false);
      return;
    }

    setOpen(false);
    resetTransientState();
  }

  const selectedSuggestion =
    suggestions?.find(
      (suggestion) => suggestion.employeeId === selectedEmployeeId,
    ) ?? null;

  return (
    <>
      <CreateOrderButton onClick={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tạo Đơn mới</DialogTitle>
            <DialogDescription>
              Nhập yêu cầu của khách, tìm nhân viên phù hợp và xác nhận giao
              đơn.
            </DialogDescription>
          </DialogHeader>

          <CreateOrderForm
            draft={draft}
            errors={errors}
            locations={locations}
            services={services}
            loading={loading}
            onChange={handleDraftChange}
            onFind={handleFind}
          />

          {suggestions && (
            <div className="space-y-4 border-t pt-4">
              <AssignmentSuggestions
                suggestions={suggestions}
                employees={employees}
                selectedEmployeeId={selectedEmployeeId}
                onSelect={(employeeId) => {
                  setSelectedEmployeeId(employeeId);
                  setConfirmationError(null);
                }}
              />

              {pendingOrder && suggestions.length > 0 && (
                <AssignmentConfirmation
                  order={pendingOrder}
                  suggestion={selectedSuggestion}
                  employees={employees}
                  locations={locations}
                  services={services}
                  confirming={confirming}
                  error={confirmationError}
                  onConfirm={handleConfirm}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
