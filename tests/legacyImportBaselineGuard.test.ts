import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, type TestContext } from "vitest";

const root = process.cwd();
const boundaryScript = path.join(root, "scripts/check-boundaries.mjs");
const legacySpecifier = "@/services/exampleService";
const legacyTarget = "services/exampleService";

const createFixture = () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tender-flow-legacy-imports-"));
  fs.mkdirSync(path.join(fixtureRoot, "app"), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, "services"), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, "config"), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureRoot, "services/exampleService.ts"),
    "export const exampleService = true;\n",
  );
  fs.writeFileSync(
    path.join(fixtureRoot, "config/architecture-boundary-allowlist.json"),
    JSON.stringify({ allowedFindings: [] }),
  );
  fs.writeFileSync(
    path.join(fixtureRoot, "config/legacy-import-baseline.json"),
    JSON.stringify({ version: 1, allowedImports: [] }),
  );
  return fixtureRoot;
};

const writeConsumer = (fixtureRoot: string, content: string) => {
  fs.writeFileSync(path.join(fixtureRoot, "app/consumer.ts"), content);
};

const writeBaseline = (
  fixtureRoot: string,
  allowedImports: Array<{ file: string; specifier: string; target: string }>,
) => {
  fs.writeFileSync(
    path.join(fixtureRoot, "config/legacy-import-baseline.json"),
    JSON.stringify({ version: 1, allowedImports }),
  );
};

const runBoundary = (cwd: string) =>
  spawnSync(process.execPath, [boundaryScript], {
    cwd,
    encoding: "utf8",
  });

const createSymlinkOrSkip = (
  skip: TestContext["skip"],
  target: string,
  linkPath: string,
  type: fs.symlink.Type,
) => {
  try {
    fs.symlinkSync(target, linkPath, type);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (
      process.platform === "win32" &&
      (code === "EPERM" || code === "EACCES" || code === "ENOSYS")
    ) {
      skip(`Windows prostředí nepovoluje vytvoření symlinku (${code}).`);
      return;
    }
    throw error;
  }
};

