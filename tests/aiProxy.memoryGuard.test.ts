import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ai-proxy memory authorization guard", () => {
  it("vyzaduje explicitni view/edit autorizaci pred storage operacemi", () => {
    const source = readFileSync(
      resolve(process.cwd(), "supabase/functions/ai-proxy/index.ts"),
      "utf-8",
    );

    const accessCheckIndex = source.indexOf("resolveAuthorizedProjectMemoryContext(");
    const storagePathIndex = source.indexOf("const storagePath =");
    const downloadIndex = source.indexOf(".download(storagePath)");
    const uploadIndex = source.indexOf(".upload(storagePath");

    expect(accessCheckIndex).toBeGreaterThan(-1);
    expect(storagePathIndex).toBeGreaterThan(accessCheckIndex);
    expect(downloadIndex).toBeGreaterThan(accessCheckIndex);
    expect(uploadIndex).toBeGreaterThan(accessCheckIndex);
    expect(source).toContain("action === \"memory-save\" ? \"edit\" : \"view\"");
  });
});
