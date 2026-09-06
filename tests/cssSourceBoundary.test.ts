import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const css = readFileSync(path.join(root, "index.css"), "utf8");
const componentSources = css.match(/dist\/components\/\{([^}]+)\}/)?.[1].split(",") ?? [];
const libraryRoot = path.join(root, "node_modules/@appica/ui-react");
const exports = ts.createSourceFile("index.js", readFileSync(path.join(libraryRoot, "dist/index.js"), "utf8"), ts.ScriptTarget.Latest, true);
const symbolSources = new Map<string, string>();
for (const statement of exports.statements) {
  if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
  if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) continue;
  for (const name of statement.exportClause.elements) symbolSources.set(name.name.text, statement.moduleSpecifier.text);
}

function verifyLibraryModule(file: string, visited = new Set<string>()) {
  if (visited.has(file)) return;
  visited.add(file);
  const component = file.match(/dist\/components\/([^/]+)\//)?.[1];
  if (component) expect(componentSources, `Missing CSS source for ${file}`).toContain(component);
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    if (specifier.startsWith(".")) verifyLibraryModule(path.resolve(path.dirname(file), specifier), visited);
  }
}

describe("CSS source boundary", () => {
  it("limits automatic discovery to registered application sources", () => {
    expect(css).toContain('@import "@appica/ui-react/styles.css" source(none);');
    expect(css).toContain('@source "./config/**/*.{js,ts,jsx,tsx}";');
    expect(css).toContain('@source "./*.{js,ts,jsx,tsx,html}";');
  });
  it("covers every imported Appica component and its local dependencies", () => {
    for (const directory of ["app", "features", "shared", "components", "context", "hooks"]) {
      for (const file of readdirSync(path.join(root, directory), { recursive: true }).filter((name) => /\.tsx?$/.test(String(name)))) {
        const source = ts.createSourceFile(String(file), readFileSync(path.join(root, directory, String(file)), "utf8"), ts.ScriptTarget.Latest, true);
        for (const statement of source.statements) {
          if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.importClause?.isTypeOnly) continue;
          const specifier = statement.moduleSpecifier.text;
          if (specifier === "@appica/ui-react") {
            const bindings = statement.importClause?.namedBindings;
            expect(bindings && ts.isNamedImports(bindings), "Use named Appica imports so CSS coverage can be checked").toBe(true);
            if (!bindings || !ts.isNamedImports(bindings)) continue;
            for (const name of bindings.elements) {
              if (name.isTypeOnly) continue;
              const exported = symbolSources.get((name.propertyName ?? name.name).text);
              expect(exported).toBeDefined();
              verifyLibraryModule(path.resolve(libraryRoot, "dist", exported!));
            }
          } else if (specifier.startsWith("@appica/ui-react/")) {
            const component = specifier.slice("@appica/ui-react/".length);
            verifyLibraryModule(path.join(libraryRoot, "dist/components", component, `${component}.js`));
          }
        }
      }
    }
  });
});
