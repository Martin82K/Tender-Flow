import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("DocHub shared cloud links", () => {
  it("returns an authorized cached top-level web URL before requesting a user OAuth token", () => {
    const source = fs.readFileSync(
      path.join(repoRoot, "supabase/functions/dochub-get-link/index.ts"),
      "utf8",
    );

    const cachedLookupIndex = source.indexOf("getCachedFolderForRequest");
    const cachedReturnIndex = source.indexOf("cachedFolder.web_url");
    const tokenLookupIndex = source.indexOf("await getAccessTokenForUser", cachedReturnIndex);

    expect(cachedLookupIndex).toBeGreaterThan(-1);
    expect(cachedReturnIndex).toBeGreaterThan(cachedLookupIndex);
    expect(tokenLookupIndex).toBeGreaterThan(cachedReturnIndex);
  });

  it("normalizes top-level cache keys to a non-null value", () => {
    const source = fs.readFileSync(
      path.join(repoRoot, "supabase/functions/dochub-get-link/index.ts"),
      "utf8",
    );

    expect(source).toContain("key: normalizeFolderKey(args.key)");
    expect(source).toContain('.eq("key", normalizeFolderKey(args.key))');
  });

  it("returns cached inquiry and supplier links before requiring OAuth", () => {
    const source = fs.readFileSync(
      path.join(repoRoot, "supabase/functions/dochub-get-link/index.ts"),
      "utf8",
    );
    const nestedCacheIndex = source.indexOf("getCachedFolderForRequest");
    const tokenIndex = source.indexOf("await getAccessTokenForUser", nestedCacheIndex);

    expect(source).toContain('`${categoryId}:inquiries`');
    expect(source).toContain('`${categoryId}:${supplierId}`');
    expect(nestedCacheIndex).toBeGreaterThan(-1);
    expect(tokenIndex).toBeGreaterThan(nestedCacheIndex);
  });

  it("falls back to the inquiry cache key written by dochub-autocreate", () => {
    const source = fs.readFileSync(
      path.join(repoRoot, "supabase/functions/dochub-get-link/index.ts"),
      "utf8",
    );

    expect(source).toContain("const legacyInquiry = await getStoredFolder");
    expect(source).toContain("key: categoryId,");
  });

  it("allows cache hits but rejects shared cache misses before OAuth or folder creation", () => {
    const source = fs.readFileSync(
      path.join(repoRoot, "supabase/functions/dochub-get-link/index.ts"),
      "utf8",
    );
    const cachedReturnIndex = source.indexOf("cachedFolder.web_url");
    const ownerGuardIndex = source.indexOf("project.owner_id !== userData.user.id", cachedReturnIndex);
    const tokenIndex = source.indexOf("await getAccessTokenForUser", cachedReturnIndex);
    const ensureIndex = source.indexOf("await ensureProjectFolder", cachedReturnIndex);

    expect(source).toContain("owner_id, dochub_provider");
    expect(ownerGuardIndex).toBeGreaterThan(cachedReturnIndex);
    expect(tokenIndex).toBeGreaterThan(ownerGuardIndex);
    expect(ensureIndex).toBeGreaterThan(ownerGuardIndex);
  });

  it("requires project ownership in every authenticated global mutation endpoint", () => {
    const endpoints = [
      "dochub-auth-url",
      "dochub-autocreate",
      "dochub-google-create-root",
      "dochub-google-desktop-token",
      "dochub-manage-folder",
      "dochub-resolve-root",
      "dochub-sync-category",
    ];

    for (const endpoint of endpoints) {
      const source = fs.readFileSync(
        path.join(repoRoot, `supabase/functions/${endpoint}/index.ts`),
        "utf8",
      );
      expect(source, endpoint).toContain("owner_id");
      expect(source, endpoint).toContain("Project owner permission required");
    }
  });

  it("rejects an OAuth callback when its state user is not the project owner", () => {
    for (const endpoint of ["dochub-google-callback", "dochub-microsoft-callback"]) {
      const source = fs.readFileSync(
        path.join(repoRoot, `supabase/functions/${endpoint}/index.ts`),
        "utf8",
      );
      expect(source, endpoint).toContain("!project.owner_id || project.owner_id !== stateRow.user_id");
    }
  });

  it("fails closed for ownerless projects in global mutation endpoints", () => {
    for (const endpoint of [
      "dochub-auth-url",
      "dochub-autocreate",
      "dochub-google-create-root",
      "dochub-google-desktop-token",
      "dochub-manage-folder",
      "dochub-resolve-root",
      "dochub-sync-category",
    ]) {
      const source = fs.readFileSync(
        path.join(repoRoot, `supabase/functions/${endpoint}/index.ts`),
        "utf8",
      );
      expect(source, endpoint).toMatch(/!\w+\.owner_id \|\| \w+\.owner_id !== userData\.user\.id/);
    }
  });
});
