export type OwnerDispatchTour = {
  id: string;
  customerName: string;
  customerPhone: string | null;
  requestedAt: string;
  orderType: string;
  urgency: string;
  status: string;
  notes: string;
  location: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  services: Array<{ id: string; name: string; durationMinutes: number }>;
  assignments: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    startsAt: string;
    endsAt: string;
    status: string;
    isOverride: boolean;
    overrideReason: string | null;
  }>;
  orderVersion: string;
};

export type OwnerDispatchBranch = {
  id: string;
  branchId: "CS1" | "CS2";
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};
