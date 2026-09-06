// @vitest-environment node
import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";
import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";

const require = createRequire(import.meta.url);

// A ZIP64 directory advertises a 64-bit size, but omits its required extra field.
// Keep the parser in a worker: the vulnerable version otherwise hangs Vitest itself.
const createZip64 = (field: "missing" | "unrelated" | "valid"): Uint8Array => {
  const base = zipSync({ "xl/worksheets/sheet1.xml": strToU8("<worksheet/>") });
  const baseView = new DataView(base.buffer, base.byteOffset, base.byteLength);
  const end = base.length - 22;
  const directory = baseView.getUint32(end + 16, true);
  const extraLength = field === "valid" ? 28 : field === "unrelated" ? 4 : 0;
  const zip64Offset = end + extraLength;
  const result = new Uint8Array(base.length + extraLength + 76);
  result.set(base.subarray(0, end));
  const view = new DataView(result.buffer);
  view.setUint32(directory + 20, 0xffffffff, true);
  view.setUint32(directory + 24, 0xffffffff, true);
  view.setUint32(directory + 42, 0xffffffff, true);
  view.setUint16(directory + 30, extraLength, true);
  if (field === "unrelated") view.setUint16(end, 0xcafe, true);
  if (field === "valid") {
    view.setUint16(end, 1, true);
    view.setUint16(end + 2, 24, true);
    view.setUint32(end + 4, baseView.getUint32(directory + 24, true), true);
    view.setUint32(end + 12, baseView.getUint32(directory + 20, true), true);
    view.setUint32(end + 20, baseView.getUint32(directory + 42, true), true);
  }
  view.setUint32(zip64Offset, 0x06064b50, true);
  view.setUint32(zip64Offset + 4, 44, true);
  view.setUint32(zip64Offset + 24, 1, true);
  view.setUint32(zip64Offset + 32, 1, true);
  view.setUint32(zip64Offset + 40, end - directory + extraLength, true);
  view.setUint32(zip64Offset + 48, directory, true);
  const locator = zip64Offset + 56;
  view.setUint32(locator, 0x07064b50, true);
  view.setUint32(locator + 8, zip64Offset, true);
  view.setUint32(locator + 16, 1, true);
  const finalEnd = locator + 20;
  result.set(base.subarray(end), finalEnd);
  view.setUint16(finalEnd + 8, 0xffff, true);
  view.setUint16(finalEnd + 10, 0xffff, true);
  view.setUint32(finalEnd + 16, 0xffffffff, true);
  return result;
};

const parseInWorker = (input: Uint8Array, modulePath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(`
      const { parentPort, workerData } = require('node:worker_threads');
      try {
        require(workerData.modulePath).unzipSync(new Uint8Array(workerData.input));
        parentPort.postMessage('accepted');
      } catch {
        parentPort.postMessage('rejected');
      }
    `, { eval: true, workerData: { input, modulePath } });
    const timer = setTimeout(() => {
      void worker.terminate().then(() => resolve("timed out"));
    }, 1500);
    worker.once("message", (message: string) => {
      clearTimeout(timer);
      void worker.terminate().then(() => resolve(message));
    });
    worker.once("error", (error) => {
      clearTimeout(timer);
      void worker.terminate().then(() => reject(error));
    });
  });

describe("ZIP64 parser denial-of-service regression", () => {
  for (const [label, modulePath] of [
    ["Excel", require.resolve("fflate")],
  ]) {
    it.each(["missing", "unrelated"] as const)(`${label} rejects invalid ZIP64 metadata (%s)`, async (field) => {
      expect(await parseInWorker(createZip64(field), modulePath)).toBe("rejected");
    });

    it(`${label} still accepts valid ZIP64 metadata`, async () => {
      expect(await parseInWorker(createZip64("valid"), modulePath)).toBe("accepted");
    });

    it(`${label} still accepts ordinary ZIP archives`, async () => {
      expect(await parseInWorker(zipSync({ "file.txt": strToU8("content") }), modulePath)).toBe("accepted");
    });
  }
});
