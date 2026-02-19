import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGate } from "@/app/views/AuthGate";

const mockState = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock("@/shared/routing/router", () => ({
  navigate: mockState.navigate,
}));

vi.mock("@/components/layouts/AuthLayout", () => ({
  AuthLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-layout">{children}</div>
  ),
}));

vi.mock("@/components/LandingPage", () => ({
  LandingPage: () => <div data-testid="landing-page">Landing</div>,
}));

vi.mock("@/features/auth/ui/LoginPage", () => ({
  LoginPage: () => <div data-testid="login-page">Login</div>,
}));

vi.mock("@/features/auth/ui/RegisterPage", () => ({
  RegisterPage: () => <div data-testid="register-page">Register</div>,
}));

vi.mock("@/features/auth/ui/ForgotPasswordPage", () => ({
  ForgotPasswordPage: () => <div data-testid="forgot-password-page">Forgot</div>,
}));

vi.mock("@/features/auth/ui/ResetPasswordPage", () => ({
  ResetPasswordPage: () => <div data-testid="reset-password-page">Reset</div>,
}));

describe("AuthGate navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("desktop + / přesměruje na /login a nic nevyrenderuje", async () => {
    const { container } = render(
      <AuthGate pathname="/" search="" isDesktop={true} />,
    );

    expect(container.firstChild).toBeNull();
    await waitFor(() => {
      expect(mockState.navigate).toHaveBeenCalledWith("/login", { replace: true });
    });
    expect(mockState.navigate).toHaveBeenCalledTimes(1);
  });

  it("neauth route přesměruje na /login?next=...", async () => {
    const { container } = render(
      <AuthGate pathname="/app/projects" search="?tab=overview" isDesktop={false} />,
    );

    expect(container.firstChild).toBeNull();
    await waitFor(() => {
      expect(mockState.navigate).toHaveBeenCalledWith(
        "/login?next=%2Fapp%2Fprojects%3Ftab%3Doverview",
        { replace: true },
      );
    });
    expect(mockState.navigate).toHaveBeenCalledTimes(1);
  });

  it("web + / vykreslí LandingPage bez navigace", () => {
    render(<AuthGate pathname="/" search="" isDesktop={false} />);

    expect(screen.getByTestId("landing-page")).toBeInTheDocument();
    expect(mockState.navigate).not.toHaveBeenCalled();
  });

  it("valid auth route vykreslí page bez navigace", () => {
    render(<AuthGate pathname="/login" search="" isDesktop={false} />);

    expect(screen.getByTestId("auth-layout")).toBeInTheDocument();
    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(mockState.navigate).not.toHaveBeenCalled();
  });
});
