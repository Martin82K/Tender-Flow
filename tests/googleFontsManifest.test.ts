import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

describe("Google Fonts manifest", () => {
  it("requests Inter as a variable weight range to avoid stale fixed-weight manifests", () => {
    const html = readFileSync(resolve(root, "index.html"), "utf8");

    expect(html).toContain("family=Inter:wght@400..900");
    expect(html).not.toContain("family=Inter:wght@400;500;600;700;800;900");
  });
});
