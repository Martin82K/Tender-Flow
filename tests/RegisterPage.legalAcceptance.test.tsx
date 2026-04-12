import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from "@/shared/legal/legalDocumentVersions";
import { RegisterPage } from "@/features/auth/ui/RegisterPage";

const mockState = vi.hoisted(() => ({
  register: vi.fn(),
  loginAsDemo: vi.fn(),
  navigate: vi.fn(),
  getAppSettings: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    register: mockState.register,
    loginAsDemo: mockState.loginAsDemo,
  }),
}));

vi.mock("@/features/public/ui/PublicLayout", () => ({
  PublicLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/features/public/ui/PublicHeader", () => ({
  PublicHeader: () => <div>header</div>,
}));

vi.mock("@/features/auth/ui/AuthCard", () => ({
  AuthCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/shared/routing/router", () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  navigate: mockState.navigate,
  useLocation: () => ({ pathname: "/register", search: "" }),
}));

vi.mock("@/services/authService", () => ({
  authService: {
    getAppSettings: mockState.getAppSettings,
  },
}));

describe("RegisterPage legal acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.getAppSettings.mockResolvedValue({
      allowPublicRegistration: true,
      allowedDomains: [],
      requireEmailWhitelist: false,
    });
  });

  it("bez potvrzení podmínek registraci nepustí", async () => {
    render(<RegisterPage />);

    fireEvent.change(screen.getByPlaceholderText("Jméno a Příjmení"), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Heslo"), {
      target: { value: "tajne-heslo" },
    });
    fireEvent.change(screen.getByPlaceholderText("Potvrzení hesla"), {
      target: { value: "tajne-heslo" },
    });

    fireEvent.submit(screen.getByRole("button", { name: "Vytvořit účet" }).closest("form")!);

    expect(
      await screen.findByText(/musíš potvrdit podmínky používání i zásady ochrany osobních údajů/i),
    ).toBeInTheDocument();
    expect(mockState.register).not.toHaveBeenCalled();
  });

  it("po potvrzení obou checkboxů pošle aktuální verze dokumentů do registrace", async () => {
    mockState.register.mockResolvedValue(undefined);

    render(<RegisterPage />);

    fireEvent.change(screen.getByPlaceholderText("Jméno a Příjmení"), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Heslo"), {
      target: { value: "tajne-heslo" },
    });
    fireEvent.change(screen.getByPlaceholderText("Potvrzení hesla"), {
      target: { value: "tajne-heslo" },
    });

    fireEvent.click(screen.getByLabelText(/souhlasím s podmínkami používání/i));
    fireEvent.click(screen.getByLabelText(/potvrzuji seznámení se zásadami ochrany osobních údajů/i));
    fireEvent.click(screen.getByRole("button", { name: "Vytvořit účet" }));

    await waitFor(() => {
      expect(mockState.register).toHaveBeenCalledWith(
        "Test User",
        "test@example.com",
        "tajne-heslo",
        {
          termsVersion: CURRENT_TERMS_VERSION,
          privacyVersion: CURRENT_PRIVACY_VERSION,
        },
      );
    });
    expect(mockState.navigate).toHaveBeenCalledWith("/app", { replace: true });
  });
});
