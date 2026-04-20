import type { CommandCenterModule } from "@features/command-center/types";
import { KpiRowModule } from "./KpiRowModule";

export const kpiRowModule: CommandCenterModule = {
  id: "kpi-row",
  title: "KPI přehled",
  description: "Řádek se 6 kompaktními dlaždicemi: pipeline, rizika, pokrytí, nabídky, smlouvy, úspora.",
  icon: "monitoring",
  zone: "kpi",
  defaultSize: { cols: 12 },
  enabledByDefault: true,
  priority: 0,
  component: KpiRowModule,
};
