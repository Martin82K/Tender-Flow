import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../context/AuthContext";

const mockState = vi.hoisted(() => ({
  updateUserPreferences: vi.fn(),
  getCurrentUser: vi.fn(),
  getUserFromSession: vi.fn(),
  navigate: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("../services/authService", () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateUserPreferences: mockState.updateUserPreferences,
    getCurrentUser: mockState.getCurrentUser,
    getUserFromSession: mockState.getUserFromSession,
  },
}));

vi.mock("../services/demoData", () => ({
  isDemoSession: vi.fn().mockReturnValue(false),
  DEMO_USER: null,
  endDemoSession: vi.fn(),
  startDemoSession: vi.fn(),
}));

vi.mock("../services/platformAdapter", () => ({
  isDesktop: false,
  platformAdapter: {
    biometric: {
      isAvailable: vi.fn(),
      prompt: vi.fn(),
    },
    session: {
      isBiometricEnabled: vi.fn(),
      getCredentials: vi.fn(),
      clearCredentials: vi.fn(),
      saveCredentials: vi.fn(),
      setBiometricEnabled: vi.fn(),
    },
  },
}));

vi.mock("../services/supabase", () => ({
  clearStoredSessionData: vi.fn(),
  getStoredAuthSessionRaw: vi.fn().mockReturnValue(null),
  setRememberMePreference: vi.fn(),
  supabase: {
    auth: {
      onAuthStateChange: vi.fn().mockReturnValue({
        data: {
          subscription: {
            unsubscribe: mockState.unsubscribe,
          },
        },
      }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      refreshSession: vi.fn(),
    },
  },
}));

vi.mock("../shared/routing/router", () => ({
  navigate: mockState.navigate,
}));

const QueueHarness: React.FC = () => {
  const { updatePreferences, user, isLoading } = useAuth();

  return (
    <div>
      <button
        onClick={() => {
          void updatePreferences({ autoShortenProjectDocs: true });
          void updatePreferences({ theme: "dark" });
        }}
      >
        Spustit
      </button>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="theme">{user?.preferences?.theme ?? "none"}</div>
      <div data-testid="shorten">
        {String(user?.preferences?.autoShortenProjectDocs ?? false)}
      </div>
    </div>
  );
};

describe("AuthContext preferences queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.getCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      role: "user",
      subscriptionTier: "free",
      preferences: {
        theme: "system",
        primaryColor: "#607AFB",
        backgroundColor: "#f5f6f8",
        autoShortenProjectDocs: false,
      },
    });
    mockState.getUserFromSession.mockResolvedValue(null);
  });

  it("serializes preference updates so second request starts after first finishes", async () => {
    let resolveFirstUpdate: ((value: any) => void) | null = null;
    const firstUpdatePromise = new Promise((resolve) => {
      resolveFirstUpdate = resolve;
    });

    mockState.updateUserPreferences
      .mockImplementationOnce(() => firstUpdatePromise)
      .mockResolvedValueOnce({
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        role: "user",
        subscriptionTier: "free",
        preferences: {
          theme: "dark",
          primaryColor: "#607AFB",
          backgroundColor: "#f5f6f8",
          autoShortenProjectDocs: true,
        },
      });

    render(
      <AuthProvider>
        <QueueHarness />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    fireEvent.click(screen.getByText("Spustit"));

    await waitFor(() => {
      expect(mockState.updateUserPreferences).toHaveBeenCalledTimes(1);
    });

    expect(mockState.updateUserPreferences).toHaveBeenNthCalledWith(1, {
      autoShortenProjectDocs: true,
    });

    await act(async () => {
      resolveFirstUpdate?.({
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        role: "user",
        subscriptionTier: "free",
        preferences: {
          theme: "system",
          primaryColor: "#607AFB",
          backgroundColor: "#f5f6f8",
          autoShortenProjectDocs: true,
        },
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockState.updateUserPreferences).toHaveBeenCalledTimes(2);
    });
    expect(mockState.updateUserPreferences).toHaveBeenNthCalledWith(2, {
      theme: "dark",
    });

    await waitFor(() => {
      expect(screen.getByTestId("theme").textContent).toBe("dark");
      expect(screen.getByTestId("shorten").textContent).toBe("true");
    });
  });
});
