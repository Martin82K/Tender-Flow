import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { unlockExcelZip, unlockExcelZipWithStats } from "@/shared/tools/excel/excelUnlockZip";
import { unlockExcelZipWithStats as unlockFromLegacy } from "../utils/excelUnlockZip";

class TestWorker {
  static instances: TestWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() { TestWorker.instances.push(this); }
}

describe("Excel worker lifecycle", () => {
  beforeEach(() => {
    TestWorker.instances = [];
    vi.stubGlobal("Worker", TestWorker);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("processes only the selected byte range and preserves the caller's buffer", async () => {
    const source = new Uint8Array([9, 1, 2, 3, 9]);
    const onProgress = vi.fn();
    const result = unlockExcelZipWithStats(source.subarray(1, 4), { onProgress });
    const worker = TestWorker.instances[0];
    expect(worker).toBeDefined();
    expect(worker.postMessage.mock.calls[0][0]).toEqual(new Uint8Array([1, 2, 3]));
    expect(worker.postMessage.mock.calls[0][0].buffer).not.toBe(source.buffer);
    worker.onmessage?.(new MessageEvent("message", { data: { type: "progress", percent: 50, label: "Listy" } }));
    const output = new Uint8Array([4, 5]);
    worker.onmessage?.(new MessageEvent("message", { data: { type: "result", output, worksheetCount: 2 } }));
    await expect(result).resolves.toEqual({ output, worksheetCount: 2 });
    expect(onProgress).toHaveBeenCalledWith(50, "Listy");
    expect(source).toEqual(new Uint8Array([9, 1, 2, 3, 9]));
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("terminates an unresponsive parser and allows the next attempt", async () => {
    const first = unlockExcelZipWithStats(new ArrayBuffer(1));
    const rejection = expect(first).rejects.toThrow(/časový limit/);
    await vi.advanceTimersByTimeAsync(60_000);
    await rejection;
    expect(TestWorker.instances[0].terminate).toHaveBeenCalledOnce();
    const next = unlockExcelZipWithStats(new ArrayBuffer(1));
    TestWorker.instances[1].onmessage?.(new MessageEvent("message", {
      data: { type: "result", output: new Uint8Array([1]), worksheetCount: 1 },
    }));
    await expect(next).resolves.toMatchObject({ worksheetCount: 1 });
  });

  it.each(["error", "messageerror", "parser"])("cleans up after %s failure", async (kind) => {
    const result = unlockExcelZipWithStats(new ArrayBuffer(1));
    const rejection = expect(result).rejects.toThrow();
    const worker = TestWorker.instances[0];
    if (kind === "error") worker.onerror?.(new ErrorEvent("error", { cancelable: true }));
    else if (kind === "messageerror") worker.onmessageerror?.();
    else worker.onmessage?.(new MessageEvent("message", { data: { type: "error", message: "Neplatný ZIP" } }));
    await rejection;
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("fails safely when workers are unavailable", async () => {
    vi.stubGlobal("Worker", undefined);
    await expect(unlockExcelZipWithStats(new ArrayBuffer(1))).rejects.toThrow(/zpracování souboru/);
  });

  it("cleans up when posting the file fails", async () => {
    const original = TestWorker;
    vi.stubGlobal("Worker", class extends original {
      postMessage = vi.fn(() => { throw new Error("Cannot transfer"); });
    });
    await expect(unlockExcelZipWithStats(new ArrayBuffer(1))).rejects.toThrow("Cannot transfer");
    expect(TestWorker.instances[0].terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves both public entrypoints and the legacy export", async () => {
    expect(unlockFromLegacy).toBe(unlockExcelZipWithStats);
    const output = new Uint8Array([1, 2, 3]);
    const legacy = unlockFromLegacy(new ArrayBuffer(1));
    const simple = unlockExcelZip(new ArrayBuffer(1));
    for (const worker of TestWorker.instances) {
      worker.onmessage?.(new MessageEvent("message", {
        data: { type: "result", output, worksheetCount: 2 },
      }));
      expect(worker.terminate).toHaveBeenCalledOnce();
    }
    await expect(legacy).resolves.toEqual({ output, worksheetCount: 2 });
    await expect(simple).resolves.toEqual(output);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("terminates processing when the progress callback throws", async () => {
    const result = unlockExcelZipWithStats(new ArrayBuffer(1), {
      onProgress: () => { throw new Error("Progress failed"); },
    });
    const rejection = expect(result).rejects.toThrow("Progress failed");
    const worker = TestWorker.instances[0];
    worker.onmessage?.(new MessageEvent("message", {
      data: { type: "progress", percent: 5, label: "Rozbaluji" },
    }));
    await rejection;
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
