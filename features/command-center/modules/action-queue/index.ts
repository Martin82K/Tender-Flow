import type { CommandCenterModule } from "@features/command-center/types";
import { ActionQueueModule } from "./ActionQueueModule";

export const actionQueueModule: CommandCenterModule = {
  id: "action-queue",
  title: "Akční fronta",
  description: "Číslovaný seznam top akcí, které je třeba vyřešit teď — derivované z aktuálního stavu.",
  icon: "task_alt",
  zone: "main-secondary",
  defaultSize: { cols: 4 },
  enabledByDefault: true,
  priority: 0,
  autoHideWhenEmpty: true,
  weightBySignal: true,
  component: ActionQueueModule,
};
