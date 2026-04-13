import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type SessionCredentials = { refreshToken: string; email: string } | null;

interface SetupOptions {
  isDesktop: boolean;
  credentials: SessionCredentials;
  biometricEnabled: boolean;
  biometricPromptResult?: boolean;
  refreshSessionResult?: { data: { session: any | null }; error: any | null };
  currentUser?: any;
  storedSessionRaw?: string | null;
}

const setup = async (options: SetupOptions) => {
  vi.resetModules();

  const mockState = {
    authListener: null as ((snapshot: { event: string; session: any }) => void) | null,
    getCurrentUser: vi.fn().mockResolvedValue(options.currentUser ?? null),
    getUserFromSession: vi.fn().mockResolvedValue({
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      role: "user",
      subscriptionTier: "free",
      preferences: {
        theme: "system",
        primaryColor: "#607AFB",
        backgroundColor: "#f5f6f8",
      },
    }),
    refreshSession: vi.fn().mockResolvedValue(
      options.refreshSessionResult ?? {
        data: { session: null },
        error: null,
      },
    ),
    invalidateAuthState: vi.fn().mockResolvedValue(undefined),
    navigate: vi.fn(),
    queryClientClear: vi.fn(),
    subscribe: vi.fn((listener: (snapshot: { event: string; session: any }) => void) => {
      mockState.authListener = listener;
      return vi.fn();
    }),
  };

  vi.doMock("../services/authService", () => ({
    authService: {
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
      updateUserPreferences: vi.fn(),
      getCurrentUser: mockState.getCurrentUser,
      getUserFromSession: mockState.getUserFromSession,
    },
  }));

  vi.doMock("../services/demoData", () => ({
    isDemoSession: vi.fn().mockReturnValue(false),
    DEMO_USER: null,
    endDemoSession: vi.fn(),
    startDemoSession: vi.fn(),
  }));

  vi.doMock("../services/platformAdapter", () => ({
    isDesktop: options.isDesktop,
    platformAdapter: {
      biometric: {
        isAvailable: vi.fn().mockResolvedValue(true),
        prompt: vi.fn().mockResolvedValue(options.biometricPromptResult ?? true),
      },
      session: {
        isBiometricEnabled: vi.fn().mockResolvedValue(options.biometricEnabled),
        getCredentials: vi.fn().mockResolvedValue(
          // When biometric is enabled, getCredentials returns null (must use getCredentialsWithBiometric)
          options.biometricEnabled ? null : options.credentials,
        ),
        getCredentialsWithBiometric: vi.fn().mockResolvedValue(
          options.biometricPromptResult === false ? null : options.credentials,
        ),
        clearCredentials: vi.fn().mockResolvedValue(undefined),
        saveCredentials: vi.fn().mockResolvedValue(undefined),
        setBiometricEnabled: vi.fn().mockResolvedValue(undefined),
      },
      auth: {
        setAuthenticated: vi.fn().mockResolvedValue(undefined),
      },
    },
  }));

  vi.doMock("../services/authSessionService", () => ({
    authSessionService: {
      clearStoredSessionData: vi.fn(),
      getStoredAuthSessionRaw: vi.fn().mockReturnValue(options.storedSessionRaw ?? null),
      setRememberMePreference: vi.fn(),
      refreshSession: mockState.refreshSession,
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      invalidateAuthState: mockState.invalidateAuthState,
    },
  }));

  vi.doMock("../shared/routing/router", () => ({
    navigate: mockState.navigate,
  }));

  vi.doMock("../services/queryClient", () => ({
    queryClient: {
      clear: mockState.queryClientClear,
    },
  }));

  vi.doMock("@/services/incidentLogger", () => ({
    logIncident: vi.fn(),
    setIncidentContext: vi.fn(),
  }));

  vi.doMock("@infra/auth/authSessionStore", () => ({
    authSessionStore: {
      start: vi.fn(),
      subscribe: mockState.subscribe,
      syncSession: vi.fn().mockResolvedValue(undefined),
    },
  }));

  const { AuthProvider, useAuth } = await import("../context/AuthContext");

  const Probe: React.FC = () => {
    const { isLoading, isAuthenticated, logout } = useAuth();
    return (
      <div>
        <div data-testid="loading">{String(isLoading)}</div>
        <div data-testid="authenticated">{String(isAuthenticated)}</div>
        <button type="button" onClick={() => void logout()}>
          logout
        </button>
      </div>
    );
  };

  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

  return mockState;
};

