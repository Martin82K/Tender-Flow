import { readFileSync } from "node:fs";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTheme } from "@/hooks/useTheme";
import { themeSkinOptions } from "@/shared/theme/appearanceOptions";
import { applySkinVisualDefinition } from "@/shared/theme/skinRegistry";
import { AppearancePicker } from "@/shared/ui/AppearancePicker";

describe("TF basic", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-skin");
    document.documentElement.classList.remove("dark");
  });

  it("offers TF basic in the existing appearance picker", () => {
    const onChange = vi.fn();
    render(<AppearancePicker label="Skin" icon="palette" value="industrial" options={themeSkinOptions} onChange={onChange} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Skin" }));
    fireEvent.click(screen.getByRole("option", { name: "TF basic" }));
    expect(onChange).toHaveBeenCalledWith("basic");
  });

  it("persists the skin independently of light and dark mode and restores it on remount", () => {
    const onPreferencesUpdate = vi.fn();
    const hook = renderHook(() => useTheme({ onPreferencesUpdate }));
    act(() => {
      hook.result.current.setSkin("basic");
      hook.result.current.setTheme("dark");
    });
    expect(document.documentElement.dataset.skin).toBe("basic");
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("skin")).toBe("basic");
    expect(localStorage.getItem("projectDetailSkin")).toBe("basic");
    expect(onPreferencesUpdate).toHaveBeenCalledWith({ skin: "basic" });
    act(() => hook.result.current.setTheme("light"));
    expect(document.documentElement).not.toHaveClass("dark");
    expect(hook.result.current.skin).toBe("basic");
    hook.unmount();
    const restored = renderHook(() => useTheme());
    expect(restored.result.current.skin).toBe("basic");
    expect(restored.result.current.theme).toBe("light");
  });

  it("follows the operating system in automatic mode without losing the selected skin", () => {
    const listeners: Array<() => void> = [];
    const media = { matches: false, addEventListener: vi.fn((_: string, callback: () => void) => listeners.push(callback)), removeEventListener: vi.fn() };
    vi.stubGlobal("matchMedia", vi.fn(() => media));
    localStorage.setItem("skin", "basic");
    const hook = renderHook(() => useTheme());
    expect(document.documentElement).not.toHaveClass("dark");
    act(() => {
      media.matches = true;
      listeners.forEach(listener => listener());
    });
    expect(document.documentElement).toHaveClass("dark");
    expect(hook.result.current.skin).toBe("basic");
    hook.unmount();
    expect(media.removeEventListener).toHaveBeenCalled();
  });

  it.each(["light", "dark"] as const)("clears previous artwork and blur in %s mode", mode => {
    const root = document.createElement("div");
    applySkinVisualDefinition(root, "space", mode);
    applySkinVisualDefinition(root, "basic", mode);
    expect(root.dataset.skin).toBe("basic");
    expect(root.style.getPropertyValue("--tf-skin-art-image")).toBe("none");
    expect(root.style.getPropertyValue("--tf-skin-panel-opacity")).toBe("100%");
    expect(root.style.getPropertyValue("--tf-skin-data-opacity")).toBe("100%");
    expect(root.style.getPropertyValue("--tf-skin-surface-blur")).toBe("0px");
  });

  it.each(["light", "dark"] as const)("keeps text and primary actions readable in the %s palette", mode => {
    const css = readFileSync("index.css", "utf8");
    const selector = mode === "dark" ? 'html.dark[data-skin="basic"]' : 'html[data-skin="basic"]';
    const start = css.indexOf(`${selector} {`);
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf("\n}", start));
    const color = (name: string) => {
      const value = block.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, "i"))?.[1];
      if (!value) throw new Error(`Missing ${name}`);
      return value;
    };
    const luminance = (hex: string) => {
      const channels = [1, 3, 5].map(offset => {
        const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const contrast = (a: string, b: string) => {
      const values = [luminance(a), luminance(b)].sort((x, y) => x - y);
      return (values[1] + 0.05) / (values[0] + 0.05);
    };
    for (const surface of ["bg", "surface", "surface-muted", "surface-deep", "card"]) {
      for (const text of ["text", "text-2", "muted", "orange-deep"]) {
        expect(contrast(color(`tf-skin-${text}`), color(`tf-skin-${surface}`)), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(color("tf-settings-active-foreground"), color("tf-settings-active-background"))).toBeGreaterThanOrEqual(4.5);
  });
});
