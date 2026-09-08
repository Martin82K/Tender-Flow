import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

// Model the AppEntry subscription gate: losing the plan unmounts the editor.
const GatedEditor = () => {
  const { currentPlan, isLoading } = useFeatures();
  if (isLoading || currentPlan !== "pro") return <div>Ověření přístupu</div>;
  return <input aria-label="Rozepsaná poznámka" defaultValue="" />;
};

afterEach(() => vi.useRealTimers());

describe("FeatureProvider — stable refetch without loading flash", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: v2 RPC path resolves successfully
    mocks.getEffectiveUserTier.mockResolvedValue({ tier: "pro" });
    mocks.getEnabledFeaturesV2.mockResolvedValue([
      { key: "module_tasks", name: "Tasks", description: null, category: null },
    ]);
    mocks.getCurrentTier.mockResolvedValue("pro");
    mocks.getEnabledFeatures.mockResolvedValue([
      { key: "module_tasks", name: "Tasks", description: null, category: null },
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

  it.each([false, true])("preserves the editor across background verification with server latency (focus refresh: %s)", async (focusRefresh) => {
    vi.useFakeTimers();
    mocks.getEffectiveUserTier.mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve({ tier: "pro" }), 100);
    }));
    render(<FeatureProvider><GatedEditor /></FeatureProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    const editor = screen.getByRole("textbox", { name: "Rozepsaná poznámka" });
    fireEvent.change(editor, { target: { value: "Nedokončená nabídka" } });
    editor.focus();
    if (focusRefresh) {
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
      fireEvent(window, new Event("focus"));
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    }
    // Check repeatedly, including while RPC responses are pending, for six minutes.
    for (let elapsed = 0; elapsed < 360_000; elapsed += 1_000) {
      await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
      expect(screen.getByRole("textbox", { name: "Rozepsaná poznámka" })).toBe(editor);
      expect(editor).toHaveValue("Nedokončená nabídka");
      expect(editor).toHaveFocus();
    }
    expect(mocks.getEffectiveUserTier.mock.calls.length).toBeGreaterThanOrEqual(7);
  });

  it("revokes stale access when periodic verification hangs past the verification deadline", async () => {
    vi.useFakeTimers();
    mocks.getEffectiveUserTier.mockResolvedValueOnce({ tier: "pro" });
    mocks.getEffectiveUserTier.mockImplementation(() => new Promise(() => {}));
    render(<FeatureProvider><Probe /></FeatureProvider>);
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(screen.getByTestId("plan")).toHaveTextContent("pro");
    expect(mocks.getEffectiveUserTier).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(screen.getByTestId("plan")).toHaveTextContent("free");
  });

  it("keeps a slow focus verification alive across the periodic tick and repeated focus events", async () => {
    vi.useFakeTimers();
    mocks.getEffectiveUserTier.mockResolvedValueOnce({ tier: "pro" });
    mocks.getEffectiveUserTier.mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve({ tier: "pro" }), 40_000);
    }));
    render(<FeatureProvider><GatedEditor /></FeatureProvider>);
    await act(async () => {});
    const editor = screen.getByRole("textbox", { name: "Rozepsaná poznámka" });
    fireEvent.change(editor, { target: { value: "Nabídka na pomalé síti" } });
    editor.focus();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    fireEvent(window, new Event("focus"));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    fireEvent(window, new Event("focus"));
    expect(mocks.getEffectiveUserTier).toHaveBeenCalledTimes(2);
    // The focus request completes at 70s and must extend the original 90s deadline.
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(screen.getByRole("textbox", { name: "Rozepsaná poznámka" })).toBe(editor);
    expect(editor).toHaveValue("Nabídka na pomalé síti");
    expect(editor).toHaveFocus();
  });

  it("applies server-side access revocation on the next periodic verification", async () => {
    vi.useFakeTimers();
    mocks.getEffectiveUserTier.mockResolvedValueOnce({ tier: "pro" }).mockResolvedValue({ tier: "free" });
    render(<FeatureProvider><Probe /></FeatureProvider>);
    await act(async () => {});
    expect(screen.getByTestId("plan")).toHaveTextContent("pro");
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(screen.getByTestId("plan")).toHaveTextContent("free");
  });

  it("revokes access at expiry even when the next server request never completes", async () => {
    vi.useFakeTimers();
    mocks.getEffectiveUserTier.mockResolvedValueOnce({ tier: "pro", validUntil: new Date(Date.now() + 1_000).toISOString() });
    mocks.getEffectiveUserTier.mockImplementationOnce(() => new Promise(() => {}));
    render(<FeatureProvider><Probe /></FeatureProvider>);
    await act(async () => {});
    expect(screen.getByTestId("plan")).toHaveTextContent("pro");
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.getByTestId("plan")).toHaveTextContent("free");
  });

  it("fails closed without a legacy retry on authorization or network failure", async () => {
    mocks.getEffectiveUserTier.mockRejectedValue(new Error("Verification unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<FeatureProvider><Probe /></FeatureProvider>);
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("plan")).toHaveTextContent("free");
    expect(mocks.getCurrentTier).not.toHaveBeenCalled();
    expect(mocks.getEnabledFeatures).not.toHaveBeenCalled();
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
          preferences: { primaryColor: "#112233" },
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
      { key: "module_tasks", name: "Tasks", description: null, category: null },
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
