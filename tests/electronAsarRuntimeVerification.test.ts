import { createRequire } from "module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { verifyAsarEntries } = require("../scripts/verify-electron-asar-runtime.cjs") as {
  verifyAsarEntries: (entries: string[]) => string[];
};

describe("Electron ASAR runtime dependency verification", () => {
  it("fails when exceljs is packaged without jszip in the same runtime tree", () => {
    const errors = verifyAsarEntries([
      "/node_modules/exceljs/package.json",
      "/node_modules/exceljs/lib/xlsx/xlsx.js",
    ]);

    expect(errors).toEqual([
      "Missing jszip next to /node_modules/exceljs; packaged app will fail at runtime.",
    ]);
  });

  it("passes for the desktop runtime tree with exceljs and jszip", () => {
    const errors = verifyAsarEntries([
      "/desktop/node_modules/exceljs/package.json",
      "/desktop/node_modules/exceljs/lib/xlsx/xlsx.js",
      "/desktop/node_modules/jszip/package.json",
      "/desktop/node_modules/jszip/lib/index.js",
    ]);

    expect(errors).toEqual([]);
  });
});
