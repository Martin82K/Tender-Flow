import { useMemo } from "react";
import type {
  CommandCenterFilterState,
  ModuleSignal,
  ModuleSignalLevel,
} from "@features/command-center/types";
import { useDerivedActions } from "./useDerivedActions";
import { useMatrixHealthData } from "./useMatrixHealthData";
import { usePipelineFunnelData } from "./usePipelineFunnelData";
import { useFinanceGaugeData } from "./useFinanceGaugeData";
import { useActivityFeedData } from "./useActivityFeedData";
import { useProjectsPanelData } from "./useProjectsPanelData";

export type ModuleSignalMap = Record<string, ModuleSignal>;

const WEIGHT_BY_LEVEL: Record<ModuleSignalLevel, number> = {
  empty: 0.6,
  normal: 1.0,
  hot: 1.3,
  critical: 1.7,
};

export const signalWeight = (
  signal: ModuleSignal | undefined,
  autoHideWhenEmpty: boolean
): number => {
  if (!signal) return 1.0;
  if (signal.level === "empty") return autoHideWhenEmpty ? 0 : WEIGHT_BY_LEVEL.empty;
  return WEIGHT_BY_LEVEL[signal.level];
};

const levelFromBuckets = (
  count: number,
  buckets: { hot: number; critical: number }
): ModuleSignalLevel => {
  if (count === 0) return "empty";
  if (count >= buckets.critical) return "critical";
  if (count >= buckets.hot) return "hot";
  return "normal";
};

export const useModuleSignals = (filter: CommandCenterFilterState): ModuleSignalMap => {
  const derivedActions = useDerivedActions(filter);
  const matrix = useMatrixHealthData(filter);
  const pipeline = usePipelineFunnelData(filter);
  const finance = useFinanceGaugeData(filter);
  const activity = useActivityFeedData(filter);
  const projects = useProjectsPanelData(filter);

  return useMemo(() => {
    const criticalActions = derivedActions.filter((a) => a.severity === "critical").length;
    const totalActions = derivedActions.length;

    const alertStrip: ModuleSignal = {
      level: levelFromBuckets(criticalActions, { hot: 3, critical: 5 }),
      count: criticalActions,
      hint: criticalActions === 0 ? undefined : `${criticalActions} kritických`,
    };

    let actionQueueLevel: ModuleSignalLevel;
    if (totalActions === 0) actionQueueLevel = "empty";
    else if (criticalActions >= 3) actionQueueLevel = "critical";
    else if (totalActions >= 10) actionQueueLevel = "hot";
    else actionQueueLevel = "normal";
    const actionQueue: ModuleSignal = {
      level: actionQueueLevel,
      count: totalActions,
      hint: totalActions === 0 ? undefined : `${totalActions} akcí`,
    };

    let matrixCrit = 0;
    for (const row of matrix.rows) {
      for (const cell of Object.values(row.cells)) {
        if (cell.tone === "crit") matrixCrit += 1;
      }
    }
    const matrixHealth: ModuleSignal = {
      level:
        matrix.rows.length === 0
          ? "empty"
          : matrixCrit >= 4
            ? "critical"
            : matrixCrit >= 1
              ? "hot"
              : "normal",
      count: matrixCrit,
      hint: matrixCrit > 0 ? `${matrixCrit} kritických buněk` : undefined,
    };

    const pipelineTotal = pipeline.stages.reduce((s, st) => s + st.count, 0);
    const breaching = pipeline.breaching14d.count;
    let pipelineLevel: ModuleSignalLevel;
    if (pipelineTotal === 0) pipelineLevel = "empty";
    else if (breaching >= 3) pipelineLevel = "critical";
    else if (breaching >= 1 || pipelineTotal >= 20) pipelineLevel = "hot";
    else pipelineLevel = "normal";
    const pipelineFunnel: ModuleSignal = {
      level: pipelineLevel,
      count: pipelineTotal,
      hint: breaching > 0 ? `${breaching} před 14denním limitem` : undefined,
    };

    const financeGauge: ModuleSignal = {
      level: finance.totalBudget > 0 ? "normal" : "empty",
      count: finance.totalBudget,
    };

    const activityFeed: ModuleSignal = {
      level: levelFromBuckets(activity.length, { hot: 6, critical: 20 }),
      count: activity.length,
    };

    const critProjects = projects.filter((r) => r.health === "crit").length;
    let projectsLevel: ModuleSignalLevel;
    if (projects.length === 0) projectsLevel = "empty";
    else if (critProjects >= 3) projectsLevel = "critical";
    else if (critProjects >= 1) projectsLevel = "hot";
    else projectsLevel = "normal";
    const projectsPanel: ModuleSignal = {
      level: projectsLevel,
      count: projects.length,
      hint: critProjects > 0 ? `${critProjects} v kritickém stavu` : undefined,
    };

    const alwaysOn: ModuleSignal = { level: "normal", count: 0 };

    return {
      "alert-strip": alertStrip,
      "action-queue": actionQueue,
      "matrix-health": matrixHealth,
      "pipeline-funnel": pipelineFunnel,
      "finance-gauge": financeGauge,
      "activity-feed": activityFeed,
      "projects-panel": projectsPanel,
      "kpi-row": alwaysOn,
      "filter-bar": alwaysOn,
    };
  }, [derivedActions, matrix, pipeline, finance, activity, projects]);
};
