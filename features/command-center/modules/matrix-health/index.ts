import type { CommandCenterModule } from "@features/command-center/types";
import { FEATURES } from "@/config/features";
import { MatrixHealthModule } from "./MatrixHealthModule";

export const matrixHealthModule: CommandCenterModule = {
  id: "matrix-health",
  title: "Matice zdraví",
  description: "Heatmapa zakázka × kategorie — rychlý pohled na stav všech kategorií napříč portfoliem.",
  icon: "grid_on",
  zone: "tactical",
  defaultSize: { cols: 5, minCols: 4 },
  enabledByDefault: true,
  priority: 0,
  requiredFeature: FEATURES.CC_MATRIX_HEALTH,
  weightBySignal: true,
  component: MatrixHealthModule,
};
