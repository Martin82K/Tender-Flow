// @vitest-environment node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("public HTML prerender", () => {
  it("gives legal pages their own identity without homepage-only product or FAQ schemas", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tf-aeo-prerender-"));
    try {
      fs.mkdirSync(path.join(root, "scripts"));
      fs.mkdirSync(path.join(root, "dist"));
      fs.copyFileSync("scripts/prerender-public.mjs", path.join(root, "scripts/prerender-public.mjs"));
      fs.copyFileSync("index.html", path.join(root, "dist/index.html"));
      execFileSync(process.execPath, [path.join(root, "scripts/prerender-public.mjs")], {
        env: { ...process.env, ELECTRON_BUILD: "false" },
      });
      for (const route of ["terms", "privacy", "cookies", "dpa", "imprint"]) {
        const html = fs.readFileSync(path.join(root, "dist", route, "index.html"), "utf8");
        const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
          .map((match) => JSON.parse(match[1]));
        expect(schemas.map((schema) => schema["@type"])).toEqual([
          "Organization", "WebSite", "BreadcrumbList", "WebPage",
        ]);
        expect(html).toContain(`rel="canonical" href="https://www.tenderflow.cz/${route}"`);
        expect(schemas.find((schema) => schema["@type"] === "WebPage").url)
          .toBe(`https://www.tenderflow.cz/${route}`);
        expect(html).not.toContain("Časté otázky");
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
