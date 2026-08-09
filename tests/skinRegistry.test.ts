import { describe, expect, it } from "vitest";

import {
  applySkinVisualDefinition,
  getSkinVisualDefinition,
} from "@/shared/theme/skinRegistry";

describe("skin visual registry", () => {
  it("má pro Botanica samostatný světlý a tmavý asset", () => {
    const light = getSkinVisualDefinition("botanica", "light");
    const dark = getSkinVisualDefinition("botanica", "dark");

    expect(light.asset).toContain("botanical-relief-light.webp");
    expect(dark.asset).toContain("botanical-relief-dark.webp");
    expect(light.fallbackAsset).toContain("botanical-relief-light.svg");
    expect(dark.fallbackAsset).toContain("botanical-relief-dark.svg");
    expect(light.asset).not.toBe(dark.asset);
  });

  it("má pro Nature samostatný lokální lesní asset ve světle a tmě", () => {
    const light = getSkinVisualDefinition("nature", "light");
    const dark = getSkinVisualDefinition("nature", "dark");

    expect(light.asset).toContain("forest-light.jpg");
    expect(dark.asset).toContain("forest-dark.jpg");
    expect(light.asset).not.toBe(dark.asset);
    expect(light.fallbackAsset).toBeUndefined();
    expect(dark.fallbackAsset).toBeUndefined();
    expect(light.sidebar.opacity).toBe(0.24);
    expect(light.header.opacity).toBe(0.12);
    expect(light.canvas.opacity).toBe(0.16);
  });

  it("řídí nezávisle sidebar, header a canvas", () => {
    const botanica = getSkinVisualDefinition("botanica", "dark");

    expect(botanica.sidebar.opacity).toBeGreaterThan(botanica.header.opacity);
    expect(botanica.canvas.position).not.toBe(botanica.sidebar.position);
    expect(botanica.canvas.size).toBeTruthy();
  });

  it("definuje kontrolovaný materiál panelů a hustých datových ploch", () => {
    const botanica = getSkinVisualDefinition("botanica", "light");

    expect(botanica.surface.panelOpacity).toBeGreaterThanOrEqual(0.75);
    expect(botanica.surface.dataOpacity).toBeGreaterThanOrEqual(botanica.surface.panelOpacity);
    expect(botanica.surface.dataOpacity).toBeLessThanOrEqual(1);
  });

  it("Nature chrání hustá data vyšší kryvostí než běžné panely", () => {
    const light = getSkinVisualDefinition("nature", "light");
    const dark = getSkinVisualDefinition("nature", "dark");

    expect(light.surface.dataOpacity).toBeGreaterThan(light.surface.panelOpacity);
    expect(dark.surface.dataOpacity).toBeGreaterThan(dark.surface.panelOpacity);
    expect(light.surface.dataOpacity).toBeGreaterThanOrEqual(0.98);
    expect(dark.surface.dataOpacity).toBeGreaterThanOrEqual(0.98);
    expect(dark.canvas.opacity).toBeGreaterThan(light.canvas.opacity);
  });

  it("Classic a Industrial bezpečně fungují bez obrazového assetu", () => {
    expect(getSkinVisualDefinition("classic", "light").asset).toBeNull();
    expect(getSkinVisualDefinition("industrial", "dark").asset).toBeNull();
  });

  it("aplikuje asset, umístění vrstev a materiál přes CSS proměnné", () => {
    const root = document.createElement("div");

    applySkinVisualDefinition(root, "botanica", "dark");

    expect(root.dataset.skin).toBe("botanica");
    expect(root.style.getPropertyValue("--tf-skin-art-image")).toContain(
      "botanical-relief-dark.webp",
    );
    expect(root.style.getPropertyValue("--tf-skin-art-image")).toContain("image-set");
    expect(root.style.getPropertyValue("--tf-skin-sidebar-art-opacity")).toBe("0.41");
    expect(root.style.getPropertyValue("--tf-skin-header-art-opacity")).toBe("0.2");
    expect(root.style.getPropertyValue("--tf-skin-panel-opacity")).toBe("76%");
    expect(root.style.getPropertyValue("--tf-skin-data-opacity")).toBe("85%");
  });

  it("aplikuje Nature bez image-setu a bez vzdáleného assetu", () => {
    const root = document.createElement("div");

    applySkinVisualDefinition(root, "nature", "dark");

    expect(root.dataset.skin).toBe("nature");
    expect(root.style.getPropertyValue("--tf-skin-art-image")).toContain("forest-dark.jpg");
    expect(root.style.getPropertyValue("--tf-skin-art-image")).not.toContain("http");
    expect(root.style.getPropertyValue("--tf-skin-sidebar-art-opacity")).toBe("0.86");
    expect(root.style.getPropertyValue("--tf-skin-header-art-opacity")).toBe("0.68");
    expect(root.style.getPropertyValue("--tf-skin-canvas-art-opacity")).toBe("0.38");
    expect(root.style.getPropertyValue("--tf-skin-data-opacity")).toBe("99%");
  });
});
