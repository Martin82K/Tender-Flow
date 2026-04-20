import type { CommandCenterModule } from "@features/command-center/types";
import { FEATURES } from "@/config/features";
import { PipelineFunnelModule } from "./PipelineFunnelModule";

export const pipelineFunnelModule: CommandCenterModule = {
  id: "pipeline-funnel",
  title: "Pipeline funnel",
  description: "Zastoupení poptávek ve fázích: nová → osloveni → nabídky → užší výběr → SoD.",
  icon: "filter_list",
  zone: "tactical",
  defaultSize: { cols: 4, minCols: 3 },
  enabledByDefault: true,
  priority: 1,
  requiredFeature: FEATURES.CC_ADVANCED_KPI,
  autoHideWhenEmpty: true,
  weightBySignal: true,
  component: PipelineFunnelModule,
};
