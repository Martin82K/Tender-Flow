import type { CommandCenterModule, Zone } from "./types";
import { alertStripModule } from "./modules/alert-strip";
import { kpiRowModule } from "./modules/kpi-row";
import { filterBarModule } from "./modules/filter-bar";
import { projectsPanelModule } from "./modules/projects-panel";
import { calendarModule } from "./modules/calendar";
import { actionQueueModule } from "./modules/action-queue";
import { matrixHealthModule } from "./modules/matrix-health";
import { pipelineFunnelModule } from "./modules/pipeline-funnel";
import { financeGaugeModule } from "./modules/finance-gauge";
import { activityFeedModule } from "./modules/activity-feed";

export const MODULES: CommandCenterModule[] = [
  alertStripModule,
  kpiRowModule,
  filterBarModule,
  projectsPanelModule,
  calendarModule,
  actionQueueModule,
  matrixHealthModule,
  pipelineFunnelModule,
  financeGaugeModule,
  activityFeedModule,
];

export const ZONE_ORDER: Zone[] = [
  "alert",
  "kpi",
  "filter",
  "portfolio",
  "main-primary",
  "main-secondary",
  "tactical",
  "temporal-primary",
  "temporal-secondary",
];

export const getModuleById = (id: string): CommandCenterModule | undefined =>
  MODULES.find((m) => m.id === id);

export const getModulesByZone = (zone: Zone): CommandCenterModule[] =>
  MODULES.filter((m) => m.zone === zone).sort((a, b) => a.priority - b.priority);

export const defaultEnabledModules = (): Record<string, boolean> =>
  Object.fromEntries(MODULES.map((m) => [m.id, m.enabledByDefault]));
