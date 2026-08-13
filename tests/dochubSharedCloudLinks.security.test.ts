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

  it("scopes every cached folder to the current cloud root", () => {
    const getLinkSource = fs.readFileSync(
      path.join(repoRoot, "supabase/functions/dochub-get-link/index.ts"),
      "utf8",
    );
    const autoCreateSource = fs.readFileSync(
      path.join(repoRoot, "supabase/functions/dochub-autocreate/index.ts"),
      "utf8",
    );
    const syncCategorySource = fs.readFileSync(
      path.join(repoRoot, "supabase/functions/dochub-sync-category/index.ts"),
      "utf8",
    );
    const migration = fs.readFileSync(
      path.join(repoRoot, "supabase/migrations/20260807173642_scope_dochub_folder_cache_root.sql"),
      "utf8",
    );

    expect(getLinkSource).toContain("root_id: args.rootId");
    expect(getLinkSource).toContain('.eq("root_id", args.rootId)');
    expect(autoCreateSource).toContain("root_id: args.rootId");
    expect(syncCategorySource).toContain("root_id: args.rootId");
    expect(syncCategorySource).toContain('.eq("root_id", args.rootId)');
    expect(syncCategorySource).toContain('.eq("root_id", rootId)');
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS root_id TEXT");
    expect(migration).toContain("DELETE FROM public.dochub_project_folders");
    expect(migration).toContain("ALTER COLUMN root_id SET NOT NULL");
    expect(migration).toContain("PRIMARY KEY (project_id, provider, root_id, kind, key)");
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

  it("allows cache hits only to owners or explicitly shared users", () => {
    const source = fs.readFileSync(
      path.join(repoRoot, "supabase/functions/dochub-get-link/index.ts"),
      "utf8",
    );
    const cachedReturnIndex = source.indexOf("cachedFolder.web_url");
    const shareLookupIndex = source.indexOf('.from("project_shares")');
    const accessGuardIndex = source.indexOf("hasExplicitProjectShare", shareLookupIndex);
    const tokenIndex = source.indexOf("await getAccessTokenForUser", cachedReturnIndex);
    const ensureIndex = source.indexOf("await ensureProjectFolder", cachedReturnIndex);

    expect(source).toContain("owner_id, dochub_provider");
    expect(shareLookupIndex).toBeGreaterThan(-1);
    expect(source).toContain('.eq("user_id", userData.user.id)');
    expect(accessGuardIndex).toBeGreaterThan(shareLookupIndex);
    expect(cachedReturnIndex).toBeGreaterThan(accessGuardIndex);
    expect(tokenIndex).toBeGreaterThan(cachedReturnIndex);
    expect(ensureIndex).toBeGreaterThan(cachedReturnIndex);
  });

  it("recovers a URL-only cloud root only after explicit project authorization", () => {
    const source = fs.readFileSync(
      path.join(repoRoot, "supabase/functions/dochub-get-link/index.ts"),
      "utf8",
    );
    const shareGuardIndex = source.indexOf("if (!isProjectOwner && !hasExplicitProjectShare)");
    const recoveryIndex = source.indexOf("await recoverCloudDocHubConnection");

    expect(shareGuardIndex).toBeGreaterThan(-1);
    expect(recoveryIndex).toBeGreaterThan(shareGuardIndex);
    expect(source).toContain("getAccessTokenForUser,");
    expect(source).toContain("resolveMicrosoftSharingUrl,");
  });

  it("hydrates a shared-user cache miss read-only from owner storage using database names", () => {
    const handlerSource = fs.readFileSync(
      path.join(repoRoot, "supabase/functions/dochub-get-link/index.ts"),
      "utf8",
    );
    const recoverySource = fs.readFileSync(
      path.join(repoRoot, "supabase/functions/dochub-get-link/sharedFolderRecovery.ts"),
      "utf8",
    );

    expect(handlerSource).toContain("resolveSharedFolderLink");
    expect(handlerSource).toContain("ownerId: project.owner_id");
    expect(recoverySource).toContain("args.ownerId");
    expect(recoverySource).toContain('.from("demand_categories")');
    expect(recoverySource).toContain('.from("subcontractors")');
    expect(recoverySource).toContain('.eq("demand_category_id", categoryId)');
    expect(recoverySource).toContain('.select("subcontractor_id,company_name")');
    expect(recoverySource).toContain("findGoogleFolder");
    expect(recoverySource).toContain("findMicrosoftFolder");
    expect(recoverySource).not.toContain("categoryTitle?:");
    expect(recoverySource).not.toContain("supplierName?:");
  });

  it("hydrates a Microsoft cache miss with the shared user's personal read token", () => {
    const handlerSource = fs.readFileSync(
      path.join(repoRoot, "supabase/functions/dochub-get-link/index.ts"),
      "utf8",
    );
    const recoverySource = fs.readFileSync(
      path.join(repoRoot, "supabase/functions/dochub-get-link/sharedFolderRecovery.ts"),
      "utf8",
    );

    expect(handlerSource).toContain("requestingUserId: userData.user.id");
    expect(recoverySource).toContain("requestingUserId: string");
    expect(recoverySource).toContain('? "personal_read" : "manage"');
    expect(recoverySource).toContain("args.requestingUserId");
  });

  it("recovers every top-level shared folder without requiring a category", () => {
    const handlerSource = fs.readFileSync(
      path.join(repoRoot, "supabase/functions/dochub-get-link/index.ts"),
      "utf8",
    );
    const recoverySource = fs.readFileSync(
      path.join(repoRoot, "supabase/functions/dochub-get-link/sharedFolderRecovery.ts"),
      "utf8",
    );

    expect(handlerSource).toContain("SHARED_RECOVERABLE_KINDS.includes(kind)");
    expect(recoverySource).toContain("getBaseSharedFolderName(args.kind, args.structure)");
    expect(recoverySource).toContain("if (baseFolderName)");
    expect(recoverySource.indexOf("if (baseFolderName)")).toBeLessThan(
      recoverySource.indexOf('.from("demand_categories")'),
    );
  });

  it("recovers the legacy Google inquiry identity before returning 404", () => {
    const recoverySource = fs.readFileSync(
      path.join(repoRoot, "supabase/functions/dochub-get-link/sharedFolderRecovery.ts"),
      "utf8",
    );

    expect(recoverySource).toContain("const inquiryKeys = getInquiryIdentityKeys");
    expect(recoverySource).toContain("for (const inquiryKey of inquiryKeys)");
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
