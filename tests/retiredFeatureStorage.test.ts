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

  it("odstraní všechny zastaralé desktopové klíče jedinou mutací", async () => {
    const deleteMany = vi.fn().mockResolvedValue(undefined);

    await cleanupRetiredDesktopFeatureStorage({ deleteMany });

    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledWith([
      "bid_comparison_agent_secret_v1",
      "bidComparison:autoConfigs:v1",
      "bidComparisonAgentSettings:v1",
    ]);
  });

  it("propaguje selhání desktopového úklidu", async () => {
    const storageError = new Error("secure storage write failed");
    const deleteMany = vi.fn().mockRejectedValue(storageError);

    await expect(
      cleanupRetiredDesktopFeatureStorage({ deleteMany }),
    ).rejects.toBe(storageError);
  });
});
