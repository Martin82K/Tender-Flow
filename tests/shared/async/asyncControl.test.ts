import { afterEach, describe, expect, it, vi } from "vitest";
import { withRetry, withTimeout } from "@shared/async/asyncControl";
import {
  withRetry as legacyWithRetry,
  withTimeout as legacyWithTimeout,
} from "@/utils/helpers";

describe("asyncControl", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps legacy helper exports compatible", () => {
    expect(legacyWithRetry).toBe(withRetry);
    expect(legacyWithTimeout).toBe(withTimeout);
  });

  it("returns a resolved value and clears its timeout", async () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

    await expect(withTimeout(Promise.resolve("ok"), 1000)).resolves.toBe("ok");

    expect(clearTimeoutSpy).toHaveBeenCalledOnce();
  });

  it("rejects with the supplied timeout message", async () => {
    vi.useFakeTimers();
    const pending = new Promise<never>(() => undefined);
    const result = withTimeout(pending, 1000, "Dotaz vypršel");
    const rejection = expect(result).rejects.toThrow("Dotaz vypršel");

    await vi.advanceTimersByTimeAsync(1000);

    await rejection;
  });

  it("retries with backoff and returns the later successful result", async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce("recovered");
    const result = withRetry(operation, { retries: 1, baseDelayMs: 100 });

    await vi.advanceTimersByTimeAsync(100);

    await expect(result).resolves.toBe("recovered");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("throws the final error after exhausting retries", async () => {
    vi.useFakeTimers();
    const finalError = new Error("still unavailable");
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(finalError);
    const result = withRetry(operation, { retries: 1, baseDelayMs: 50 });
    const rejection = expect(result).rejects.toBe(finalError);

    await vi.advanceTimersByTimeAsync(50);

    await rejection;
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
