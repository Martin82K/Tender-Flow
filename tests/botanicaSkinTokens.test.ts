import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "index.css"), "utf8");
const commandCenterCss = readFileSync(
  join(process.cwd(), "features/command-center/command-center.css"),
  "utf8",
);
const lightArt = readFileSync(
  join(process.cwd(), "assets/themes/botanica/botanical-relief-light.svg"),
  "utf8",
);
const darkArt = readFileSync(
  join(process.cwd(), "assets/themes/botanica/botanical-relief-dark.svg"),
  "utf8",
);
const lightRaster = statSync(
  join(process.cwd(), "assets/themes/botanica/botanical-relief-light.webp"),
);
const darkRaster = statSync(
  join(process.cwd(), "assets/themes/botanica/botanical-relief-dark.webp"),
);

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

describe("Botanica skin", () => {
  const sharedSkinSelector = 'html:is([data-skin="botanica"], [data-skin="nature"])';

  it("definuje samostatnou světlou a tmavou paletu s čitelným textem", () => {
    expect(css).toContain('html[data-skin="botanica"]');
    expect(css).toContain('html.dark[data-skin="botanica"]');

    expect(contrastRatio("#241a1d", "#f3f0f2")).toBeGreaterThanOrEqual(7);
    expect(contrastRatio("#241a1d", "#fcfafb")).toBeGreaterThanOrEqual(7);
    expect(contrastRatio("#f8edf0", "#090708")).toBeGreaterThanOrEqual(7);
    expect(contrastRatio("#f8edf0", "#171113")).toBeGreaterThanOrEqual(7);
    expect(contrastRatio("#ffffff", "#7a3248")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#ffffff", "#b25770")).toBeGreaterThanOrEqual(4.5);
  });

  it("používá pouze čistou bezpatkovou typografii", () => {
    expect(css).toContain(`${sharedSkinSelector} body`);
    expect(css).toContain('font-family: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif');
  });

  it("omezuje botanický dekor na neinteraktivní podklad a kryje datové plochy", () => {
    expect(css).toContain("--tf-botanica-art:");
    expect(css).toContain(`${sharedSkinSelector} .tf-sidebar::after`);
    expect(css).toContain("inset: 0");
    expect(css).toContain(`${sharedSkinSelector} .tf-sidebar > *`);
    expect(css).toContain(`${sharedSkinSelector} .tf-sidebar-brand`);
    expect(css).toContain("var(--tf-skin-surface-deep) 54%, transparent");
    expect(css).toContain("pointer-events: none");
    expect(css).toContain(`${sharedSkinSelector} [data-help-id="tasks-calendar"]`);
    expect(css).toContain(`${sharedSkinSelector} table`);
    expect(css).toContain("var(--tf-skin-panel-opacity, 88%)");
    expect(css).toContain("var(--tf-skin-data-opacity, 94%)");
    expect(css).toContain("backdrop-filter: blur(var(--tf-skin-surface-blur, 10px))");
    expect(css).toContain("background-size: var(--tf-skin-sidebar-art-size, cover)");
    expect(css).toContain('./assets/themes/botanica/botanical-relief-light.svg');
    expect(css).toContain('./assets/themes/botanica/botanical-relief-dark.svg');
    expect(`${lightArt}\n${darkArt}`).not.toMatch(/<script|foreignObject|(?:href|src)=["']https?:/i);
    expect(lightRaster.size).toBeGreaterThan(100_000);
    expect(darkRaster.size).toBeGreaterThan(100_000);
    expect(css).toContain("(forced-colors: active), (prefers-contrast: more)");
  });

  it("má stavové styly pro hover, výběr a klávesový focus", () => {
    expect(css).toContain(`${sharedSkinSelector} :focus-visible`);
    expect(css).toContain('[data-active="true"]');
    expect(css).toContain(':hover');
  });

  it("zvýrazňuje dnešní den bez plošného fillu a výhradně sémantickými skin tokeny", () => {
    const cellSelector = ".tf-todo-calendar-day--today";
    const cellRuleStart = css.indexOf(cellSelector);
    const cellRuleEnd = css.indexOf("}", cellRuleStart);
    const cellRule = css.slice(cellRuleStart, cellRuleEnd + 1);
    const headingSelector = ".tf-todo-calendar-day-heading--today";
    const headingRuleStart = css.indexOf(headingSelector);
    const headingRuleEnd = css.indexOf("}", headingRuleStart);
    const headingRule = css.slice(headingRuleStart, headingRuleEnd + 1);

    expect(cellRuleStart).toBeGreaterThanOrEqual(0);
    expect(cellRule).toContain("var(--tf-skin-accent)");
    expect(cellRule).toContain("var(--tf-skin-line)");
    expect(cellRule).not.toContain("background");
    expect(headingRuleStart).toBeGreaterThanOrEqual(0);
    expect(headingRule).toContain("var(--tf-skin-accent)");
    expect(headingRule).toContain("var(--tf-skin-surface)");
    expect(headingRule).toContain("var(--tf-skin-text)");
    expect(`${cellRule}\n${headingRule}`).not.toMatch(/orange|amber|yellow|#[0-9a-f]{3,8}/i);
  });

  it("propaguje skin do projektových rout, tabů a lokálních modrých povrchů", () => {
    expect(css).toContain(".tf-tender-plan-view");
    expect(css).toContain(".tf-schedule-view");
    expect(css).toContain(".tf-documents-view");
    expect(css).toContain('[data-help-id="project-tabs"] button[data-active="true"]');
    expect(css).toContain('[data-help-id="tender-plan-tip"]');
    expect(css).toContain('[data-help-id="overview-kpi-cards"]');
  });

  it("přenáší botanickou paletu do Command Center a zachovává čisté panely", () => {
    expect(commandCenterCss).toContain(`${sharedSkinSelector} .cc-root`);
    expect(commandCenterCss).toContain(`${sharedSkinSelector} .cc-panel`);
    expect(commandCenterCss).toContain("var(--tf-skin-panel-opacity, 88%)");
  });
});
