import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const canonicalContractPath = "shared/types/desktop.contract.d.ts";
const rendererAdapterPath = "shared/types/desktop.ts";
const mainAdapterPath = "desktop/main/types.ts";

const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

describe("desktop IPC contract architecture", () => {
  it("keeps one canonical type-only contract with stable renderer and main adapters", () => {
    expect(existsSync(join(root, canonicalContractPath))).toBe(true);

    const canonicalContract = read(canonicalContractPath);
    const rendererAdapter = read(rendererAdapterPath);
    const mainAdapter = read(mainAdapterPath);

    expect(rendererAdapter.trim()).toBe('export type * from "./desktop.contract";');
    expect(mainAdapter).toContain('export type ElectronAPI = import(');
    expect(mainAdapter).toContain('"resolution-mode": "import"');
    expect(mainAdapter).not.toContain("export interface");
    expect(canonicalContract).toContain("export interface ElectronAPI");
    expect(canonicalContract).toContain("backupType: 'user' | 'tenant' | 'contacts'");
    expect([canonicalContract, rendererAdapter, mainAdapter].filter((source) =>
      source.includes("export interface ElectronAPI"),
    )).toHaveLength(1);
  });
});
