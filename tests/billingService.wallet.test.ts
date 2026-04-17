import { describe, expect, it, vi, beforeEach } from "vitest";
import { billingService } from "../services/billingService";
import { invokeAuthedFunction } from "../services/functionsClient";

vi.mock("../services/functionsClient", () => ({
  invokeAuthedFunction: vi.fn(),
}));

describe("billingService (GoPay + error mapping)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps GoPay config errors to user-friendly checkout message", async () => {
    vi.mocked(invokeAuthedFunction).mockRejectedValueOnce(
      new Error("GoPay not configured (missing GOPAY_GOID)"),
    );

    const result = await billingService.createCheckoutSession({
      tier: "starter",
      successUrl: "http://localhost:3000/app/settings?ok=true",
      cancelUrl: "http://localhost:3000/app/settings?cancel=true",
      billingPeriod: "monthly",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("není správně nakonfigurovaná");
  });

  it("calls gopay-create-payment edge function", async () => {
    vi.mocked(invokeAuthedFunction).mockResolvedValueOnce({
      success: true,
      paymentUrl: "https://gw.sandbox.gopay.com/gw/pay-gate?id=123",
      paymentId: "123",
    });

    const result = await billingService.createCheckoutSession({
      tier: "pro",
      successUrl: "http://localhost:3000/app/settings?ok=true",
      cancelUrl: "http://localhost:3000/app/settings?cancel=true",
      billingPeriod: "yearly",
    });

    expect(invokeAuthedFunction).toHaveBeenCalledWith(
      "gopay-create-payment",
      expect.objectContaining({
        body: expect.objectContaining({
          tier: "pro",
          billingPeriod: "yearly",
        }),
      }),
    );
    expect(result.success).toBe(true);
    expect(result.checkoutUrl).toBe("https://gw.sandbox.gopay.com/gw/pay-gate?id=123");
  });

  it("calls gopay-cancel-subscription edge function", async () => {
    vi.mocked(invokeAuthedFunction).mockResolvedValueOnce({
      success: true,
      message: "Předplatné bude zrušeno na konci aktuálního období.",
    });

    const result = await billingService.cancelRecurrence();

    expect(invokeAuthedFunction).toHaveBeenCalledWith(
      "gopay-cancel-subscription",
      expect.objectContaining({ body: {} }),
    );
    expect(result.success).toBe(true);
  });

  it("calls gopay-sync-subscription edge function", async () => {
    vi.mocked(invokeAuthedFunction).mockResolvedValueOnce({
      success: true,
      message: "Předplatné synchronizováno.",
      subscription: {
        id: "12345",
        tier: "pro",
        status: "active",
        expiresAt: "2026-05-12T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      },
    });

    const result = await billingService.syncSubscription();

    expect(invokeAuthedFunction).toHaveBeenCalledWith(
      "gopay-sync-subscription",
      expect.objectContaining({ body: {} }),
    );
    expect(result.success).toBe(true);
    expect(result.subscription?.tier).toBe("pro");
  });

  it("maps OAuth token errors to user-friendly message", async () => {
    vi.mocked(invokeAuthedFunction).mockRejectedValueOnce(
      new Error("GoPay OAuth2 failed (401): invalid credentials"),
    );

    const result = await billingService.createCheckoutSession({
      tier: "starter",
      successUrl: "http://localhost:3000/app/settings?ok=true",
      cancelUrl: "http://localhost:3000/app/settings?cancel=true",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("platební brány");
  });
});
