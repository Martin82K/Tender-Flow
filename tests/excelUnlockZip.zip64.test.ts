// @vitest-environment node
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

type FixtureVariant = "valid" | "missing-extra" | "truncated-extra";

// A small ZIP64 central directory, with no large allocations or external files.
const buildZip64Fixture = (variant: FixtureVariant): Uint8Array => {
  const original = zipSync({
    "xl/worksheets/sheet1.xml": strToU8('<worksheet><sheetData/><sheetProtection sheet="1"/></worksheet>'),
  });
  const source = new DataView(original.buffer, original.byteOffset, original.byteLength);
  const centralOffset = source.getUint32(original.length - 6, true);
  const nameLength = source.getUint16(centralOffset + 28, true);
  const extra = variant === "valid"
    ? new Uint8Array(32)
    : variant === "missing-extra" ? new Uint8Array(0) : new Uint8Array([0xfe, 0xca, 8, 0, 0xaa]);
  if (variant === "valid") {
    const fields = new DataView(extra.buffer);
    fields.setUint16(0, 0xcafe, true); // Empty unrelated field before ZIP64.
    fields.setUint16(4, 1, true);
    fields.setUint16(6, 24, true);
    fields.setBigUint64(8, BigInt(source.getUint32(centralOffset + 24, true)), true);
    fields.setBigUint64(16, BigInt(source.getUint32(centralOffset + 20, true)), true);
    fields.setBigUint64(24, BigInt(source.getUint32(centralOffset + 42, true)), true);
  }

  const centralLength = 46 + nameLength + extra.length;
  const zip64Offset = centralOffset + centralLength;
  const locatorOffset = zip64Offset + 56;
  const eocdOffset = locatorOffset + 20;
  const output = new Uint8Array(eocdOffset + 22);
  output.set(original.subarray(0, centralOffset + 46 + nameLength));
  output.set(extra, centralOffset + 46 + nameLength);
  const view = new DataView(output.buffer);
  view.setUint16(centralOffset + 4, 45, true);
  view.setUint16(centralOffset + 6, 45, true);
  view.setUint32(centralOffset + 20, 0xffffffff, true);
  view.setUint32(centralOffset + 24, 0xffffffff, true);
  view.setUint16(centralOffset + 30, extra.length, true);
  view.setUint16(centralOffset + 32, 0, true);
  view.setUint32(centralOffset + 42, 0xffffffff, true);

  view.setUint32(zip64Offset, 0x06064b50, true);
  view.setBigUint64(zip64Offset + 4, 44n, true);
  view.setUint16(zip64Offset + 12, 45, true);
  view.setUint16(zip64Offset + 14, 45, true);
  view.setBigUint64(zip64Offset + 24, 1n, true);
  view.setBigUint64(zip64Offset + 32, 1n, true);
  view.setBigUint64(zip64Offset + 40, BigInt(centralLength), true);
  view.setBigUint64(zip64Offset + 48, BigInt(centralOffset), true);
  view.setUint32(locatorOffset, 0x07064b50, true);
  view.setBigUint64(locatorOffset + 8, BigInt(zip64Offset), true);
  view.setUint32(locatorOffset + 16, 1, true);
  view.setUint32(eocdOffset, 0x06054b50, true);
  view.setUint16(eocdOffset + 8, 0xffff, true);
  view.setUint16(eocdOffset + 10, 0xffff, true);
  view.setUint32(eocdOffset + 12, 0xffffffff, true);
  view.setUint32(eocdOffset + 16, 0xffffffff, true);
  return output;
};

const runUnlock = (variant: FixtureVariant) => {
  const helperUrl = pathToFileURL(resolve("shared/tools/excel/excelUnlockZip.ts")).href;
  // Execute the actual shared boundary. A regressed synchronous parser must not
  // hang Vitest; a Promise timeout in the same thread cannot interrupt it.
  const script = `
    import { readFileSync } from "node:fs";
    import { strFromU8, unzipSync } from "fflate";
    import { unlockExcelZipWithStats } from ${JSON.stringify(helperUrl)};
    try {
      const result = await unlockExcelZipWithStats(new Uint8Array(readFileSync(0)));
      const entries = unzipSync(result.output);
      process.stdout.write(JSON.stringify({
        status: "ok", count: result.worksheetCount,
        protected: strFromU8(entries["xl/worksheets/sheet1.xml"]).includes("sheetProtection")
      }));
    } catch (error) {
      process.stdout.write(JSON.stringify({ status: "rejected", code: error.code }));
    }
  `;
  const child = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "--input-type=module", "-e", script], {
    cwd: process.cwd(),
    input: buildZip64Fixture(variant),
    encoding: "utf8",
    timeout: 3000,
    killSignal: "SIGKILL",
  });
  expect(child.error, child.stderr).toBeUndefined();
  expect(child.signal).toBeNull();
  expect(child.status, child.stderr).toBe(0);
  expect(child.stderr).toBe("");
  return JSON.parse(child.stdout) as { status: string; code?: number; count?: number; protected?: boolean };
};

describe("Excel unlock ZIP64 compatibility", () => {
  it("unlocks a valid ZIP64 worksheet after an unrelated extra field", () => {
    expect(runUnlock("valid")).toEqual({ status: "ok", count: 1, protected: false });
  });

  it.each(["missing-extra", "truncated-extra"] as const)("rejects %s without blocking the process", (variant) => {
    expect(runUnlock(variant)).toEqual({ status: "rejected", code: 13 });
  });
});
