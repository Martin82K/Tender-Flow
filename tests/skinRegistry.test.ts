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
});
