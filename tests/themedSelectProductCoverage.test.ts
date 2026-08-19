import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const productRoots = ["app", "components", "features", "shared"];

const collectTsxFiles = (root: string): string[] => {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(path);
    return entry.isFile() && path.endsWith(".tsx") ? [path] : [];
  });
};

describe("sjednocený skin rozbalovacích prvků", () => {
  it("nepoužívá v produktovém UI nativní select", () => {
    const offenders = productRoots
      .flatMap(collectTsxFiles)
      .filter((file) => readFileSync(file, "utf8").includes("<select"));

    expect(offenders).toEqual([]);
  });
});
