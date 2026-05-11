import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { APP_VERSION } from "@/config/version";
import { shouldShowWhatsNew, useWhatsNew } from "@/features/whats-new/useWhatsNew";

describe("shouldShowWhatsNew", () => {
  it("nezobrazí novinky pro přeskočenou verzi 1.7.0", () => {
    expect(shouldShowWhatsNew("1.7.0", null)).toBe(false);
    expect(shouldShowWhatsNew("1.7.0", "1.6.3")).toBe(false);
  });

  it("zachová standardní chování pro další verze", () => {
    expect(shouldShowWhatsNew("1.7.2", "1.7.1")).toBe(true);
    expect(shouldShowWhatsNew("1.7.2", "1.7.2")).toBe(false);
  });
});

describe("useWhatsNew", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("v aktuální verzi modal neotevře", () => {
    const { result } = renderHook(() => useWhatsNew());

    expect(result.current.isOpen).toBe(false);
  });

  it("dismiss uloží aktuální verzi jako zobrazenou", () => {
    const { result } = renderHook(() => useWhatsNew());

    act(() => {
      result.current.dismiss();
    });

    expect(localStorage.getItem("tf_whatsNew_lastSeen")).toBe(APP_VERSION);
  });
});
