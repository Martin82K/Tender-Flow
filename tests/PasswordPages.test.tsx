import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordPage } from "@features/auth/ui/ForgotPasswordPage";
import { ResetPasswordPage } from "@features/auth/ui/ResetPasswordPage";

const mocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
  navigate: vi.fn(),
  search: "",
}));

vi.mock("@features/auth/api", () => ({ authService: mocks }));
vi.mock("@/shared/routing/router", () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  navigate: mocks.navigate,
  useLocation: () => ({ search: mocks.search }),
}));

describe("password recovery pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search = "";
    mocks.requestPasswordReset.mockResolvedValue(undefined);
    mocks.confirmPasswordReset.mockResolvedValue(undefined);
  });

  it("shows the same non-enumerating confirmation and login link after requesting recovery", async () => {
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText("Váš email"), { target: { value: "test@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat odkaz" }));

    expect(await screen.findByText("Odkaz odeslán!")).toBeVisible();
    expect(screen.getByText(/Pokud účet s tímto emailem existuje/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Zpět na přihlášení" })).toHaveAttribute("href", "/login");
    expect(mocks.requestPasswordReset).toHaveBeenCalledWith("test@example.com");
  });

  it("keeps reset disabled when the recovery token is missing", () => {
    render(<ResetPasswordPage />);
    expect(screen.getByText("Neplatný odkaz (chybí token).")).toBeVisible();
    expect(screen.getByRole("button", { name: "Nastavit heslo" })).toBeDisabled();
    expect(mocks.confirmPasswordReset).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords without calling the reset service", async () => {
    mocks.search = "?token=test-token";
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText("Nové heslo"), { target: { value: "test-password" } });
    fireEvent.change(screen.getByPlaceholderText("Potvrzení hesla"), { target: { value: "other-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Nastavit heslo" }));

    expect(await screen.findByText("Hesla se neshodují.")).toBeVisible();
    expect(mocks.confirmPasswordReset).not.toHaveBeenCalled();
  });

  it("shows successful reset and returns to login", async () => {
    mocks.search = "?token=test-token";
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText("Nové heslo"), { target: { value: "test-password" } });
    fireEvent.change(screen.getByPlaceholderText("Potvrzení hesla"), { target: { value: "test-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Nastavit heslo" }));

    await waitFor(() => expect(mocks.confirmPasswordReset).toHaveBeenCalledWith("test-token", "test-password"));
    expect(await screen.findByText("Heslo změněno!")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Přejít na přihlášení" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/login");
  });
});
