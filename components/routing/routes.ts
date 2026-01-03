/**
 * Routing Constants and Types
 * Extracted from App.tsx for better modularity
 */

import { View, ProjectTab } from "../../types";

// Base path for all authenticated app routes
export const APP_BASE = "/app";

// Re-export types for convenience
export type { View, ProjectTab };

// Type guard for ProjectTab
export const isProjectTab = (val: string | null): val is ProjectTab => {
  return (
    val === "overview" ||
    val === "tender-plan" ||
    val === "pipeline" ||
    val === "schedule" ||
    val === "documents"
  );
};
