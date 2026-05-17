import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_DARK_BACKGROUND,
  DEFAULT_UI_SCALE,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  UI_SCALE_STEP,
  formatUiScalePercent,
  normalizeUiScale,
  useTheme,
} from "@/hooks/useTheme";

describe("normalizeUiScale", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("style");
    document.body.innerHTML = '<div id="root"></div>';
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it("ořízne velikost UI do bezpečného rozsahu", () => {
    expect(normalizeUiScale(0.4)).toBe(UI_SCALE_MIN);
    expect(normalizeUiScale(2)).toBe(UI_SCALE_MAX);
    expect(normalizeUiScale("0.96")).toBe(1);
    expect(normalizeUiScale("0.94")).toBe(0.9);
  });

  it("používá rozsah 50 až 150 procent po 10 procentech", () => {
    expect(UI_SCALE_MIN).toBe(0.5);
    expect(UI_SCALE_MAX).toBe(1.5);
    expect(UI_SCALE_STEP).toBe(0.1);
  });

  it("nepropustí nečíselnou hodnotu z preferences ani localStorage", () => {
    expect(normalizeUiScale("calc(200%)")).toBe(DEFAULT_UI_SCALE);
    expect(normalizeUiScale("0.96px")).toBe(DEFAULT_UI_SCALE);
    expect(normalizeUiScale({ value: 1 })).toBe(DEFAULT_UI_SCALE);
  });

  it("připraví bezpečnou procentuální hodnotu pro globální velikost UI", () => {
    expect(formatUiScalePercent(0.9)).toBe("90%");
    expect(formatUiScalePercent(1.5)).toBe("150%");
    expect(formatUiScalePercent("calc(200%)")).toBe("100%");
  });

  it("ukládá globální hodnotu UI bez změny rozměrů root plátna", async () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setUiScale(0.9));

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue("--tf-ui-scale")).toBe("0.9");
    });

    const rootElement = document.getElementById("root");
    expect(rootElement?.getAttribute("style")).toBeNull();
    expect(rootElement?.style.width).toBe("");
    expect(rootElement?.style.minHeight).toBe("");
    expect(document.documentElement.style.overflowX).toBe("hidden");
  });

  it("ukládá skin jako samostatnou vrstvu vedle režimu světlý/tmavý", async () => {
    localStorage.setItem("skin", "neplatny-skin");

    const { result } = renderHook(() => useTheme());

    await waitFor(() => {
      expect(document.documentElement.dataset.skin).toBe("industrial");
    });

    act(() => result.current.setSkin("classic"));

    await waitFor(() => {
      expect(document.documentElement.dataset.skin).toBe("classic");
    });

    expect(localStorage.getItem("skin")).toBe("classic");
    expect(localStorage.getItem("projectDetailSkin")).toBe("classic");
  });

  it("v tmavém classic režimu neodvozuje canvas ze světlé barvy pozadí", async () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setBackgroundColor("#f5f6f8"));

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue("--tf-color-background-dark")).toBe(DEFAULT_DARK_BACKGROUND);
    });

    expect(document.documentElement.style.getPropertyValue("--color-background-dark")).toBe(DEFAULT_DARK_BACKGROUND);
    expect(document.documentElement.style.getPropertyValue("--tf-color-background-dark")).not.toBe("#414954");
  });

  it("nepropustí neplatnou uloženou barvu pozadí do CSS proměnných", async () => {
    renderHook(() =>
      useTheme({
        user: {
          id: "user-1",
          name: "Test User",
          email: "test@example.com",
          role: "user",
          preferences: {
            backgroundColor: "url(https://example.com/bad.png)",
          },
        } as any,
      }),
    );

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue("--tf-color-background-light")).toBe("#f5f6f8");
    });

    expect(document.documentElement.style.getPropertyValue("--tf-color-background-light")).not.toContain("url(");
  });
});
