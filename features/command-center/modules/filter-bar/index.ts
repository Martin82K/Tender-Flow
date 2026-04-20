import type { CommandCenterModule } from "@features/command-center/types";
import { FilterBarModule } from "./FilterBarModule";

export const filterBarModule: CommandCenterModule = {
  id: "filter-bar",
  title: "Filtr",
  description: "Globální filtr Command Centeru — zakázky, stav, rozsah dnů. Ostatní moduly ho respektují.",
  icon: "filter_alt",
  zone: "filter",
  defaultSize: { cols: 12 },
  enabledByDefault: true,
  priority: 0,
  component: FilterBarModule,
};
