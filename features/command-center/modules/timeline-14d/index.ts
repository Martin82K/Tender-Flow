import type { CommandCenterModule } from "@features/command-center/types";
import { Timeline14dModule, Timeline14dSettings } from "./Timeline14dModule";

export const timeline14dModule: CommandCenterModule = {
  id: "timeline-14d",
  title: "Timeline 14 dní",
  description: "Horizontální časová osa s událostmi (deadliny nabídek, podpisy, kontrolní dny) na projektu.",
  icon: "calendar_month",
  zone: "temporal-primary",
  defaultSize: { cols: 8, minCols: 6 },
  enabledByDefault: true,
  priority: 0,
  component: Timeline14dModule,
  settingsComponent: Timeline14dSettings,
};
