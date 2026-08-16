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
    JSON.stringify({ version: 2, allowedImports: [] }),
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
    JSON.stringify({ version: 2, allowedImports }),
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

  it("rejects a root-absolute Vite module import that reaches legacy modules", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'import { exampleService } from "/services/exampleService";\nvoid exampleService;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("modern-to-legacy-import");
      expect(result.stderr).toContain("app/consumer.ts");
      expect(result.stderr).toContain("services/exampleService");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("collects a safe root-absolute Vite module import as a graph edge", async () => {
    const fixtureRoot = createFixture();
    fs.mkdirSync(path.join(fixtureRoot, "shared"), { recursive: true });
    fs.writeFileSync(path.join(fixtureRoot, "shared/example.ts"), "export const example = true;\n");
    writeConsumer(
      fixtureRoot,
      'import { example } from "/shared/example";\nvoid example;\n',
    );

    try {
      const { collectArchitectureGraph } = await import("../scripts/lib/architecture-graph.mjs");
      const graph = collectArchitectureGraph({ root: fixtureRoot });

      expect(graph.collectionErrors).toEqual([]);
      expect(graph.edges).toContainEqual({
        file: "app/consumer.ts",
        specifier: "/shared/example",
        target: "shared/example",
        kind: "static",
      });
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects root-only Vite module imports fail-closed", () => {
    const fixtureRoot = createFixture();
    writeConsumer(fixtureRoot, 'import "/?raw";\n');

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("import adresáře kořene repozitáře není podporován");
      expect(result.stderr).toContain('"/?raw"');
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("canonicalizes root-absolute module imports before classifying them", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const load = () => import("/shared/../services/exampleService?raw");\nvoid load;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("modern-to-legacy-import");
      expect(result.stderr).toContain("services/exampleService");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it.each([
    "//services/exampleService",
    "/@fs/tmp/example.ts",
    "/@id/example",
    "/x/../@fs/tmp/example.ts",
    "/x/../@id/example",
    "/@vite/client",
    "/@react-refresh",
    "/C:/tmp/example.ts",
    "/shared/%2e%2e/services/exampleService.ts",
    "/x/%2e%2e/@fs/tmp/example.ts",
  ])(
    "rejects unsupported Vite internal or ambiguous absolute imports: %s",
    (specifier) => {
      const fixtureRoot = createFixture();
      writeConsumer(fixtureRoot, `import "${specifier}";\n`);

      try {
        const result = runBoundary(fixtureRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain("root-absolute import nelze bezpečně rozřešit");
        expect(result.stderr).toContain(JSON.stringify(specifier));
      } finally {
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
      }
    },
  );

  it("classifies Vite Worker and SharedWorker entrypoints as module imports", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      [
        'const worker = new Worker(new URL("/services/exampleService.ts?worker", import.meta.url), { type: "module" });',
        "const shared = new SharedWorker(new URL(`../services/exampleService.ts`, import.meta.url));",
        "void worker; void shared;",
        "",
      ].join("\n"),
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("modern-to-legacy-import");
      expect(result.stderr).toContain("/services/exampleService.ts?worker");
      expect(result.stderr).toContain("../services/exampleService.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects percent-encoded local dynamic imports even with vite-ignore", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const load = () => import(/* @vite-ignore */ "./%2e%2e/services/exampleService.ts");\nvoid load;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("lokální import nesmí používat percent-encoding");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects file URL dependencies fail-closed", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const asset = new URL("file:///Users/runneradmin/.npmrc", import.meta.url);\nvoid asset;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("file URL není podporována");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("allows percent-encoding in an explicitly external import.meta.url asset", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const asset = new URL("https://cdn.example.invalid/a%20b.png", import.meta.url);\nvoid asset;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(0);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it.each([
    "../../outside-secret.txt",
    "./../../outside-secret.txt",
    "assets/../../../../outside-secret.txt",
    "@/../outside-secret.txt",
    "@app/../../outside-secret.txt",
  ])("rejects local dependencies that escape the repository root: %s", (specifier) => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      `const asset = new URL(${JSON.stringify(specifier)}, import.meta.url);\nvoid asset;\n`,
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("lokální import uniká mimo kořen repozitáře");
      expect(result.stderr).toContain(JSON.stringify(specifier));
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects static and dynamic module imports that escape the repository root", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      [
        'import "../../outside-static.txt?raw";',
        'const load = () => import("./../../outside-dynamic.txt?raw");',
        "void load;",
        "",
      ].join("\n"),
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("lokální import uniká mimo kořen repozitáře");
      expect(result.stderr).toContain('"../../outside-static.txt?raw"');
      expect(result.stderr).toContain('"./../../outside-dynamic.txt?raw"');
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it.each([
    "C:/Users/runneradmin/.npmrc",
    "C:\\Users\\runneradmin\\.npmrc",
    "\\\\attacker\\share\\payload.js",
  ])("rejects Windows filesystem specifiers on every host: %s", (specifier) => {
    const fixtureRoot = createFixture();
    fs.writeFileSync(
      path.join(fixtureRoot, "app/static.ts"),
      `import ${JSON.stringify(specifier)};\n`,
    );
    fs.writeFileSync(
      path.join(fixtureRoot, "app/asset.ts"),
      `const asset = new URL(${JSON.stringify(specifier)}, import.meta.url);\nvoid asset;\n`,
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("lokální Windows cesta není podporována");
      expect(result.stderr).toContain("app/static.ts");
      expect(result.stderr).toContain("app/asset.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects a nonliteral Vite Worker entrypoint fail-closed", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      [
        'const target = "/services/exampleService.ts";',
        "const worker = new Worker(new URL(target, import.meta.url));",
        "void worker;",
        "",
      ].join("\n"),
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("new URL s import.meta.url musí používat statický literál");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it.each([
    "%2e%2e/services/exampleService.ts",
    "./%2e%2e/services/exampleService.ts",
    "../shared/%2e%2e/services/exampleService.ts",
  ])("rejects percent-encoded import.meta.url paths fail-closed: %s", (specifier) => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      `const asset = new URL("${specifier}", import.meta.url);\nvoid asset;\n`,
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("new URL s import.meta.url nesmí používat percent-encoding");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("classifies an ordinary import.meta.url asset URL as a module dependency", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const asset = new URL("/services/exampleService.ts", import.meta.url);\nvoid asset;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("root-absolute new URL s import.meta.url není podporována");
      expect(result.stderr).toContain("/services/exampleService.ts");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects root-absolute import.meta.url assets outside scan roots", async () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const asset = new URL("/.env.local", import.meta.url);\nvoid asset;\n',
    );

    try {
      const { collectArchitectureGraph } = await import("../scripts/lib/architecture-graph.mjs");
      const graph = collectArchitectureGraph({ root: fixtureRoot });

      expect(graph.collectionErrors).toContain(
        'app/consumer.ts: root-absolute new URL s import.meta.url není podporována: "/.env.local".',
      );
      expect(graph.edges).not.toContainEqual(
        expect.objectContaining({ specifier: "/.env.local" }),
      );
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it.each([
    "/../../outside-secret.txt",
    "/assets/../../../outside-secret.txt?raw",
  ])("rejects root-absolute import.meta.url paths before Vite publicDir resolution: %s", (specifier) => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      `const asset = new URL(${JSON.stringify(specifier)}, import.meta.url);\nvoid asset;\n`,
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("root-absolute new URL s import.meta.url není podporována");
      expect(result.stderr).toContain(JSON.stringify(specifier));
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it.each(["module-first", "url-first"])(
    "preserves dependency provenance when module and import.meta.url specifiers match: %s",
    async (order) => {
      const fixtureRoot = createFixture();
      fs.mkdirSync(path.join(fixtureRoot, "shared"), { recursive: true });
      fs.writeFileSync(path.join(fixtureRoot, "shared/example.ts"), "export const example = true;\n");
      const moduleImport = 'import { example } from "/shared/example.ts";';
      const assetUrl = 'const asset = new URL("/shared/example.ts", import.meta.url);';
      writeConsumer(
        fixtureRoot,
        [
          ...(order === "module-first" ? [moduleImport, assetUrl] : [assetUrl, moduleImport]),
          "void example; void asset;",
          "",
        ].join("\n"),
      );

      try {
        const { collectArchitectureGraph } = await import("../scripts/lib/architecture-graph.mjs");
        const graph = collectArchitectureGraph({ root: fixtureRoot });
        const rootUrlErrors = graph.collectionErrors.filter((error) =>
          error.includes("root-absolute new URL s import.meta.url není podporována"),
        );

        expect(rootUrlErrors).toHaveLength(1);
        expect(graph.edges).toContainEqual({
          file: "app/consumer.ts",
          specifier: "/shared/example.ts",
          target: "shared/example.ts",
          kind: "static",
        });
      } finally {
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
      }
    },
  );

  it("resolves a contained bare import.meta.url asset relative to its importer", async () => {
    const fixtureRoot = createFixture();
    fs.mkdirSync(path.join(fixtureRoot, "app/assets"), { recursive: true });
    fs.writeFileSync(path.join(fixtureRoot, "app/assets/icon.svg"), "<svg />\n");
    writeConsumer(
      fixtureRoot,
      'const asset = new URL("assets/icon.svg", import.meta.url);\nvoid asset;\n',
    );

    try {
      const { collectArchitectureGraph } = await import("../scripts/lib/architecture-graph.mjs");
      const graph = collectArchitectureGraph({ root: fixtureRoot });

      expect(graph.collectionErrors).toEqual([]);
      expect(graph.edges).toContainEqual({
        file: "app/consumer.ts",
        specifier: "assets/icon.svg",
        target: "app/assets/icon.svg",
        kind: "static",
      });
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
      expect(result.stderr).toContain("import.meta.glob vzor není uzavřen uvnitř skenovaných vrstev");
      expect(result.stderr).toContain("@/**/*.ts");
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
      'const modules = import.meta.glob(["@/services/*.ts", "!@/services/*.ts"]);\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(0);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it.each(["/server/private.ts", "../server/private.ts"])(
    "rejects Vite globs that can reach outside scanned architecture roots: %s",
    (specifier) => {
      const fixtureRoot = createFixture();
      fs.mkdirSync(path.join(fixtureRoot, "server"), { recursive: true });
      fs.writeFileSync(path.join(fixtureRoot, "server/private.ts"), "export const privateValue = true;\n");
      writeConsumer(
        fixtureRoot,
        `const modules = import.meta.glob("${specifier}", { eager: true });\nvoid modules;\n`,
      );

      try {
        const result = runBoundary(fixtureRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain("import.meta.glob vzor není uzavřen uvnitř skenovaných vrstev");
        expect(result.stderr).toContain(specifier);
      } finally {
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
      }
    },
  );

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

  it("rejects a wildcard file prefix before a trailing Vite globstar", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob("/services/*.ts/**");\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("wildcard prefix před koncovým globstarem");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects a trailing slash whose Vite matching semantics are ambiguous", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob("/services/**/");\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("koncové lomítko");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects a wildcard prefix before a trailing globstar fail-closed", () => {
    const fixtureRoot = createFixture();
    writeConsumer(
      fixtureRoot,
      'const modules = import.meta.glob("/services/*/**");\nvoid modules;\n',
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("wildcard prefix před koncovým globstarem");
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

  it("rejects symlinked boundary configs before parsing", ({ skip }) => {
    const configs = [
      ["architecture-boundary-allowlist.json", JSON.stringify({ allowedFindings: [] })],
      ["legacy-import-baseline.json", JSON.stringify({ version: 2, allowedImports: [] })],
    ] as const;

    for (const [fileName, content] of configs) {
      const fixtureRoot = createFixture();
      const configPath = path.join(fixtureRoot, "config", fileName);
      const outsidePath = path.join(fixtureRoot, `outside-${fileName}`);

      try {
        fs.writeFileSync(outsidePath, content);
        fs.rmSync(configPath);
        createSymlinkOrSkip(skip, `../outside-${fileName}`, configPath, "file");

        const result = runBoundary(fixtureRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(`config/${fileName} musí být regulární soubor`);
      } finally {
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
      }
    }
  });

  it.each([
    ["architecture-boundary-allowlist.json", JSON.stringify({ allowedFindings: [] })],
    ["legacy-import-baseline.json", JSON.stringify({ version: 2, allowedImports: [] })],
  ])("rejects an oversized boundary config before JSON parsing: %s", (fileName, content) => {
    const fixtureRoot = createFixture();
    fs.writeFileSync(
      path.join(fixtureRoot, "config", fileName),
      `${content}${" ".repeat(1024 * 1024)}`,
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`config/${fileName} překračuje limit`);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects a dangling boundary config symlink instead of treating it as absent", ({ skip }) => {
    const fixtureRoot = createFixture();
    const configPath = path.join(fixtureRoot, "config/architecture-boundary-allowlist.json");

    try {
      fs.rmSync(configPath);
      createSymlinkOrSkip(skip, "../missing-allowlist.json", configPath, "file");
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "config/architecture-boundary-allowlist.json musí být regulární soubor",
      );
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects an invalid boundary allowlist schema fail-closed", () => {
    const fixtureRoot = createFixture();
    fs.writeFileSync(
      path.join(fixtureRoot, "config/architecture-boundary-allowlist.json"),
      JSON.stringify({ allowedFindings: "not-an-array" }),
    );

    try {
      const result = runBoundary(fixtureRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "config/architecture-boundary-allowlist.json musí obsahovat pole allowedFindings",
      );
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
