import type { CommandCenterModule } from "@features/command-center/types";
import { FEATURES } from "@/config/features";
import { FinanceGaugeModule } from "./FinanceGaugeModule";

export const financeGaugeModule: CommandCenterModule = {
  id: "finance-gauge",
  title: "Finance gauge",
  description: "Poměr kontrahováno / v pipeline / volný prostor vs. rozpočet celkem.",
  icon: "payments",
  zone: "tactical",
  defaultSize: { cols: 3, minCols: 3 },
  enabledByDefault: true,
  priority: 2,
  requiredFeature: FEATURES.CC_ADVANCED_KPI,
  component: FinanceGaugeModule,
};
