// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import DashboardPage from "../src/app/page";
import {
  DEMO_TIME,
  mockAssignments,
  mockEmployees,
  mockLocations,
  mockOrders,
  mockServices,
} from "../src/data/mockData";
import {
  confirmOrderAssignment,
  createDispatchState,
  OrderDraft,
  suggestOrderAssignments,
} from "../src/domain/order-flow";
import { getDashboardSummary } from "../src/domain/demo-status";

afterEach(() => {
  cleanup();
});

function openCreateOrder() {
  fireEvent.click(
    screen.getByRole("button", { name: "Tạo Đơn mới" }),
  );
  return screen.getByRole("dialog", { name: "Tạo Đơn mới" });
}

function fillValidOrder(
  dialog: HTMLElement,
  requestedTime = "2026-07-31T12:00:00+07:00",
) {
  fireEvent.change(within(dialog).getByLabelText("Tên khách hàng"), {
    target: { value: "Khách tích hợp" },
  });
  fireEvent.change(within(dialog).getByLabelText("Khu vực / địa điểm"), {
    target: { value: "loc_cs2_center" },
  });
  const match = requestedTime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (match) {
    fireEvent.change(within(dialog).getByLabelText("Ngày khách yêu cầu"), {
      target: { value: match[1] },
    });
    fireEvent.change(within(dialog).getByLabelText("Giờ"), {
      target: { value: match[2] },
    });
    fireEvent.change(within(dialog).getByLabelText("Phút"), {
      target: { value: match[3] },
    });
  }
  fireEvent.click(within(dialog).getByLabelText(/Standard/));
  fireEvent.click(within(dialog).getByLabelText(/Quick/));
  fireEvent.change(within(dialog).getByLabelText("Loại đơn"), {
    target: { value: "NEW_TOUR" },
  });
  fireEvent.change(within(dialog).getByLabelText("Mức độ"), {
    target: { value: "IMMEDIATE" },
  });
  fireEvent.change(within(dialog).getByLabelText("Ghi chú"), {
    target: { value: "Kiểm thử giao diện" },
  });
}

async function findSuggestions(dialog: HTMLElement) {
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Tìm nhân viên" }),
  );
  expect(
    within(dialog).getByRole("button", {
      name: "Đang tìm nhân viên...",
    }),
  ).toBeDefined();
  await within(dialog).findByRole("heading", {
    name: "Đề xuất nhân viên",
  });
}

