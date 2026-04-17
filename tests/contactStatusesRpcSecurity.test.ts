import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("contact statuses RPC hardening", () => {
  it("odebírá authenticated execute z create_default_contact_statuses", () => {
    const migration = fs.readFileSync(
      path.join(
        ROOT,
        "supabase/migrations/20260321121500_revoke_authenticated_create_default_contact_statuses.sql",
      ),
      "utf8",
    );

    expect(migration).toContain(
      "REVOKE EXECUTE ON FUNCTION public.create_default_contact_statuses(UUID) FROM authenticated;",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.create_default_contact_statuses(UUID) TO service_role;",
    );
  });
});
