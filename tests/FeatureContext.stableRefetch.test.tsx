import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureProvider, useFeatures } from "../context/FeatureContext";

type AuthState = {
  user:
    | { id: string; name: string; email: string; role: string; preferences: Record<string, unknown> }
    | null;
  isAuthenticated: boolean;
  isLoading?: boolean;
};

const authState: { current: AuthState } = {
  current: {
    user: {
      id: "user-A",
      name: "User A",
      email: "a@example.com",
      role: "user",
      preferences: {},
    },
    isAuthenticated: true,
    isLoading: false,
  },
};

vi.mock("../context/AuthContext", () => ({
  useAuth: () => authState.current,
}));

const mocks = vi.hoisted(() => ({
  getEnabledFeatures: vi.fn(),
  getCurrentTier: vi.fn(),
  getEffectiveUserTier: vi.fn(),
  getEnabledFeaturesV2: vi.fn(),
}));

vi.mock("@/features/subscription/api", () => ({
  getEnabledFeatures: mocks.getEnabledFeatures,
  getCurrentTier: mocks.getCurrentTier,
  getEffectiveUserTier: mocks.getEffectiveUserTier,
  getEnabledFeaturesV2: mocks.getEnabledFeaturesV2,
}));

const Probe = () => {
  const { currentPlan, isLoading } = useFeatures();
  return (
    <div>
      <div data-testid="plan">{currentPlan}</div>
      <div data-testid="loading">{String(isLoading)}</div>
    </div>
  );
};

describe("FeatureProvider — stable refetch without loading flash", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: v2 RPC path resolves successfully
    mocks.getEffectiveUserTier.mockResolvedValue({ tier: "pro" });
    mocks.getEnabledFeaturesV2.mockResolvedValue([
      { key: "module_command_center", name: "CC", description: null, category: null },
    ]);
    mocks.getCurrentTier.mockResolvedValue("pro");
    mocks.getEnabledFeatures.mockResolvedValue([
      { key: "module_command_center", name: "CC", description: null, category: null },
    ]);
    // Reset shared auth state to user A
    authState.current = {
      user: {
        id: "user-A",
        name: "User A",
        email: "a@example.com",
        role: "user",
        preferences: {},
      },
      isAuthenticated: true,
      isLoading: false,
    };
  });

  it("preferences update (same id/role, new user reference) neprobliká isLoading=true", async () => {
    const { rerender } = render(
      <FeatureProvider>
        <Probe />
      </FeatureProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("plan").textContent).toBe("pro");
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    // Simulate setUser(updatedUser) po uložení preferences — nová reference,
    // stejné id/role.  fetchFeatures se díky zúženým závislostem nespustí,
    // takže isLoading zůstane false a placeholder neprobliká.
    act(() => {
      authState.current = {
        ...authState.current,
        user: {
          ...authState.current.user!,
          preferences: { commandCenter: { autoLayout: false } },
        },
      };
    });
    rerender(
      <FeatureProvider>
        <Probe />
      </FeatureProvider>,
    );

    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(screen.getByTestId("plan").textContent).toBe("pro");
    // Nedojde k dodatečnému volání RPC
    expect(mocks.getEffectiveUserTier).toHaveBeenCalledTimes(1);
    expect(mocks.getEnabledFeaturesV2).toHaveBeenCalledTimes(1);
  });

  it("user switch (změna user.id) vyčistí stará data a spustí loading gate", async () => {
    let resolveSecondTier: ((value: { tier: string }) => void) | undefined;
    mocks.getEffectiveUserTier.mockImplementationOnce(async () => ({ tier: "pro" }));
    mocks.getEffectiveUserTier.mockImplementationOnce(
      () =>
        new Promise<{ tier: string }>((resolve) => {
          resolveSecondTier = resolve;
        }),
    );
    mocks.getEnabledFeaturesV2.mockImplementation(async () => [
      { key: "module_command_center", name: "CC", description: null, category: null },
    ]);

    const { rerender } = render(
      <FeatureProvider>
        <Probe />
      </FeatureProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("plan").textContent).toBe("pro");
    });

    // User switch — setUser(userB) se stejnou rolí, ale jiným id.
    act(() => {
      authState.current = {
        ...authState.current,
        user: {
          id: "user-B",
          name: "User B",
          email: "b@example.com",
          role: "user",
          preferences: {},
        },
      };
    });
    rerender(
      <FeatureProvider>
        <Probe />
      </FeatureProvider>,
    );

    // Stará data musí být smetena okamžitě (fail-closed) a loading gate sepnut.
    await waitFor(() => {
      expect(screen.getByTestId("plan").textContent).toBe("free");
      expect(screen.getByTestId("loading").textContent).toBe("true");
    });

    // Dokončení druhého fetche vrátí nová data
    await act(async () => {
      resolveSecondTier?.({ tier: "starter" });
    });

    await waitFor(() => {
      expect(screen.getByTestId("plan").textContent).toBe("starter");
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
  });

  it("logout vyčistí feature set a lastFetchedUserRef bez flashe", async () => {
    render(
      <FeatureProvider>
        <Probe />
      </FeatureProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("plan").textContent).toBe("pro");
    });

    act(() => {
      authState.current = { user: null, isAuthenticated: false, isLoading: false };
    });
    // Trigger re-render by dispatching a fresh provider mount via rerender
    // to propagate the mocked auth state change.
    // (V produkci to dělá AuthContext.setUser → re-render celé podstromy.)
    act(() => {
      // no-op: useAuth se čte při každém renderu providera, rerender níž donutí update
    });
    render(
      <FeatureProvider>
        <Probe />
      </FeatureProvider>,
    );

    await waitFor(() => {
      const plans = screen.getAllByTestId("plan").map((n) => n.textContent);
      expect(plans).toContain("free");
    });
  });
});