describe("legacy import baseline guard", () => {
  it("scans Vite glob imports in JSX source files", () => {
    const fixtureRoot = createFixture();
    fs.writeFileSync(
      path.join(fixtureRoot, "app/legacy-loader.jsx"),
      'export const modules = import.meta.glob("/services/*.ts");\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("modern-to-legacy-import");
      expect(result.stderr).toContain("app/legacy-loader.jsx");
      expect(result.stderr).toContain("services/exampleService.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("scans explicitly imported modern sources inside node_modules", () => {
    const fixtureRoot = createFixture();
    fs.mkdirSync(path.join(fixtureRoot, "app/node_modules"), { recursive: true });
    fs.writeFileSync(
      path.join(fixtureRoot, "app/node_modules/bridge.ts"),
      'export { exampleService } from "@/services/exampleService";\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("modern-to-legacy-import");
      expect(result.stderr).toContain("app/node_modules/bridge.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects a root-absolute Vite glob that reaches legacy modules", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob("/services/*.ts");\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("modern-to-legacy-import");
      expect(result.stderr).toContain("app/consumer.ts");
      expect(result.stderr).toContain("services/exampleService.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("canonicalizes parent segments in Vite glob patterns", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob("/shared/../services/*.ts");\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("modern-to-legacy-import");
      expect(result.stderr).toContain("services/exampleService.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("resolves relative Vite globs from a static base option", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob("./*.ts", { base: "/services" });\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("modern-to-legacy-import");
      expect(result.stderr).toContain("services/exampleService.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects a broad Vite glob that reaches legacy modules", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob("@/**/*.ts");\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("modern-to-legacy-import");
      expect(result.stderr).toContain("services/exampleService.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects a legacy globEager pattern inside a literal array", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.globEager(["@/shared/*.ts", "@/services/*.ts"]);\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("modern-to-legacy-import");
      expect(result.stderr).toContain("services/exampleService.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("respects negative Vite glob exclusions", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob(["@/**/*.ts", "!@/services/*.ts"]);\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(0);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("does not apply a negative pattern to a separate Vite glob call", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      [
        'const legacy = import.meta.glob("/services/*.ts");',
        'const modern = import.meta.glob(["/shared/*.ts", "!/services/*.ts"]);',
        "void legacy;",
        "void modern;",
        "",
      ].join("\n"),
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("modern-to-legacy-import");
      expect(result.stderr).toContain("services/exampleService.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects extglob syntax that Vite and Node match differently", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob(["/services/*.ts", "!/services/!(never).ts"]);\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("extglob");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects escaped extglob syntax before path normalization", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob(["/services/*.ts", "!/services/\\\\!(never).ts"]);\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("backslash");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("matches negative Vite glob patterns case-sensitively", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob(["/services/*.ts", "!/services/*.TS"]);\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("modern-to-legacy-import");
      expect(result.stderr).toContain("services/exampleService.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("does not treat globstar inside a segment as crossing directories", () => {
    const fixtureRoot = createFixture();
    fs.mkdirSync(path.join(fixtureRoot, "hooks/queries"), { recursive: true });
    fs.writeFileSync(
      path.join(fixtureRoot, "hooks/queries/useContactsQuery.ts"),
      "export const useContactsQuery = true;\n",
    );
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob(["/hooks/**/useContactsQuery.ts", "!/hooks/q**Query.ts"]);\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("modern-to-legacy-import");
      expect(result.stderr).toContain("hooks/queries/useContactsQuery.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("matches the file prefix of a trailing Vite globstar", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob("/services/exampleService.ts/**");\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("modern-to-legacy-import");
      expect(result.stderr).toContain("services/exampleService.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("matches a wildcard file prefix before a trailing Vite globstar", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob("/services/*.ts/**");\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("modern-to-legacy-import");
      expect(result.stderr).toContain("services/exampleService.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects repeated leading slashes fail-closed", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob("//services/*.ts");\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("opakované úvodní lomítko");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects repeated slashes after the root alias fail-closed", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob("@//services/*.ts");\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("nelze bezpečně vyhodnotit");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("requires an explicit dot to match hidden legacy files", () => {
    const fixtureRoot = createFixture();
    fs.writeFileSync(path.join(fixtureRoot, "services/.secret.ts"), "export default true;\n");
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob(["/services/.*.ts", "!/services/*.ts"]);\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("modern-to-legacy-import");
      expect(result.stderr).toContain("services/.secret.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("does not traverse hidden directories through globstar", () => {
    const fixtureRoot = createFixture();
    fs.mkdirSync(path.join(fixtureRoot, "services/.private"), { recursive: true });
    fs.writeFileSync(
      path.join(fixtureRoot, "services/.private/secret.ts"),
      "export default true;\n",
    );
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob("/services/**/*.ts");\nvoid modules;\n',
    );
    writeBaseline(fixtureRoot, [
      {
        file: "app/consumer.ts",
        specifier: "/services/**/*.ts",
        target: "services/exampleService.ts",
      },
    ]);

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(0);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("excludes nested node_modules like Vite exhaustive false", () => {
    const fixtureRoot = createFixture();
    fs.mkdirSync(path.join(fixtureRoot, "services/node_modules"), { recursive: true });
    fs.writeFileSync(
      path.join(fixtureRoot, "services/node_modules/vendor.ts"),
      "export default true;\n",
    );
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob("/services/**/*.ts");\nvoid modules;\n',
    );
    writeBaseline(fixtureRoot, [
      {
        file: "app/consumer.ts",
        specifier: "/services/**/*.ts",
        target: "services/exampleService.ts",
      },
    ]);

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(0);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("allows an explicit hidden directory in a Vite glob", () => {
    const fixtureRoot = createFixture();
    fs.mkdirSync(path.join(fixtureRoot, "services/.private"), { recursive: true });
    fs.writeFileSync(
      path.join(fixtureRoot, "services/.private/secret.ts"),
      "export default true;\n",
    );
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob("/services/.private/*.ts");\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("services/.private/secret.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("expands Vite globs to non-source files in legacy roots", () => {
    const fixtureRoot = createFixture();
    fs.writeFileSync(path.join(fixtureRoot, "services/rules.json"), '{"enabled":true}\n');
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob("/services/*.json");\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("modern-to-legacy-import");
      expect(result.stderr).toContain("services/rules.json");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects advanced glob syntax outside the case-sensitive matcher subset", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob("/services/*.{ts,tsx}");\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("pokročilá syntax");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("accepts an exact baseline for a concrete legacy glob match", () => {
    const fixtureRoot = createFixture();
    const globSpecifier = "/services/*.ts";
    writeConsumer(
      fixtureRoot,
      `const modules = import.meta.glob("${globSpecifier}");\nvoid modules;\n`,
    );
    writeBaseline(fixtureRoot, [
      {
        file: "app/consumer.ts",
        specifier: globSpecifier,
        target: "services/exampleService.ts",
      },
    ]);

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(0);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects non-literal Vite glob arguments fail-closed", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const pattern = "/services/*.ts";\nconst modules = import.meta.glob(pattern);\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("import.meta.glob");
      expect(result.stderr).toContain("statický literál");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects Vite glob matching options that cannot be mirrored safely", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      [
        'const insensitive = import.meta.glob("/services/*.TS", { caseSensitive: false });',
        'const exhaustive = import.meta.glob("/services/*.ts", { exhaustive: true });',
        "void insensitive;",
        "void exhaustive;",
        "",
      ].join("\n"),
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("caseSensitive");
      expect(result.stderr).toContain("exhaustive");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("allows a Vite glob contained within modern layers", () => {
    const fixtureRoot = createFixture();
    fs.mkdirSync(path.join(fixtureRoot, "shared"), { recursive: true });
    fs.writeFileSync(path.join(fixtureRoot, "shared/example.ts"), "export const example = true;\n");
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob("@/shared/*.ts");\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(0);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects source symlinks inside modern roots", ({ skip }) => {
    const fixtureRoot = createFixture();

    try {
      createSymlinkOrSkip(
        skip,
        "../services/exampleService.ts",
        path.join(fixtureRoot, "app/linkedService.ts"),
        "file",
      );
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Symbolický odkaz");
      expect(result.stderr).toContain("app/linkedService.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects directory symlinks inside modern roots", ({ skip }) => {
    const fixtureRoot = createFixture();

    try {
      createSymlinkOrSkip(
        skip,
        "../services",
        path.join(fixtureRoot, "app/linked-services"),
        "dir",
      );
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Symbolický odkaz");
      expect(result.stderr).toContain("app/linked-services");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects a symlink used as a modern scan root", ({ skip }) => {
    const fixtureRoot = createFixture();

    try {
      fs.rmSync(path.join(fixtureRoot, "app"), { recursive: true, force: true });
      createSymlinkOrSkip(skip, "services", path.join(fixtureRoot, "app"), "dir");
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Symbolický odkaz");
      expect(result.stderr).toContain("app");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects growing the baseline relative to the Git base revision", () => {
    const fixtureRoot = createFixture();
    writeConsumer(fixtureRoot, "export const modern = true;\n");
    const initialFiles = [
      "app/consumer.ts",
      "config/architecture-boundary-allowlist.json",
      "config/legacy-import-baseline.json",
      "services/exampleService.ts",
    ];
    spawnSync("git", ["init", "--quiet"], { cwd: fixtureRoot });
    spawnSync("git", ["add", "--", ...initialFiles], { cwd: fixtureRoot });
    const commit = spawnSync(
      "git",
      ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "baseline"],
      { cwd: fixtureRoot, encoding: "utf8" },
    );
    expect(commit.status).toBe(0);

    writeConsumer(
      fixtureRoot,
      `import { exampleService } from "${legacySpecifier}";\nvoid exampleService;\n`,
    );
    writeBaseline(fixtureRoot, [
      { file: "app/consumer.ts", specifier: legacySpecifier, target: legacyTarget },
    ]);

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Legacy import baseline se nesmí rozšiřovat");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects a new modern-to-legacy import", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      `import { exampleService } from "${legacySpecifier}";\nvoid exampleService;\n`,
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("modern-to-legacy-import");
      expect(result.stderr).toContain("app/consumer.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("accepts an exact baseline and rejects it after the import is removed", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      `import { exampleService } from "${legacySpecifier}";\nvoid exampleService;\n`,
    );
    writeBaseline(fixtureRoot, [
      {
        file: "app/consumer.ts",
        specifier: legacySpecifier,
        target: legacyTarget,
      },
    ]);

    try {
      const matchingResult = runBoundary(fixtureRoot);
      expect(matchingResult.status).toBe(0);

      writeConsumer(fixtureRoot, "export const modern = true;\n");
      const staleResult = runBoundary(fixtureRoot);
      expect(staleResult.status).toBe(1);
      expect(staleResult.stderr).toContain("Zastaralé legacy import výjimky");
      expect(staleResult.stderr).toContain("app/consumer.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
