import botanicaDarkFallbackAsset from "@/assets/themes/botanica/botanical-relief-dark.svg?no-inline";
import botanicaDarkAsset from "@/assets/themes/botanica/botanical-relief-dark.webp?no-inline";
import botanicaLightFallbackAsset from "@/assets/themes/botanica/botanical-relief-light.svg?no-inline";
import botanicaLightAsset from "@/assets/themes/botanica/botanical-relief-light.webp?no-inline";
import natureDarkAsset from "@/assets/themes/nature/forest-dark.jpg?no-inline";
import natureLightAsset from "@/assets/themes/nature/forest-light.jpg?no-inline";
import spaceCanvasAsset from "@/assets/themes/space/tf-space-canvas.webp?no-inline";
import type { ThemeSkin } from "@/shared/types/theme";

export type ResolvedThemeMode = "light" | "dark";

export interface SkinArtworkPlacement {
  opacity: number;
  position: string;
  size: string;
}

export interface SkinSurfaceMaterial {
  panelOpacity: number;
  dataOpacity: number;
  blur: number;
}

export interface SkinVisualDefinition {
  asset: string | null;
  fallbackAsset?: string;
  sidebar: SkinArtworkPlacement;
  header: SkinArtworkPlacement;
  canvas: SkinArtworkPlacement;
  surface: SkinSurfaceMaterial;
}

const noArtwork: SkinArtworkPlacement = {
  opacity: 0,
  position: "center",
  size: "cover",
};

const fallbackDefinition: SkinVisualDefinition = {
  asset: null,
  sidebar: noArtwork,
  header: noArtwork,
  canvas: noArtwork,
  surface: {
    panelOpacity: 1,
    dataOpacity: 1,
    blur: 0,
  },
};

const botanicaDefinitions: Record<ResolvedThemeMode, SkinVisualDefinition> = {
  light: {
    asset: botanicaLightAsset,
    fallbackAsset: botanicaLightFallbackAsset,
    sidebar: { opacity: 0.39, position: "18% center", size: "cover" },
    header: { opacity: 0.17, position: "right 32%", size: "cover" },
    canvas: { opacity: 0.45, position: "center", size: "cover" },
    surface: { panelOpacity: 0.78, dataOpacity: 0.86, blur: 10 },
  },
  dark: {
    asset: botanicaDarkAsset,
    fallbackAsset: botanicaDarkFallbackAsset,
    sidebar: { opacity: 0.41, position: "18% center", size: "cover" },
    header: { opacity: 0.2, position: "right 32%", size: "cover" },
    canvas: { opacity: 0.47, position: "center", size: "cover" },
    surface: { panelOpacity: 0.76, dataOpacity: 0.85, blur: 12 },
  },
};

const natureDefinitions: Record<ResolvedThemeMode, SkinVisualDefinition> = {
  light: {
    asset: natureLightAsset,
    sidebar: { opacity: 0.24, position: "12% center", size: "cover" },
    header: { opacity: 0.12, position: "center 24%", size: "cover" },
    canvas: { opacity: 0.16, position: "center", size: "cover" },
    surface: { panelOpacity: 0.94, dataOpacity: 0.98, blur: 8 },
  },
  dark: {
    asset: natureDarkAsset,
    sidebar: { opacity: 0.86, position: "8% center", size: "cover" },
    header: { opacity: 0.68, position: "center 18%", size: "cover" },
    canvas: { opacity: 0.38, position: "center", size: "cover" },
    surface: { panelOpacity: 0.96, dataOpacity: 0.99, blur: 6 },
  },
};

const spaceDefinitions: Record<ResolvedThemeMode, SkinVisualDefinition> = {
  light: {
    asset: spaceCanvasAsset,
    sidebar: { opacity: 0.58, position: "12% center", size: "cover" },
    header: { opacity: 0.46, position: "center 20%", size: "cover" },
    canvas: { opacity: 0.42, position: "center", size: "cover" },
    surface: { panelOpacity: 0.86, dataOpacity: 0.95, blur: 14 },
  },
  dark: {
    asset: spaceCanvasAsset,
    sidebar: { opacity: 0.72, position: "10% center", size: "cover" },
    header: { opacity: 0.58, position: "center 18%", size: "cover" },
    canvas: { opacity: 0.58, position: "center", size: "cover" },
    surface: { panelOpacity: 0.84, dataOpacity: 0.96, blur: 16 },
  },
};

const registry: Record<ThemeSkin, Record<ResolvedThemeMode, SkinVisualDefinition>> = {
  basic: { light: fallbackDefinition, dark: fallbackDefinition },
  classic: { light: fallbackDefinition, dark: fallbackDefinition },
  industrial: { light: fallbackDefinition, dark: fallbackDefinition },
  botanica: botanicaDefinitions,
  nature: natureDefinitions,
  space: spaceDefinitions,
};

export const getSkinVisualDefinition = (
  skin: ThemeSkin,
  mode: ResolvedThemeMode,
): SkinVisualDefinition => registry[skin][mode];

const setLayerVariables = (
  root: HTMLElement,
  layer: "sidebar" | "header" | "canvas",
  placement: SkinArtworkPlacement,
): void => {
  root.style.setProperty(`--tf-skin-${layer}-art-opacity`, String(placement.opacity));
  root.style.setProperty(`--tf-skin-${layer}-art-position`, placement.position);
  root.style.setProperty(`--tf-skin-${layer}-art-size`, placement.size);
};

export const applySkinVisualDefinition = (
  root: HTMLElement,
  skin: ThemeSkin,
  mode: ResolvedThemeMode,
): void => {
  const definition = getSkinVisualDefinition(skin, mode);

  root.dataset.skin = skin;
  root.style.setProperty(
    "--tf-skin-art-image",
    definition.asset
      ? definition.fallbackAsset
        ? `image-set(url("${definition.asset}") type("image/webp"), url("${definition.fallbackAsset}") type("image/svg+xml"))`
        : `url("${definition.asset}")`
      : "none",
  );
  setLayerVariables(root, "sidebar", definition.sidebar);
  setLayerVariables(root, "header", definition.header);
  setLayerVariables(root, "canvas", definition.canvas);
  root.style.setProperty(
    "--tf-skin-panel-opacity",
    `${Math.round(definition.surface.panelOpacity * 100)}%`,
  );
  root.style.setProperty(
    "--tf-skin-data-opacity",
    `${Math.round(definition.surface.dataOpacity * 100)}%`,
  );
  root.style.setProperty("--tf-skin-surface-blur", `${definition.surface.blur}px`);
};
