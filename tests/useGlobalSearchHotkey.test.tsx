import React from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGlobalSearchHotkey } from "@/shared/ui/GlobalSearch/useGlobalSearchHotkey";

describe("useGlobalSearchHotkey", () => {
  it("ignoruje klavesovou udalost bez platneho key", () => {
    const onTrigger = vi.fn();
    renderHook(() => useGlobalSearchHotkey(onTrigger));

    expect(() => {
      act(() => {
        const event = new Event("keydown") as KeyboardEvent;
        Object.defineProperties(event, {
          key: { value: undefined },
          ctrlKey: { value: true },
        });
        window.dispatchEvent(event);
      });
    }).not.toThrow();
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it("otevre hledani pres Cmd+K", () => {
    const onTrigger = vi.fn();
    renderHook(() => useGlobalSearchHotkey(onTrigger));

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "K", metaKey: true }));
    });

    expect(onTrigger).toHaveBeenCalledTimes(1);
  });
});
