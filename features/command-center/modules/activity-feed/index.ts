import type { CommandCenterModule } from "@features/command-center/types";
import { ActivityFeedModule } from "./ActivityFeedModule";

export const activityFeedModule: CommandCenterModule = {
  id: "activity-feed",
  title: "Live aktivita",
  description: "Stream událostí z portfolia — nové poptávky, nahrané dokumenty, uzavřené smlouvy.",
  icon: "bolt",
  zone: "temporal-secondary",
  defaultSize: { cols: 4, minCols: 3 },
  enabledByDefault: true,
  priority: 0,
  autoHideWhenEmpty: true,
  component: ActivityFeedModule,
};
