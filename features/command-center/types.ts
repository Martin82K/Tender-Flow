import type { ComponentType } from "react";
import type { FeatureKey } from "@/config/features";

export type Zone =
  | "alert"
  | "kpi"
  | "filter"
  | "main-primary"
  | "main-secondary"
  | "tactical"
  | "temporal-primary"
  | "temporal-secondary";

export interface ModuleSize {
  cols: number;
  minCols?: number;
  rows?: number;
}

export type CommandCenterSeverity = "critical" | "warning" | "info";

export interface DerivedAction {
  id: string;
  severity: CommandCenterSeverity;
  title: string;
  subtitle?: string;
  projectId: string;
  projectName?: string;
  categoryId?: string;
  relatedEntity?: string;
  dueAt?: string;
  actionUrl?: string;
}

export interface CommandCenterFilterState {
  projectIds: string[];
  healthLevels: Array<"ok" | "warn" | "crit">;
  statuses: Array<"tender" | "realization" | "archived">;
  rangeDays: 7 | 14 | 30 | 90;
}

export interface ModuleProps {
  settings: Record<string, unknown>;
  onSettingsChange: (next: Record<string, unknown>) => void;
  isCompact?: boolean;
  filterState: CommandCenterFilterState;
  onFilterChange: (next: Partial<CommandCenterFilterState>) => void;
}

export interface ModuleSettingsProps {
  settings: Record<string, unknown>;
  onSettingsChange: (next: Record<string, unknown>) => void;
}

export interface CommandCenterModule {
  id: string;
  title: string;
  description: string;
  icon?: string;
  zone: Zone;
  defaultSize: ModuleSize;
  enabledByDefault: boolean;
  requiredFeature?: FeatureKey;
  priority: number;
  component: ComponentType<ModuleProps>;
  settingsComponent?: ComponentType<ModuleSettingsProps>;
}

export interface CommandCenterPreferences {
  enabledModules: Record<string, boolean>;
  moduleSettings: Record<string, Record<string, unknown>>;
  filterState?: Partial<CommandCenterFilterState>;
  lastUpdated: string;
}

export const DEFAULT_FILTER_STATE: CommandCenterFilterState = {
  projectIds: [],
  healthLevels: [],
  statuses: ["tender", "realization"],
  rangeDays: 14,
};
