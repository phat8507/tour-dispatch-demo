/**
 * @vitest-environment jsdom
 */
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import LoginPage from "../src/app/login/page";

describe("LoginPage", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders without error and does not show invalid message by default", async () => {
    const searchParams = Promise.resolve({});
    const jsx = await LoginPage({ searchParams });
    render(jsx);

    expect(screen.getByRole("heading", { name: /đăng nhập/i })).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows invalid message when error=invalid", async () => {
    const searchParams = Promise.resolve({ error: "invalid" });
    const jsx = await LoginPage({ searchParams });
    render(jsx);

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText(/không hợp lệ/i)).toBeDefined();
  });

  it("contains username and password fields", async () => {
    const searchParams = Promise.resolve({});
    const jsx = await LoginPage({ searchParams });
    render(jsx);

    expect(screen.getByLabelText(/tên đăng nhập/i)).toBeDefined();
    expect(screen.getByLabelText(/mật khẩu/i)).toBeDefined();
  });
});