describe("AuthContext auth recovery", () => {
  it("při Invalid Refresh Token provede invalidaci a nespouští druhý refresh pokus", async () => {
    const mockState = await setup({
      isDesktop: true,
      credentials: { refreshToken: "refresh-token-123456", email: "test@example.com" },
      biometricEnabled: false,
      refreshSessionResult: {
        data: { session: null },
        error: { status: 400, message: "Invalid Refresh Token: Not Found" },
      },
      currentUser: null,
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(mockState.refreshSession).toHaveBeenCalledTimes(1);
    expect(mockState.invalidateAuthState).toHaveBeenCalledWith({
      navigateToLogin: false,
      reason: "invalid_refresh_token",
    });
  });

  it("zrušení biometriky nevede k tichému refresh loginu", async () => {
    const mockState = await setup({
      isDesktop: true,
      credentials: { refreshToken: "refresh-token-123456", email: "test@example.com" },
      biometricEnabled: true,
      biometricPromptResult: false,
      currentUser: null,
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(mockState.refreshSession).not.toHaveBeenCalled();
    expect(mockState.getCurrentUser).not.toHaveBeenCalled();
    expect(mockState.invalidateAuthState).not.toHaveBeenCalled();
    expect(screen.getByTestId("authenticated").textContent).toBe("false");
  });
  it("desktop logout clears react-query cache before navigate", async () => {
    const mockState = await setup({
      isDesktop: true,
      credentials: null,
      biometricEnabled: false,
      currentUser: null,
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    await act(async () => {
      screen.getByRole("button", { name: "logout" }).click();
    });

    await waitFor(() => {
      expect(mockState.invalidateAuthState).toHaveBeenCalledWith({
        navigateToLogin: false,
        reason: "manual_logout",
      });
    });

    expect(mockState.queryClientClear).toHaveBeenCalledTimes(1);
    expect(mockState.navigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  it("desktop restore se zkusí i při syntakticky validní uložené session", async () => {
    const mockState = await setup({
      isDesktop: true,
      credentials: { refreshToken: "refresh-token-123456", email: "test@example.com" },
      biometricEnabled: true,
      biometricPromptResult: true,
      storedSessionRaw: JSON.stringify({
        access_token: "header.payload.signature",
        refresh_token: "refresh-token-123456",
      }),
      refreshSessionResult: {
        data: { session: { access_token: "fresh-session-token" } },
        error: null,
      },
      currentUser: null,
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(mockState.refreshSession).toHaveBeenCalledTimes(1);
    expect(mockState.invalidateAuthState).not.toHaveBeenCalled();
  });

  it("SIGNED_OUT event neaktivuje retry loop", async () => {
    const mockState = await setup({
      isDesktop: false,
      credentials: null,
      biometricEnabled: false,
      currentUser: null,
    });

    await waitFor(() => {
      expect(mockState.subscribe).toHaveBeenCalledTimes(1);
    });

    act(() => {
      mockState.authListener?.({ event: "SIGNED_OUT", session: null });
    });

    await waitFor(() => {
      expect(screen.getByTestId("authenticated").textContent).toBe("false");
    });

    expect(mockState.refreshSession).not.toHaveBeenCalled();
    expect(mockState.invalidateAuthState).toHaveBeenCalledTimes(1);
    expect(mockState.invalidateAuthState).toHaveBeenCalledWith({
      navigateToLogin: false,
      reason: "invalid_refresh_token",
    });
  });
});
