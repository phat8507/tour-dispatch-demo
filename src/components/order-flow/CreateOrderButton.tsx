"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CreateOrderButtonProps {
  onClick: () => void;
}

export function CreateOrderButton({ onClick }: CreateOrderButtonProps) {
  return (
    <Button id="create-order-button" onClick={onClick} className="gap-2">
      <Plus className="h-4 w-4" />
      Tạo Đơn mới
    </Button>
  );
}
