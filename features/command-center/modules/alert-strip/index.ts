import type { CommandCenterModule } from "@features/command-center/types";
import { AlertStripModule } from "./AlertStripModule";

export const alertStripModule: CommandCenterModule = {
  id: "alert-strip",
  title: "Kritické akce",
  description: "Červený pás s top kritickými akcemi, které vyžadují okamžitou pozornost.",
  icon: "priority_high",
  zone: "alert",
  defaultSize: { cols: 12 },
  enabledByDefault: true,
  priority: 0,
  autoHideWhenEmpty: true,
  component: AlertStripModule,
};
