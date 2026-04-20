import type { CommandCenterModule } from "@features/command-center/types";
import { CalendarModule } from "./CalendarModule";

export const calendarModule: CommandCenterModule = {
  id: "calendar",
  title: "Kalendář",
  description: "Mini-měsíc s nadcházejícími termíny — úkoly, uzávěrky poptávek, 14denní limity a realizační termíny.",
  icon: "event",
  zone: "main-primary",
  defaultSize: { cols: 6, minCols: 4 },
  enabledByDefault: true,
  priority: 0,
  component: CalendarModule,
};
