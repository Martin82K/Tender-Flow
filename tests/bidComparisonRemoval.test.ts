import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const removedRuntimeFiles = [
  "components/pipelineComponents/BidComparisonPanel.tsx",
  "features/settings/BidComparisonAgentSettings.tsx",
  "shared/bidComparisonAgentSettings.ts",
  "desktop/main/ipc/modules/bidComparisonHandlers.ts",
  "desktop/main/services/bidComparisonAgent.ts",
  "desktop/main/services/bidComparisonAutoRunner.ts",
  "desktop/main/services/bidComparisonEngine.ts",
  "desktop/main/services/bidComparisonHermes.ts",
  "desktop/main/services/bidComparisonNormalization.ts",
  "desktop/main/services/bidComparisonRunner.ts",
  "desktop/main/services/bidComparisonScoring.ts",
  "desktop/main/services/bidComparisonWorkspace.ts",
];

const integrationFiles = [
  "components/Pipeline.tsx",
  "components/pipelineComponents/index.ts",
  "features/projects/model/usePipelineCategoryNavigation.ts",
  "features/settings/Settings.tsx",
  "config/navigation.ts",
  "shared/routing/routeUtils.ts",
  "services/platformAdapter.ts",
  "desktop/main/ipc/contracts.ts",
  "desktop/main/ipc/handlers.ts",
  "desktop/main/preload.ts",
  "desktop/main/types.ts",
  "shared/types/desktop.ts",
];

describe("odstranění modulu porovnání nabídek", () => {
  it("neponechává implementační soubory modulu", () => {
    const remainingFiles = removedRuntimeFiles.filter((file) =>
      existsSync(join(root, file)),
    );

    expect(remainingFiles).toEqual([]);
  });

  it("neponechává UI, routy ani Electron API modulu", () => {
    const remainingReferences = integrationFiles.flatMap((file) => {
      const source = readFileSync(join(root, file), "utf8");
      return /BidComparison|bidComparison|bid-comparison|Porovnání nabídek/.test(source)
        ? [file]
        : [];
    });

    expect(remainingReferences).toEqual([]);
  });
});
