import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "index.css"), "utf8");

const luminance = (hex: string): number => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );

  if (!channels || channels.length !== 3) return 0;
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrastRatio = (foreground: string, background: string): number => {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

const mixWithBlack = (hex: string, primaryWeight: number): string => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Math.round(Number.parseInt(channel, 16) * primaryWeight));

  if (!channels || channels.length !== 3) return "#000000";
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
};

const cssBlock = (selector: string): string => {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf("\n}", start);

  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return css.slice(start, end + 2);
};

describe("shared Settings skin tokens", () => {
  it("definuje individuální primární paletu pro všechny skiny a režimy", () => {
    expect(cssBlock(":root")).toContain("--tf-settings-primary: rgb(var(--tf-color-primary-rgb))");
    expect(cssBlock(":root")).toContain("--tf-settings-active-background: color-mix(in srgb, var(--tf-settings-primary) 60%, #000000 40%)");
    expect(cssBlock(":root")).toContain("--tf-settings-active-foreground: #ffffff");
    expect(cssBlock("html.dark")).toContain("--tf-settings-primary-strong: #a5b4fc");

    for (const skin of ["industrial", "botanica", "nature", "space", "basic"]) {
      expect(cssBlock(`html[data-skin=\"${skin}\"]`)).toContain("--tf-settings-primary:");
      expect(cssBlock(`html[data-skin=\"${skin}\"]`)).toContain("--tf-settings-active-background:");
      expect(cssBlock(`html[data-skin=\"${skin}\"]`)).toContain("--tf-settings-active-foreground:");
      expect(cssBlock(`html.dark[data-skin=\"${skin}\"]`)).toContain("--tf-settings-primary-strong:");
    }
  });

  it("drží aktivní plné stavy nad WCAG AA ve všech paletách", () => {
    const pairs = [
      ["#0f172a", "#ff8a33"],
      ["#0f172a", "#ff9f1a"],
      ["#ffffff", "#7a3248"],
      ["#ffffff", "#b25770"],
      ["#ffffff", "#166534"],
      ["#ffffff", "#1f7a46"],
      ["#0f172a", "#f43f5e"],
    ] as const;

    for (const [foreground, background] of pairs) {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }

    expect(css).toContain("color: var(--tf-settings-active-foreground) !important");
  });

  it("odvodí kontrastní aktivní plochu pro každou uživatelskou primární barvu", () => {
    const userPrimaryColors = [
      "#607AFB", "#3B82F6", "#06B6D4", "#14B8A6", "#10B981",
      "#84CC16", "#F59E0B", "#F97316", "#EF4444", "#F43F5E",
      "#8B5CF6", "#A855F7", "#D946EF", "#EC4899", "#6366F1",
      "#0EA5E9", "#1D4ED8", "#0F766E", "#7C3AED",
    ];

    for (const primaryColor of userPrimaryColors) {
      const activeBackground = mixWithBlack(primaryColor, 0.6);
      expect(contrastRatio("#ffffff", activeBackground)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("překládá legacy informační utility přes společnou vrstvu Nastavení", () => {
    const start = css.indexOf("/* Shared settings theme bridge:");
    const end = css.indexOf(
      'html:is([data-skin="botanica"], [data-skin="nature"], [data-skin="basic"]) [data-help-id="overview-kpi-cards"]',
      start,
    );
    const settingsCss = css.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(settingsCss).toContain("html[data-skin] .tf-settings-view");
    expect(settingsCss).toContain('[data-help-id="settings-user-workspace"]');
    expect(settingsCss).toContain('[data-help-id="settings-tools-workspace"]');
    expect(settingsCss).toContain('[data-help-id="settings-organization-workspace"]');
    expect(settingsCss).toContain('[data-help-id="settings-admin-workspace"]');
    expect(settingsCss).toContain('[class~="text-blue-500"]');
    expect(settingsCss).toContain('[class~="bg-indigo-600"]');
    expect(settingsCss).toContain('[class~="bg-sky-500"]');
    expect(settingsCss).toContain("accent-color: var(--tf-settings-primary)");
    expect(settingsCss).toContain("color: var(--tf-settings-primary-strong)");
    expect(settingsCss).toContain('[class~="from-primary"]');
    expect(settingsCss).toContain('[class~="to-primary/90"]');
    expect(settingsCss).toContain(".text-primary");
    expect(css).toContain("html[data-skin] .tf-theme-mode-control");
    expect(css).toContain('html[data-skin] .tf-theme-mode-button[aria-pressed="true"]');
    expect(css).toContain("html[data-skin] .tf-appearance-picker-popover");
    expect(css).toContain('html[data-skin] .tf-appearance-picker-option:is([aria-selected="true"], :checked)');
  });

  it("drží textové akcenty všech výchozích palet nad WCAG AA", () => {
    const pairs = [
      ["#4055c7", "#ffffff"],
      ["#a5b4fc", "#111827"],
      ["#b03a05", "#ffffff"],
      ["#ff8a33", "#181b22"],
      ["#5c2034", "#fcfafb"],
      ["#e2a0b2", "#171113"],
      ["#14532d", "#fbfdfb"],
      ["#7dd6a0", "#0e1c14"],
      ["#f43f5e", "#080b14"],
      ["#67e8f9", "#080b14"],
    ] as const;

    for (const [foreground, background] of pairs) {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("nepřepisuje sémantické destructive a error utility", () => {
    const start = css.indexOf("/* Shared settings theme bridge:");
    const end = css.indexOf(
      'html:is([data-skin="botanica"], [data-skin="nature"], [data-skin="basic"]) [data-help-id="overview-kpi-cards"]',
      start,
    );
    const settingsCss = css.slice(start, end);

    expect(settingsCss).not.toMatch(/\[class~="(?:text|bg|border)-(?:red|rose)-/);
    expect(settingsCss).not.toContain("--tf-skin-rose");
  });
});
