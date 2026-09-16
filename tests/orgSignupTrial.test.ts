import { describe, expect, it, vi, afterEach } from "vitest";
import {
  DESKTOP_DISTRIBUTION_VERSION,
  DESKTOP_DOWNLOADS,
  DESKTOP_RELEASES_LATEST_URL,
} from "@features/public/model/desktopDownloads";
import {
  formatTrialRemainingCopy,
  getCalendarDaysRemaining,
  TRIAL_DURATION_DAYS,
} from "@features/subscription/model/trial";

describe("desktop download URLs", () => {
  it("points Windows and Apple Silicon macOS installers at published latest assets", () => {
    expect(DESKTOP_RELEASES_LATEST_URL).toBe(
      "https://github.com/Martin82K/Tender-Flow-Releases/releases/latest",
    );
    expect(DESKTOP_DOWNLOADS.map((item) => item.id)).toEqual(["windows", "macos"]);
    expect(DESKTOP_DOWNLOADS[0].href).toBe(
      `https://github.com/Martin82K/Tender-Flow-Releases/releases/latest/download/Tender-Flow-Setup-${DESKTOP_DISTRIBUTION_VERSION}.exe`,
    );
    expect(DESKTOP_DOWNLOADS[1].href).toBe(
      `https://github.com/Martin82K/Tender-Flow-Releases/releases/latest/download/Tender-Flow-${DESKTOP_DISTRIBUTION_VERSION}-arm64.dmg`,
    );
    expect(DESKTOP_DOWNLOADS[1].label).toBe("Stáhnout pro macOS (Apple Silicon)");
    expect(DESKTOP_DOWNLOADS[0].href).not.toContain(`/download/v${DESKTOP_DISTRIBUTION_VERSION}/`);
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
    expect(getCalendarDaysRemaining("2026-09-16T09:00:00.000Z")).toBe(0);
    expect(getCalendarDaysRemaining("2026-09-15T10:00:00.000Z")).toBe(-1);
  });

  it("formats Czech remaining-day copy", () => {
    expect(formatTrialRemainingCopy(0)).toBe("Zkušební období končí dnes");
    expect(formatTrialRemainingCopy(1)).toBe("Zkušební období: zbývá 1 den");
    expect(formatTrialRemainingCopy(3)).toBe("Zkušební období: zbývají 3 dny");
    expect(formatTrialRemainingCopy(14)).toBe("Zkušební období: zbývá 14 dní");
  });
});
