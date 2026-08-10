import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const extractDesktopPublicKeys = (source: string): string[] => {
  const match = source.match(/const publicKeys = \[([\s\S]*?)\];/);
  if (!match) return [];
  return Array.from(match[1].matchAll(/"([^"]+)"/g)).map((item) => item[1]);
};

describe("desktop build env security", () => {
  it("používá v quality workflow syntetický anon JWT místo neplatného placeholderu", () => {
    const workflow = readFileSync(
      join(process.cwd(), ".github", "workflows", "quality.yml"),
      "utf-8",
    );
    const match = workflow.match(/VITE_SUPABASE_ANON_KEY:\s*([^\s]+)/);

    expect(match?.[1]).toBeTruthy();
    expect(match?.[1]).not.toBe("ci-placeholder-anon-key");
    const payload = JSON.parse(
      Buffer.from(match![1].split(".")[1], "base64url").toString("utf-8"),
    ) as { role?: string };
    expect(payload.role).toBe("anon");
  });

  it("předá produkční příznak i kroku desktop:compile", () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf-8"),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts["desktop:build"]).toContain(
      "&& cross-env ELECTRON_BUILD=true npm run desktop:compile",
    );
  });

  it("přibaluje pouze veřejné Vite hodnoty, nikdy privátní tokeny ani secrety", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts", "write-desktop-build-env.mjs"),
      "utf-8",
    );
    const publicKeys = extractDesktopPublicKeys(source);

    expect(publicKeys).toEqual([
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY",
      "VITE_GOOGLE_OAUTH_CLIENT_ID_DESKTOP",
    ]);
    expect(publicKeys.every((key) => key.startsWith("VITE_"))).toBe(true);
    expect(publicKeys.some((key) => /(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|TOKEN)/i.test(key))).toBe(false);
    expect(source).toContain("forbiddenPublicKeyPattern");
  });

  it("umožňuje podporovaný Supabase publishable klíč", () => {
    const scriptPath = join(process.cwd(), "scripts", "write-desktop-build-env.mjs");
    const testRoot = mkdtempSync(join(tmpdir(), "tf-desktop-env-"));
    try {
      const result = spawnSync(process.execPath, [scriptPath], {
        cwd: process.cwd(),
        encoding: "utf-8",
        env: {
          ...process.env,
          NODE_ENV: "test",
          DESKTOP_BUILD_ENV_TEST_ROOT: testRoot,
          CI: "true",
          ELECTRON_BUILD: "false",
          VITE_SUPABASE_URL: "https://example.supabase.co",
          VITE_SUPABASE_ANON_KEY: "sb_publishable_test_key",
        },
      });

      expect(result.status).toBe(0);
    } finally {
      rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it("ověří produkční klíč proti cílovému Supabase projektu", () => {
    const scriptPath = join(process.cwd(), "scripts", "write-desktop-build-env.mjs");
    const payload = Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url");
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      encoding: "utf-8",
      env: {
        ...process.env,
        CI: "false",
        ELECTRON_BUILD: "true",
        VITE_SUPABASE_URL: "http://127.0.0.1:1",
        VITE_SUPABASE_ANON_KEY: `header.${payload}.signature`,
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Invalid desktop build env: Supabase rejected the configured public key",
    );
  });

  it("umožňuje izolovat env soubory do dočasného testovacího kořene", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts", "write-desktop-build-env.mjs"),
      "utf-8",
    );

    expect(source).toContain("DESKTOP_BUILD_ENV_TEST_ROOT");
  });

  it("směruje index release notes na beta.17", () => {
    const releaseIndex = readFileSync(
      join(process.cwd(), "docs", "releases", "README.md"),
      "utf-8",
    );

    expect(releaseIndex).toContain(
      "Aktuální release notes: `release_notes_v1.9.0-beta.17.md`",
    );
  });

  it("zastaví produkční desktop build, pokud chybí Supabase public env", () => {
    const scriptPath = join(process.cwd(), "scripts", "write-desktop-build-env.mjs");
    const testRoot = mkdtempSync(join(tmpdir(), "tf-desktop-env-"));
    try {
      const result = spawnSync(process.execPath, [scriptPath], {
        cwd: process.cwd(),
        encoding: "utf-8",
        env: {
          ...process.env,
          NODE_ENV: "test",
          DESKTOP_BUILD_ENV_TEST_ROOT: testRoot,
          CI: "false",
          ELECTRON_BUILD: "true",
          VITE_SUPABASE_URL: "",
          VITE_SUPABASE_ANON_KEY: "",
        },
      });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(
        "Missing required desktop build env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY",
      );
    } finally {
      rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it("zastaví produkční desktop build, pokud je Supabase anon klíč poškozený zalomením", () => {
    const scriptPath = join(process.cwd(), "scripts", "write-desktop-build-env.mjs");
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      encoding: "utf-8",
      env: {
        ...process.env,
        CI: "false",
        ELECTRON_BUILD: "true",
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_ANON_KEY: "header.payload\n.signature",
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Invalid desktop build env: VITE_SUPABASE_ANON_KEY must be a single-line JWT",
    );
  });

  it("zastaví desktop build, pokud JWT nemá anon roli", () => {
    const scriptPath = join(process.cwd(), "scripts", "write-desktop-build-env.mjs");
    const payload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      encoding: "utf-8",
      env: {
        ...process.env,
        CI: "false",
        ELECTRON_BUILD: "true",
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_ANON_KEY: `header.${payload}.signature`,
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Invalid desktop build env: VITE_SUPABASE_ANON_KEY must have the anon role",
    );
  });
});
