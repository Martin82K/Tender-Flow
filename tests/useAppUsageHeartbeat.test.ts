import { describe, expect, it } from "vitest";
import { shouldRecordUsageHeartbeat } from "../app/hooks/useAppUsageHeartbeat";

describe("shouldRecordUsageHeartbeat", () => {
  it("povolí heartbeat pro viditelné a aktivní okno", () => {
    expect(
      shouldRecordUsageHeartbeat({
        now: 10_000,
        lastActivityAt: 9_000,
        isDocumentVisible: true,
        isWindowFocused: true,
      }),
    ).toBe(true);
  });

  it("nepočítá heartbeat pro idle uživatele", () => {
    expect(
      shouldRecordUsageHeartbeat({
        now: 10 * 60_000,
        lastActivityAt: 4 * 60_000,
        isDocumentVisible: true,
        isWindowFocused: true,
      }),
    ).toBe(false);
  });

  it("nepočítá heartbeat pro skryté nebo rozostřené okno", () => {
    expect(
      shouldRecordUsageHeartbeat({
        now: 10_000,
        lastActivityAt: 9_000,
        isDocumentVisible: false,
        isWindowFocused: true,
      }),
    ).toBe(false);

    expect(
      shouldRecordUsageHeartbeat({
        now: 10_000,
        lastActivityAt: 9_000,
        isDocumentVisible: true,
        isWindowFocused: false,
      }),
    ).toBe(false);
  });
});
