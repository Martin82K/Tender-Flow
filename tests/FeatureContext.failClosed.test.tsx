import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionRequiredView } from "@app/views/SubscriptionRequiredView";
import { FeatureProvider, useFeatures } from "../context/FeatureContext";

const mocks = vi.hoisted(() => ({
  getEffectiveUserTier: vi.fn(),
  getEnabledFeaturesV2: vi.fn(),
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
  getEffectiveUserTier: mocks.getEffectiveUserTier,
  getEnabledFeaturesV2: mocks.getEnabledFeaturesV2,
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

const RecoveryProbe = () => {
  const { refetchFeatures, verificationError } = useFeatures();
  return <SubscriptionRequiredView onRefresh={refetchFeatures} onLogout={async () => {}} verificationError={verificationError} />;
};

describe("FeatureProvider fail-closed behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEffectiveUserTier.mockRejectedValue({ code: "PGRST202" });
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
  it("reports a failed manual verification without claiming it completed successfully", async () => {
    mocks.getEnabledFeatures.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("Network unavailable"));
    mocks.getCurrentTier.mockResolvedValue("free");
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<FeatureProvider><RecoveryProbe /></FeatureProvider>);
    await waitFor(() => expect(mocks.getEnabledFeatures).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Znovu ověřit předplatné" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Předplatné se nepodařilo ověřit"));
    expect(screen.getByRole("status")).not.toHaveTextContent("Ověření dokončeno");
  });

});
