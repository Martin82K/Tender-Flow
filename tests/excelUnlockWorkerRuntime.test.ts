// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { ExcelUnlockWorkerMessage } from "@/shared/tools/excel/excelUnlockZipCore";

describe("Excel worker output transfer", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("transfers the processed buffer without retaining a worker-side copy", async () => {
    const received: ExcelUnlockWorkerMessage[] = [];
    let sourceBuffer: ArrayBufferLike | undefined;
    const scope = {
      onmessage: null as ((event: MessageEvent<Uint8Array>) => Promise<void>) | null,
      postMessage(message: ExcelUnlockWorkerMessage, options?: StructuredSerializeOptions) {
        if (message.type === "result") sourceBuffer = message.output.buffer;
        received.push(structuredClone(message, options));
      },
    };
    vi.stubGlobal("self", scope);
    await import("@/shared/tools/excel/excelUnlock.worker");
    const input = zipSync({
      "xl/worksheets/sheet1.xml": strToU8('<worksheet><sheetProtection sheet="1"/><sheetData/></worksheet>'),
    });
    await scope.onmessage!({ data: input } as MessageEvent<Uint8Array>);
    const result = received.find(message => message.type === "result");
    expect(result?.type).toBe("result");
    if (result?.type !== "result") throw new Error("Worker did not return a result");
    expect(result.worksheetCount).toBe(1);
    expect(strFromU8(unzipSync(result.output)["xl/worksheets/sheet1.xml"]))
      .toBe("<worksheet><sheetData/></worksheet>");
    expect(sourceBuffer?.byteLength).toBe(0);
    expect(result.output.byteLength).toBeGreaterThan(0);
    expect(received.filter(message => message.type === "progress").at(-1))
      .toMatchObject({ percent: 95 });
  });
});
