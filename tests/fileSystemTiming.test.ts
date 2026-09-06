import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { measureFolderOperation } from "@infra/files/fileSystemTiming";

const logRuntimeEvent = vi.hoisted(() => vi.fn());
vi.mock("@infra/diagnostics/runtimeDiagnostics", () => ({ logRuntimeEvent }));

describe("folder operation diagnostics", () => {
  beforeEach(() => { logRuntimeEvent.mockReset(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("measures only the awaited operation without retaining its private result", async () => {
    vi.spyOn(performance, "now").mockReturnValueOnce(100).mockReturnValueOnce(425);
    const result = { success: false, error: "Access denied: /private/customer/token-secret" };
    await expect(measureFolderOperation("open_in_explorer", async () => result)).resolves.toBe(result);
    expect(logRuntimeEvent).toHaveBeenCalledExactlyOnceWith("filesystem", "operation_timing", {
      stage: "open_in_explorer", duration_ms: 325, outcome: "failure",
    });
  });

  it("preserves rejected operations without recording the exception", async () => {
    const error = new Error("private-session-token");
    await expect(measureFolderOperation("authenticate", async () => { throw error; })).rejects.toBe(error);
    expect(logRuntimeEvent).toHaveBeenCalledWith("filesystem", "operation_timing", {
      stage: "authenticate", duration_ms: expect.any(Number), outcome: "error",
    });
    expect(JSON.stringify(logRuntimeEvent.mock.calls)).not.toContain(error.message);
  });

  it.each([true, false])("preserves the boolean result %s even when diagnostics fail", async value => {
    logRuntimeEvent.mockImplementation(() => { throw new Error("Storage unavailable"); });
    await expect(measureFolderOperation("folder_exists", async () => value)).resolves.toBe(value);
  });

  it("does not replace an operation error with a diagnostics error", async () => {
    logRuntimeEvent.mockImplementation(() => { throw new Error("Storage unavailable"); });
    const error = new Error("IPC_AUTH_DENIED");
    await expect(measureFolderOperation("authenticate", async () => { throw error; })).rejects.toBe(error);
  });
});
