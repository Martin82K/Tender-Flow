import type { ThemeMode, ThemeSkin } from "@/shared/types/theme";

export interface AppearanceOption<T extends string> {
  id: T;
  icon: string;
  label: string;
}

export const themeModeOptions: ReadonlyArray<AppearanceOption<ThemeMode>> = [
  { id: "light", icon: "light_mode", label: "Světlý" },
  { id: "dark", icon: "dark_mode", label: "Tmavý" },
  { id: "system", icon: "brightness_auto", label: "Auto" },
];

export const themeSkinOptions: ReadonlyArray<AppearanceOption<ThemeSkin>> = [
  { id: "industrial", icon: "precision_manufacturing", label: "Industrial" },
  { id: "classic", icon: "dashboard_customize", label: "Classic" },
  { id: "botanica", icon: "local_florist", label: "Botanica" },
  { id: "nature", icon: "forest", label: "Nature" },
];
