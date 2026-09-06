import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const aliases: Record<string, string> = {
  "@/": "", "@app/": "app/", "@features/": "features/", "@shared/": "shared/", "@infra/": "infra/",
};

function eagerDependencies(entry: string): Set<string> {
  const visited = new Set<string>();
  function visit(file: string) {
    if (visited.has(file)) return;
    visited.add(file);
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      if (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly) continue;
      if (ts.isExportDeclaration(statement) && statement.isTypeOnly) continue;
      const specifier = statement.moduleSpecifier.text;
      const alias = Object.keys(aliases).find((prefix) => specifier.startsWith(prefix));
      const base = alias
        ? path.join(root, aliases[alias], specifier.slice(alias.length))
        : specifier.startsWith(".") ? path.resolve(path.dirname(file), specifier) : null;
      if (!base) { visited.add(specifier); continue; }
      const resolved = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]
        .find((candidate) => /\.(ts|tsx)$/.test(candidate) && existsSync(candidate));
      if (resolved) visit(resolved);
    }
  }
  visit(path.join(root, entry));
  return visited;
}

describe("public entry bundle boundary", () => {
  it("does not eagerly evaluate internal application modules before authentication", () => {
    const dependencies = eagerDependencies("app/AppShell.tsx");
    expect([...dependencies]).not.toContain(path.join(root, "app/AppContent.tsx"));
    expect([...dependencies]).not.toContain(path.join(root, "hooks/useAppData.ts"));
    expect([...dependencies]).not.toContain("xlsx");
    expect([...dependencies]).not.toContain("exceljs");
  });

  it.each([
    "services/exportService.ts",
    "features/projects/api/tenderPlanExportApi.ts",
    "features/projects/api/projectScheduleExportApi.ts",
    "features/settings/ExcelIndexerSettings.tsx",
  ])("loads Excel only when an action needs it: %s", (entry) => {
    expect([...eagerDependencies(entry)]).not.toContain("xlsx");
    expect([...eagerDependencies(entry)]).not.toContain("exceljs");
  });
});
