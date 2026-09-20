import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { testConsoleGuard } from "./utils/consoleGuard";
import { ResetPasswordPage } from "@/features/auth/ui/ResetPasswordPage";

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: "?auth_token_hash=signed-hash",
  verifyPasswordRecoveryToken: vi.fn(),
  hasVerifiedPasswordRecoveryToken: vi.fn(),
  updateRecoveredPassword: vi.fn(),
  confirmPasswordReset: vi.fn(),
}));
vi.mock("@features/auth/api", () => ({ authService: state }));
vi.mock("@/shared/routing/router", () => ({
  useLocation: () => ({ search: state.search }),
  navigate: state.navigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
const submit = () => {
  fireEvent.change(screen.getByPlaceholderText("Nové heslo"), { target: { value: "new-password" } });
  fireEvent.change(screen.getByPlaceholderText("Potvrzení hesla"), { target: { value: "new-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Nastavit heslo" }));
};
describe("password recovery", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.search = "?auth_token_hash=signed-hash";
    state.verifyPasswordRecoveryToken.mockResolvedValue(undefined);
    state.hasVerifiedPasswordRecoveryToken.mockResolvedValue(false);
    state.updateRecoveredPassword.mockResolvedValue(undefined);
    state.confirmPasswordReset.mockResolvedValue(undefined);
  });
  it("verifies the Auth recovery token before updating the password", async () => {
    render(<ResetPasswordPage />);
    expect(state.verifyPasswordRecoveryToken).not.toHaveBeenCalled();
    submit();
    expect(await screen.findByText("Heslo změněno!")).toBeInTheDocument();
    expect(state.verifyPasswordRecoveryToken).toHaveBeenCalledWith("signed-hash");
    expect(state.updateRecoveredPassword).toHaveBeenCalledWith("new-password", "signed-hash");
    expect(state.verifyPasswordRecoveryToken.mock.invocationCallOrder[0]).toBeLessThan(state.updateRecoveredPassword.mock.invocationCallOrder[0]);
    expect(state.confirmPasswordReset).not.toHaveBeenCalled();
  });
  it("continues to the app after Auth recovery and retains legacy login navigation", async () => {
    render(<ResetPasswordPage />); submit();
    await screen.findByText("Heslo změněno!");
    fireEvent.click(screen.getByRole("button", { name: "Pokračovat do aplikace" }));
    expect(state.navigate).toHaveBeenCalledWith("/app/projects?status=all");
  });
  it("does not update a password when verification fails", async () => {
    testConsoleGuard.expect("error", "Reset confirmation error: Error: Invalid token");
    state.verifyPasswordRecoveryToken.mockRejectedValue(new Error("Invalid token"));
    render(<ResetPasswordPage />);
    submit();
    expect(await screen.findByText(/Nastavení hesla se nezdařilo/)).toBeInTheDocument();
    expect(state.updateRecoveredPassword).not.toHaveBeenCalled();
  });
  it("retries a failed password update without consuming the token again", async () => {
    testConsoleGuard.expect("error", "Reset confirmation error: Error: Network error");
    state.updateRecoveredPassword.mockRejectedValueOnce(new Error("Network error"));
    render(<ResetPasswordPage />);
    submit();
    await screen.findByText(/Nastavení hesla se nezdařilo/);
    state.hasVerifiedPasswordRecoveryToken.mockResolvedValue(true);
    submit();
    await screen.findByText("Heslo změněno!");
    expect(state.verifyPasswordRecoveryToken).toHaveBeenCalledTimes(1);
    expect(state.updateRecoveredPassword).toHaveBeenCalledTimes(2);
  });
  it("resumes verified recovery after a remount without reusing its consumed token", async () => {
    testConsoleGuard.expect("error", "Reset confirmation error: Error: Network error");
    state.updateRecoveredPassword.mockRejectedValueOnce(new Error("Network error"));
    const first = render(<ResetPasswordPage />);
    submit();
    await screen.findByText(/Nastavení hesla se nezdařilo/);
    first.unmount();
    state.hasVerifiedPasswordRecoveryToken.mockResolvedValue(true);
    state.verifyPasswordRecoveryToken.mockRejectedValue(new Error("Token already consumed"));
    render(<ResetPasswordPage />);
    submit();
    await screen.findByText("Heslo změněno!");
    expect(state.verifyPasswordRecoveryToken).toHaveBeenCalledTimes(1);
  });
  it("rejects retry when another tab changed the recovery identity", async () => {
    testConsoleGuard.expect("error", "Reset confirmation error: Error: Network error");
    testConsoleGuard.expect("error", "Reset confirmation error: Error: Recovery identity changed");
    state.updateRecoveredPassword.mockRejectedValueOnce(new Error("Network error"));
    render(<ResetPasswordPage />); submit();
    await screen.findByText(/Nastavení hesla se nezdařilo/);
    state.hasVerifiedPasswordRecoveryToken.mockResolvedValue(false);
    state.verifyPasswordRecoveryToken.mockRejectedValue(new Error("Recovery identity changed"));
    submit();
    await waitFor(() => expect(state.verifyPasswordRecoveryToken).toHaveBeenCalledTimes(2));
    expect(state.updateRecoveredPassword).toHaveBeenCalledTimes(1);
  });
  it("preserves legacy password reset links", async () => {
    state.search = "?token=legacy-token";
    render(<ResetPasswordPage />);
    submit();
    await screen.findByText("Heslo změněno!");
    expect(state.confirmPasswordReset).toHaveBeenCalledWith("legacy-token", "new-password");
    expect(state.verifyPasswordRecoveryToken).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Přejít na přihlášení" }));
    expect(state.navigate).toHaveBeenCalledWith("/login");
  });
  it("disables submission for a missing token", async () => {
    state.search = "";
    render(<ResetPasswordPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Nastavit heslo" })).toBeDisabled());
    expect(state.updateRecoveredPassword).not.toHaveBeenCalled();
  });
});
