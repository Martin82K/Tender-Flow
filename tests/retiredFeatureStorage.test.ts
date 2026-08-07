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

  it("odstraní všechny zastaralé desktopové klíče", async () => {
    const deleteKey = vi.fn().mockResolvedValue(undefined);

    await cleanupRetiredDesktopFeatureStorage({ delete: deleteKey });

    expect(deleteKey.mock.calls.map(([key]) => key)).toEqual([
      "bid_comparison_agent_secret_v1",
      "bidComparison:autoConfigs:v1",
      "bidComparisonAgentSettings:v1",
    ]);
  });

  it("maže desktopové klíče sekvenčně", async () => {
    let activeDeletes = 0;
    let maxActiveDeletes = 0;
    const deleteKey = vi.fn(async () => {
      activeDeletes += 1;
      maxActiveDeletes = Math.max(maxActiveDeletes, activeDeletes);
      await Promise.resolve();
      activeDeletes -= 1;
    });

    await cleanupRetiredDesktopFeatureStorage({ delete: deleteKey });

    expect(maxActiveDeletes).toBe(1);
  });

  it("zkusí odstranit všechny desktopové klíče i po dílčím selhání", async () => {
    const storageError = new Error("secure storage write failed");
    const deleteKey = vi.fn(async (key: string) => {
      if (key === "bid_comparison_agent_secret_v1") {
        throw storageError;
      }
    });

    await expect(
      cleanupRetiredDesktopFeatureStorage({ delete: deleteKey }),
    ).rejects.toBe(storageError);
    expect(deleteKey.mock.calls.map(([key]) => key)).toEqual([
      "bid_comparison_agent_secret_v1",
      "bidComparison:autoConfigs:v1",
      "bidComparisonAgentSettings:v1",
    ]);
  });
});