describe("create-order workflow UI", () => {
  it("opens the form and displays required-field validation", async () => {
    render(<DashboardPage />);
    const dialog = openCreateOrder();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Tìm nhân viên" }),
    );

    expect(
      await within(dialog).findByText("Vui lòng nhập tên khách hàng."),
    ).toBeDefined();
    expect(
      within(dialog).getByText("Vui lòng chọn địa điểm hợp lệ."),
    ).toBeDefined();
    expect(
      within(dialog).getByText("Vui lòng chọn giờ khách yêu cầu."),
    ).toBeDefined();
    expect(
      within(dialog).getByText("Vui lòng chọn ít nhất một dịch vụ."),
    ).toBeDefined();
    expect(
      within(dialog).getByText("Vui lòng chọn loại đơn."),
    ).toBeDefined();
    expect(
      within(dialog).getByText("Vui lòng chọn mức độ."),
    ).toBeDefined();
  });

  it("cancels pending calculation when the dialog closes", async () => {
    render(<DashboardPage />);
    const dialog = openCreateOrder();
    fillValidOrder(dialog);
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Tìm nhân viên" }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));

    await new Promise((resolve) => window.setTimeout(resolve, 75));
    const reopenedDialog = openCreateOrder();

    expect(
      (within(reopenedDialog).getByLabelText(
        "Tên khách hàng",
      ) as HTMLInputElement).value,
    ).toBe("");
    expect(
      within(reopenedDialog).queryByRole("heading", {
        name: "Đề xuất nhân viên",
      }),
    ).toBeNull();
  });

  it("selects multiple services and renders engine-backed ranked suggestions", async () => {
    render(<DashboardPage />);
    const dialog = openCreateOrder();
    fillValidOrder(dialog);

    expect(
      (within(dialog).getByLabelText(/Standard/) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (within(dialog).getByLabelText(/Quick/) as HTMLInputElement).checked,
    ).toBe(true);

    await findSuggestions(dialog);

    const employeeRadios = within(dialog).getAllByRole("radio", {
      name: /#\d+ ·/,
    });
    expect(employeeRadios.length).toBeGreaterThan(0);
    expect(employeeRadios.length).toBeLessThanOrEqual(3);
    expect(within(dialog).getByText("Đề xuất tốt nhất")).toBeDefined();
    expect(within(dialog).getAllByText("Lý do").length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText("Cảnh báo").length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText("Starting score: 100.").length).toBe(
      employeeRadios.length,
    );

    const confirmButton = within(dialog).getByRole("button", {
      name: "Xác nhận giao Đơn",
    }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);
    expect(
      within(dialog).getByText(
        "Chọn một nhân viên để xem tóm tắt và xác nhận.",
      ),
    ).toBeDefined();
  });

  it("requires explicit selection and confirmation before adding the assignment", async () => {
    render(<DashboardPage />);
    const dialog = openCreateOrder();
    fillValidOrder(dialog);
    await findSuggestions(dialog);

    expect(
      document.querySelector("#assignment-block-assignment_demo_19"),
    ).toBeNull();

    const firstEmployee = within(dialog).getAllByRole("radio", {
      name: /#\d+ ·/,
    })[0];
    fireEvent.click(firstEmployee);

    const confirmButton = within(dialog).getByRole("button", {
      name: "Xác nhận giao Đơn",
    }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(false);
    expect(within(dialog).getByText("Khách tích hợp")).toBeDefined();

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Tạo Đơn mới" })).toBeNull();
    });
    expect(
      screen.getByText(/Đã giao đơn order_demo_19 cho/),
    ).toBeDefined();
    expect(
      document.querySelector("#assignment-block-assignment_demo_19"),
    ).not.toBeNull();
  });

  it("opens the confirmed assignment detail and recalculates summary cards", async () => {
    render(<DashboardPage />);
    const dialog = openCreateOrder();
    fillValidOrder(dialog);
    await findSuggestions(dialog);
    fireEvent.click(
      within(dialog).getAllByRole("radio", { name: /#\d+ ·/ })[0],
    );
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Xác nhận giao Đơn",
      }),
    );

    const block = await waitFor(() => {
      const assignmentBlock = document.querySelector(
        "#assignment-block-assignment_demo_19",
      );
      expect(assignmentBlock).not.toBeNull();
      return assignmentBlock as HTMLButtonElement;
    });
    fireEvent.click(block);

    const detailDialog = await screen.findByRole("dialog", {
      name: "Chi tiết đơn hàng",
    });
    expect(within(detailDialog).getByText("Khách tích hợp")).toBeDefined();
    expect(within(detailDialog).getByText("Standard, Quick")).toBeDefined();
    expect(within(detailDialog).getByText("90 phút")).toBeDefined();

    const state = createDispatchState(mockOrders, mockAssignments);
    const draft: OrderDraft = {
      customerName: "Khách tích hợp",
      locationId: "loc_cs2_center",
      requestedTime: "2026-07-31T12:00:00+07:00",
      serviceIds: ["s_standard", "s_quick"],
      orderType: "NEW_TOUR",
      urgency: "IMMEDIATE",
      notes: "Kiểm thử giao diện",
    };
    const suggestions = suggestOrderAssignments({
      draft,
      state,
      employees: mockEmployees,
      services: mockServices,
      locations: mockLocations,
      currentTime: DEMO_TIME,
    });
    expect(suggestions.ok).toBe(true);
    if (!suggestions.ok || suggestions.suggestions.length === 0) {
      throw new Error("Expected suggestions.");
    }
    const confirmed = confirmOrderAssignment({
      confirmed: true,
      order: suggestions.order,
      selectedEmployeeId: suggestions.suggestions[0].employeeId,
      state,
      employees: mockEmployees,
      services: mockServices,
      locations: mockLocations,
      currentTime: DEMO_TIME,
    });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) {
      throw new Error("Expected confirmation.");
    }
    const expectedSummary = getDashboardSummary(
      mockEmployees,
      confirmed.state.assignments,
      confirmed.state.orders,
      DEMO_TIME,
    );

    expect(
      document.querySelector("#card-working span")?.textContent,
    ).toBe(String(expectedSummary.workingCount));
    expect(
      document.querySelector("#card-available span")?.textContent,
    ).toBe(String(expectedSummary.availableCount));
    expect(
      document.querySelector("#card-unassigned span")?.textContent,
    ).toBe(String(expectedSummary.unassignedOrderCount));
  });

  it("shows the no-eligible state and creates no assignment", async () => {
    render(<DashboardPage />);
    const dialog = openCreateOrder();
    fillValidOrder(dialog, "2026-07-31T23:00:00+07:00");

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Tìm nhân viên" }),
    );

    expect(
      await within(dialog).findByText(
        "Không tìm thấy nhân viên phù hợp với thời gian và điều kiện hiện tại.",
      ),
    ).toBeDefined();
    expect(
      within(dialog).getByText(
        "Hãy thử thay đổi giờ yêu cầu, dịch vụ, địa điểm hoặc loại đơn.",
      ),
    ).toBeDefined();
    expect(
      within(dialog).queryByRole("button", {
        name: "Xác nhận giao Đơn",
      }),
    ).toBeNull();
    expect(
      document.querySelector("#assignment-block-assignment_demo_19"),
    ).toBeNull();
  });

  it("reset restores seeded data and clears workflow messages", async () => {
    render(<DashboardPage />);
    const dialog = openCreateOrder();
    fillValidOrder(dialog);
    await findSuggestions(dialog);
    fireEvent.click(
      within(dialog).getAllByRole("radio", { name: /#\d+ ·/ })[0],
    );
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Xác nhận giao Đơn",
      }),
    );
    await screen.findByText(/Đã giao đơn order_demo_19 cho/);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Khôi phục dữ liệu demo",
      }),
    );

    expect(
      document.querySelector("#assignment-block-assignment_demo_19"),
    ).toBeNull();
    expect(
      screen.queryByText(/Đã giao đơn order_demo_19 cho/),
    ).toBeNull();
    expect(
      document.querySelectorAll('[id^="assignment-block-"]'),
    ).toHaveLength(mockAssignments.length);
  });
});

describe("order-flow UI architecture", () => {
  it("keeps scoring constants out of React components", () => {
    const componentSources = [
      "CreateOrderForm.tsx",
      "AssignmentSuggestions.tsx",
      "AssignmentConfirmation.tsx",
      "OrderFlowDialog.tsx",
    ];
    const combinedSource = componentSources
      .map((filename) =>
        readFileSync(
          join(
            process.cwd(),
            "src",
            "components",
            "order-flow",
            filename,
          ),
          "utf8",
        ),
      )
      .join("\n");

    expect(combinedSource).not.toMatch(/BASE_SCORE|distanceKm\s*\*\s*3/);
    expect(combinedSource).not.toMatch(/score\s*[+-]=/);
    expect(combinedSource).not.toContain("suggestAssignments(");
  });
});
