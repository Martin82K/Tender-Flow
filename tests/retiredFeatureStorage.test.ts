import { describe, expect, it, vi } from "vitest";
import { cleanupRetiredFeatureStorage } from "../shared/maintenance/retiredFeatureStorage";
import { cleanupRetiredDesktopFeatureStorage } from "../desktop/main/services/retiredFeatureStorage";

describe("úklid dat odstraněných funkcí", () => {
  it("odstraní pouze zastaralé renderer klíče", () => {
    const values = new Map([
      ["bidComparisonAgentSettings:v1", "secret config"],
      ["bid-comparison-folder:project-1", "/tmp/tender"],
      ["theme", "dark"],
    ]);
    const storage = {
      get length() {
        return values.size;
      },
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      removeItem: (key: string) => values.delete(key),
    };

    cleanupRetiredFeatureStorage(storage);

    expect(Array.from(values.entries())).toEqual([["theme", "dark"]]);
  });

  it("odstraní zastaralý desktopový secret a automatizační konfiguraci", async () => {
    const deleteKey = vi.fn().mockResolvedValue(undefined);

    await cleanupRetiredDesktopFeatureStorage({ delete: deleteKey });

    expect(deleteKey.mock.calls.map(([key]) => key)).toEqual([
      "bid_comparison_agent_secret_v1",
      "bidComparison:autoConfigs:v1",
    ]);
  });
});
