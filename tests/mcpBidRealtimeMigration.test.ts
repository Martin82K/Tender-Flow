import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260902074500_enable_bids_realtime.sql",
  ),
  "utf8",
);

describe("MCP bid Realtime migration", () => {
  it("publikuje bids idempotentně až po kontrole RLS", () => {
    expect(migration).toContain("relation.relrowsecurity");
    expect(migration).toContain("bids_rls_enabled IS DISTINCT FROM true");
    expect(migration).toContain("pg_catalog.pg_publication_tables");
    expect(migration).toContain(
      "ALTER PUBLICATION supabase_realtime ADD TABLE public.bids",
    );
  });

  it("blokuje přímý Realtime přístup legacy OAuth JWT", () => {
    expect(migration).toContain('CREATE POLICY "block_oauth_client_direct_access"');
    expect(migration).toContain("ON public.bids AS RESTRICTIVE");
    expect(migration).toContain("auth.jwt() ->> 'client_id'");
    expect(migration).toContain("auth.jwt() ->> 'azp'");
  });
});
