import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "@features/auth/ui/LoginPage";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  microsoftAvailable: vi.fn(),
  microsoftLogin: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    login: mocks.login,
    loginWithBiometric: vi.fn(),
    canUseBiometric: false,
    hasSavedCredentials: false,
  }),
}));

vi.mock("@/shared/routing/router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  navigate: mocks.navigate,
  useLocation: () => ({ search: "?next=%2Fapp%2Fprojects" }),
}));

vi.mock("@features/auth/api", () => ({
  isDesktop: false,
  platformAdapter: { platform: { os: "web" } },
}));

vi.mock("@/infra/auth/microsoftAccountService", () => ({
  microsoftLoginService: {
    isAvailable: mocks.microsoftAvailable,
    login: mocks.microsoftLogin,
  },
}));

describe("LoginPage Microsoft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.microsoftAvailable.mockResolvedValue(true);
    mocks.microsoftLogin.mockResolvedValue(undefined);
  });

  it("nabídne Microsoft přihlášení jen po bezpečné aktivaci poskytovatele", async () => {
    render(<LoginPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Přihlásit přes Microsoft" }));
    await waitFor(() => expect(mocks.microsoftLogin).toHaveBeenCalledWith("/app/projects"));
  });

  it("nezobrazí tlačítko, pokud Microsoft přihlášení není připravené", async () => {
    mocks.microsoftAvailable.mockResolvedValue(false);
    render(<LoginPage />);

    await waitFor(() => expect(mocks.microsoftAvailable).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Přihlásit přes Microsoft" })).not.toBeInTheDocument();
  });
});
