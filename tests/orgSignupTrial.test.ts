import { describe, expect, it, vi, afterEach } from "vitest";
import {
  DESKTOP_DISTRIBUTION_VERSION,
  MACOS_DISTRIBUTION_VERSION,
  DESKTOP_DOWNLOADS,
  DESKTOP_RELEASES_LATEST_URL,
} from "@features/public/model/desktopDownloads";
import {
  formatTrialRemainingCopy,
  getCalendarDaysRemaining,
  getOrgPlanPresentation,
  isLiveOverride,
  TRIAL_DURATION_DAYS,
} from "@features/subscription/model/trial";

describe("desktop download URLs", () => {
  it("points Windows and Apple Silicon macOS installers at the published release tag", () => {
    expect(DESKTOP_RELEASES_LATEST_URL).toBe(
      "https://github.com/Martin82K/Tender-Flow-Releases/releases/latest",
    );
    expect(DESKTOP_DOWNLOADS.map((item) => item.id)).toEqual(["windows", "macos"]);
    expect(DESKTOP_DOWNLOADS[0].href).toBe(
      `https://github.com/Martin82K/Tender-Flow-Releases/releases/download/v${DESKTOP_DISTRIBUTION_VERSION}/Tender-Flow-Setup-${DESKTOP_DISTRIBUTION_VERSION}.exe`,
    );
    expect(DESKTOP_DOWNLOADS[1].href).toBe(
      `https://github.com/Martin82K/Tender-Flow-Releases/releases/download/v${MACOS_DISTRIBUTION_VERSION}/Tender-Flow-${MACOS_DISTRIBUTION_VERSION}-arm64.dmg`,
    );
    expect(DESKTOP_DOWNLOADS[1].label).toBe("Stáhnout pro macOS (Apple Silicon)");
    expect(DESKTOP_DOWNLOADS[0].href).not.toContain("/releases/latest/download/");
  });
});

describe("trial remaining copy", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts remaining calendar days from the deadline", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-16T10:00:00.000Z"));
    expect(TRIAL_DURATION_DAYS).toBe(14);
    expect(getCalendarDaysRemaining("2026-09-30T10:00:00.000Z")).toBe(14);
    expect(getCalendarDaysRemaining("2026-09-16T12:00:00.000Z")).toBe(1);
    expect(getCalendarDaysRemaining("2026-09-16T10:00:00.000Z")).toBe(-1);
    expect(getCalendarDaysRemaining("2026-09-16T09:00:00.000Z")).toBe(-1);
    expect(getCalendarDaysRemaining("2026-09-16T09:59:59.000Z")).toBe(-1);
    expect(getCalendarDaysRemaining("2026-09-15T10:00:00.000Z")).toBe(-1);
  });

  it("formats Czech remaining-day copy", () => {
    expect(formatTrialRemainingCopy(-3)).toBe("Zkušební období skončilo");
    expect(formatTrialRemainingCopy(0)).toBe("Zkušební období končí dnes");
    expect(formatTrialRemainingCopy(1)).toBe("Zkušební období: zbývá 1 den");
    expect(formatTrialRemainingCopy(3)).toBe("Zkušební období: zbývají 3 dny");
    expect(formatTrialRemainingCopy(14)).toBe("Zkušební období: zbývá 14 dní");
  });
});

describe("live override plan presentation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats an unexpired or unlimited override as live", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-16T10:00:00.000Z"));
    expect(isLiveOverride("enterprise", "2026-12-31T00:00:00.000Z")).toBe(true);
    expect(isLiveOverride("enterprise", null)).toBe(true);
    expect(isLiveOverride("enterprise", "2026-09-01T00:00:00.000Z")).toBe(false);
    expect(isLiveOverride(null, "2026-12-31T00:00:00.000Z")).toBe(false);
  });

  it("does not present a trial when a live override remains", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-16T10:00:00.000Z"));
    const plan = getOrgPlanPresentation({
      status: "trial",
      tier: "enterprise",
      overrideTier: "enterprise",
      overrideExpiresAt: "2026-12-31T00:00:00.000Z",
      billingPeriodEnd: "2026-09-20T00:00:00.000Z",
      expiresAt: "2026-09-20T00:00:00.000Z",
    });
    expect(plan.isTrial).toBe(false);
    expect(plan.isOverridden).toBe(true);
    expect(plan.status).toBe("active");
    expect(plan.activeUntil).toBe("2026-12-31T00:00:00.000Z");
  });

  it("uses the Stripe access deadline instead of stale manual billing dates", () => {
    const plan = getOrgPlanPresentation({
      status: "trial", tier: "enterprise", overrideTier: null, overrideExpiresAt: null,
      billingCustomerId: "cus_fixture", billingPeriodEnd: "2026-10-30T00:00:00Z",
      expiresAt: "2026-09-20T00:00:00Z",
    });
    expect(plan.activeUntil).toBe("2026-09-20T00:00:00Z");
  });

  it("keeps trial presentation when the override has already expired", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-16T10:00:00.000Z"));
    const plan = getOrgPlanPresentation({
      status: "trial",
      tier: "enterprise",
      overrideTier: "enterprise",
      overrideExpiresAt: "2026-09-01T00:00:00.000Z",
      billingPeriodEnd: "2026-09-25T00:00:00.000Z",
      expiresAt: "2026-09-25T00:00:00.000Z",
    });
    expect(plan.isTrial).toBe(true);
    expect(plan.isOverridden).toBe(false);
    expect(plan.status).toBe("trial");
    expect(plan.activeUntil).toBe("2026-09-25T00:00:00.000Z");
  });
});

 it.each(["free", "unknown"])("does not activate a non-entitling %s override", (overrideTier) => {
   const plan = getOrgPlanPresentation({status: "paused", tier: "free", overrideTier,
     overrideExpiresAt: null, billingPeriodEnd: null, expiresAt: null});
   expect(plan.isOverridden).toBe(false);
   expect(plan.status).toBe("paused");
   expect(plan.effectiveTier).toBe("free");
 });
