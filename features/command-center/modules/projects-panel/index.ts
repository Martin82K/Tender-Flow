import type { CommandCenterModule } from "@features/command-center/types";
import { ProjectsPanelModule } from "./ProjectsPanelModule";

export const projectsPanelModule: CommandCenterModule = {
  id: "projects-panel",
  title: "Portfolio zakázek",
  description: "Hlavní panel s řádky zakázek — health flag, pokrytí kategorií, nejbližší deadline, rozpočet vs. odhad.",
  icon: "apartment",
  zone: "main-primary",
  defaultSize: { cols: 8 },
  enabledByDefault: true,
  priority: 0,
  component: ProjectsPanelModule,
};
