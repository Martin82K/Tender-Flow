import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260711182852_secure_contract_vendor_rating.sql",
);

describe("contract vendor rating RPC security", () => {
  it("derives audit metadata from auth.uid under existing RLS", () => {
    const migration = fs.readFileSync(migrationPath, "utf8");

    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.update_contract_vendor_rating",
    );
    expect(migration).toContain("SECURITY INVOKER");
    expect(migration).not.toContain("SECURITY DEFINER");
    expect(migration).toContain("vendor_rating_by = CASE");
    expect(migration).toContain("THEN auth.uid()");
    expect(migration).toContain("vendor_rating_at = CASE");
    expect(migration).toContain("THEN NOW()");
    expect(migration).toContain("GET DIAGNOSTICS affected_rows = ROW_COUNT");
    expect(migration).toContain("IF affected_rows <> 1 THEN");
  });

  it("restricts execution and validates the public payload", () => {
    const migration = fs.readFileSync(migrationPath, "utf8");

    expect(migration).toContain("auth.uid() IS NULL");
    expect(migration).toContain("rating_input < 0 OR rating_input > 5");
    expect(migration).toContain("REVOKE ALL ON FUNCTION");
    expect(migration).toContain("FROM anon");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION");
    expect(migration).toContain("TO authenticated");
  });
});
