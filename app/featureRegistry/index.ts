import type { View } from "@/types";
import { featureModuleRegistry } from "./manifests";
import type { FeatureModuleManifest } from "./types";

export const getFeatureModuleManifest = (
  view: View,
): FeatureModuleManifest => featureModuleRegistry[view];

export const getAllFeatureModuleManifests = (): FeatureModuleManifest[] =>
  Object.values(featureModuleRegistry);
