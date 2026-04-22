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
    user: null,
    isAuthenticated: false,
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

describe("FeatureProvider — relogin-after-logout race", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.current = {
      user: null,
      isAuthenticated: false,
      isLoading: false,
    };
  });

  it("po odhlášení a novém loginu drží isLoading=true, dokud neproběhne fresh fetch (aby desktop plan blocker nevystřelil)", async () => {
    mocks.getEnabledFeaturesV2.mockResolvedValue([
      { key: "module_command_center", name: "CC", description: null, category: null },
    ]);
    let resolveSecondTier: ((value: { tier: string }) => void) | undefined;
    mocks.getEffectiveUserTier.mockImplementationOnce(async () => ({ tier: "pro" }));
    mocks.getEffectiveUserTier.mockImplementationOnce(
      () =>
        new Promise<{ tier: string }>((resolve) => {
          resolveSecondTier = resolve;
        }),
    );

    // 1) Startujeme přihlášeného uživatele A → fetch se dokončí s tier=pro
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

    const { rerender } = render(
      <FeatureProvider>
        <Probe />
      </FeatureProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("plan").textContent).toBe("pro");
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    // 2) Uživatel se odhlásí — FeatureContext vyčistí stav
    act(() => {
      authState.current = { user: null, isAuthenticated: false, isLoading: false };
    });
    rerender(
      <FeatureProvider>
        <Probe />
      </FeatureProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("plan").textContent).toBe("free");
    });

    // 3) Okamžité nové přihlášení ve stejné session (jiný userId)
    //    Před opravou: isLoading=false a currentPlan='free' způsobilo, že
    //    desktop plan blocker stihl vyhodnotit stale state a přesměrovat na
    //    /app/settings?subTab=subscription ještě před dokončením nového fetche.
    //    Po opravě: isLoading musí být true, dokud se fresh fetch pro nového
    //    uživatele nedokončí.
    act(() => {
      authState.current = {
        user: {
          id: "user-B",
          name: "User B",
          email: "b@example.com",
          role: "user",
          preferences: {},
        },
        isAuthenticated: true,
        isLoading: false,
      };
    });
    rerender(
      <FeatureProvider>
        <Probe />
      </FeatureProvider>,
    );

    // Klíčová pojistka — během čekání na fresh fetch je isLoading=true
    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("true");
    });

    // 4) Dokončení druhého fetche nastaví skutečný tier
    await act(async () => {
      resolveSecondTier?.({ tier: "pro" });
    });

    await waitFor(() => {
      expect(screen.getByTestId("plan").textContent).toBe("pro");
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
  });

  it("login po prvním startu aplikace (bez předchozí session) drží isLoading=true až do dokončení fetche", async () => {
    let resolveTier: ((value: { tier: string }) => void) | undefined;
    mocks.getEffectiveUserTier.mockImplementation(
      () =>
        new Promise<{ tier: string }>((resolve) => {
          resolveTier = resolve;
        }),
    );
    mocks.getEnabledFeaturesV2.mockResolvedValue([
      { key: "module_command_center", name: "CC", description: null, category: null },
    ]);

    // Start: uživatel nepřihlášen
    const { rerender } = render(
      <FeatureProvider>
        <Probe />
      </FeatureProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
      expect(screen.getByTestId("plan").textContent).toBe("free");
    });

    // Login
    act(() => {
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
    rerender(
      <FeatureProvider>
        <Probe />
      </FeatureProvider>,
    );

    // Musí flipnout na loading=true, dokud fetch neskončí
    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("true");
    });

    await act(async () => {
      resolveTier?.({ tier: "enterprise" });
    });

    await waitFor(() => {
      expect(screen.getByTestId("plan").textContent).toBe("enterprise");
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
  });
});
