import type React from "react";
import type { View } from "@/types";

export interface FeatureRouteConfig {
  path: string;
  view: View;
}

export interface FeatureNavItem {
  id: View;
  label: string;
}

export type FeatureComponentLoader = () => Promise<{
  default: React.ComponentType<any>;
}>;

export interface FeatureModuleManifest {
  id: string;
  routes: FeatureRouteConfig[];
  navItems: FeatureNavItem[];
  requiredCapabilities: string[];
  mount: FeatureComponentLoader;
  unmountSafeChecks: () => string[];
}
