import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SubscriptionSettings } from "../features/settings/SubscriptionSettings";

const getSubscriptionStateMock = vi.fn();
const cancelPlanMock = vi.fn();
const reactivatePlanMock = vi.fn();
const createBillingPortalSessionMock = vi.fn();
const createCheckoutSessionMock = vi.fn();
const requestPlanChangeMock = vi.fn();
const syncSubscriptionMock = vi.fn();
const isBillingConfiguredMock = vi.fn();

vi.mock("@/features/subscription/ui/WalletExpressCheckoutModal", () => ({
  WalletExpressCheckoutModal: () => null,
}));

vi.mock("@/features/subscription/api", () => ({
  cancelPlan: (...args: unknown[]) => cancelPlanMock(...args),
  createBillingPortalSession: (...args: unknown[]) =>
    createBillingPortalSessionMock(...args),
  createCheckoutSession: (...args: unknown[]) => createCheckoutSessionMock(...args),
  formatBillingPrice: (tier: string, billingCycle: "monthly" | "yearly") => {
    if (tier === "enterprise") return "Na míru";
    if (tier === "starter") {
      return billingCycle === "monthly" ? "399 Kč" : "319 Kč";
    }
    if (tier === "pro") {
      return billingCycle === "monthly" ? "499 Kč" : "399 Kč";
    }
    return "0 Kč";
  },
  formatSubscriptionExpirationDate: () => "1. 1. 2030",
  getSubscriptionState: (...args: unknown[]) => getSubscriptionStateMock(...args),
  isBillingConfigured: (...args: unknown[]) => isBillingConfiguredMock(...args),
  PRICING_CONFIG: {
    starter: {
      monthlyPrice: 39900,
      yearlyPrice: 383040,
      features: ["A", "B", "C", "D", "E", "F"],
    },
    pro: {
      monthlyPrice: 49900,
      yearlyPrice: 479000,
      features: ["A", "B", "C", "D", "E", "F"],
    },
    enterprise: {
      monthlyPrice: null,
      yearlyPrice: null,
      features: ["A", "B", "C", "D", "E", "F"],
    },
  },
  reactivatePlan: (...args: unknown[]) => reactivatePlanMock(...args),
  requestPlanChange: (...args: unknown[]) => requestPlanChangeMock(...args),
  syncSubscription: (...args: unknown[]) => syncSubscriptionMock(...args),
}));

describe("SubscriptionSettings billing flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSubscriptionStateMock.mockResolvedValue({
      tier: "free",
      effectiveTier: "free",
      status: "active",
      expiresAt: null,
      startedAt: null,
      trialEndsAt: null,
      cancelAtPeriodEnd: false,
      billingCustomerId: null,
      billingProvider: null,
      daysRemaining: null,
    });
    cancelPlanMock.mockResolvedValue({ success: true });
    reactivatePlanMock.mockResolvedValue({ success: true });
    createBillingPortalSessionMock.mockResolvedValue({ success: true });
    syncSubscriptionMock.mockResolvedValue({ success: true });
  });

  it("does not fallback to requestPlanChange when Stripe checkout fails but billing is configured", async () => {
    isBillingConfiguredMock.mockReturnValue(true);
    createCheckoutSessionMock.mockResolvedValue({
      success: false,
      error: "Platební brána není správně nakonfigurovaná.",
    });

    render(<SubscriptionSettings />);

    const starterButton = await screen.findByRole("button", {
      name: "Vybrat Starter",
    });
    fireEvent.click(starterButton);

    await waitFor(() => {
      expect(
        screen.getByText("Platební brána není správně nakonfigurovaná."),
      ).toBeInTheDocument();
    });
    expect(requestPlanChangeMock).not.toHaveBeenCalled();
  });

  it("uses requestPlanChange fallback when billing is not configured", async () => {
    isBillingConfiguredMock.mockReturnValue(false);
    requestPlanChangeMock.mockResolvedValue({ success: true });

    render(<SubscriptionSettings />);

    const starterButton = await screen.findByRole("button", {
      name: "Vybrat Starter",
    });
    fireEvent.click(starterButton);

    await waitFor(() => {
      expect(requestPlanChangeMock).toHaveBeenCalledWith("starter");
    });
    expect(
      screen.getByText(/Žádost o upgrade byla odeslána/i),
    ).toBeInTheDocument();
  });
});
