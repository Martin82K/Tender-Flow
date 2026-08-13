import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import legacyPlatformAdapter, {
  platformAdapter as legacyNamedPlatformAdapter,
} from "../services/platformAdapter";
import infraPlatformAdapter, {
  platformAdapter as infraNamedPlatformAdapter,
} from "@infra/platform/platformAdapter";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");
const normalizeLineEndings = (source: string) => source.replace(/\r\n?/g, "\n");

const modernConsumers = [
  "app/AppContent.tsx",
  "infra/auth/deviceService.ts",
  "infra/desktop/useElectronUpdater.ts",
  "infra/diagnostics/runtimeDiagnostics.ts",
  "infra/excel-tools/resolveExcelToolsProvider.ts",
  "features/contracts-overview/api/contractOverviewApi.ts",
  "features/projects/contracts/api/contractQueriesApi.ts",
  "features/projects/dochub/model/personalRoot.ts",
];

describe("infra platform adapter", () => {
  it("owns the implementation in infra and keeps legacy imports as a compatibility adapter", () => {
    const infraSource = read("infra/platform/platformAdapter.ts");
    const legacySource = normalizeLineEndings(read("services/platformAdapter.ts"));

    expect(infraSource).toContain("export const platformAdapter");
    expect(infraSource).not.toContain("@/services/platformAdapter");
    expect(legacySource.trim()).toBe(
      [
        'export * from "@infra/platform/platformAdapter";',
        'export { default } from "@infra/platform/platformAdapter";',
      ].join("\n"),
    );
  });

  it("normalizes Windows line endings before comparing adapter source", () => {
    expect(normalizeLineEndings("first\r\nsecond\r")).toBe("first\nsecond\n");
  });

  it("routes modern consumers through the canonical infra module", () => {
    const legacyImports = modernConsumers.filter((file) =>
      /(?:@\/services|\.\.\/services)\/platformAdapter/.test(read(file)),
    );

    expect(legacyImports).toEqual([]);
  });

  it("preserves default and named export identity for legacy consumers", () => {
    expect(legacyPlatformAdapter).toBe(infraPlatformAdapter);
    expect(legacyNamedPlatformAdapter).toBe(infraNamedPlatformAdapter);
  });
});
