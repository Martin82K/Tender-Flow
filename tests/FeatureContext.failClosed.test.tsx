import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureProvider, useFeatures } from "../context/FeatureContext";

const mocks = vi.hoisted(() => ({
  getEnabledFeatures: vi.fn(),
  getCurrentTier: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      name: "User One",
      email: "user@example.com",
      role: "user",
      preferences: {},
    },
    isAuthenticated: true,
  }),
}));

vi.mock("@/features/subscription/api", () => ({
  getEnabledFeatures: mocks.getEnabledFeatures,
  getCurrentTier: mocks.getCurrentTier,
}));

const Probe = () => {
  const { currentPlan, refetchFeatures } = useFeatures();

  return (
    <div>
      <div data-testid="plan">{currentPlan}</div>
      <button type="button" onClick={() => void refetchFeatures()}>
        refresh
      </button>
    </div>
  );
};

describe("FeatureProvider fail-closed behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("po backend chybě shodí stale tier i feature flags na free", async () => {
    mocks.getEnabledFeatures.mockResolvedValueOnce([{ key: "module_projects" }]);
    mocks.getCurrentTier.mockResolvedValueOnce("pro");
    mocks.getEnabledFeatures.mockRejectedValueOnce(new Error("RPC unavailable"));
    mocks.getCurrentTier.mockResolvedValueOnce("pro");
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <FeatureProvider>
        <Probe />
      </FeatureProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("plan").textContent).toBe("pro");
    });

    screen.getByRole("button", { name: "refresh" }).click();

    await waitFor(() => {
      expect(screen.getByTestId("plan").textContent).toBe("free");
    });
  });
});
