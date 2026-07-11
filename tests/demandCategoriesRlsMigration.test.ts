import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260711201151_harden_demand_categories_rls.sql",
  ),
  "utf8",
);

describe("demand categories RLS hardening migration", () => {
  it("odstraňuje všechny známé permisivní a legacy politiky", () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Enable all access for authenticated users"',
    );
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Users can manage their project categories"',
    );
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Categories inherit project access"',
    );
    expect(migration).not.toMatch(/USING\s*\(\s*true\s*\)/i);
    expect(migration).not.toMatch(/WITH CHECK\s*\(\s*true\s*\)/i);
  });

  it("vytváří čtyři oddělené authenticated CRUD politiky", () => {
    const policies = migration.split("CREATE POLICY").slice(1);

    expect(policies).toHaveLength(4);
    expect(policies.map((policy) => policy.match(/FOR (SELECT|INSERT|UPDATE|DELETE)/)?.[1])).toEqual([
      "SELECT",
      "INSERT",
      "UPDATE",
      "DELETE",
    ]);
    for (const policy of policies) {
      expect(policy).toContain("TO authenticated");
    }
  });

  it("povoluje čtení vlastníkovi, explicitnímu share a viditelnému demo projektu", () => {
    const selectPolicy = migration.split("CREATE POLICY")[1];

    expect(selectPolicy).toContain("p.owner_id = (SELECT auth.uid())");
    expect(selectPolicy).toContain("public.is_project_shared_with_user");
    expect(selectPolicy).toContain("p.is_demo = true");
    expect(selectPolicy).toContain("public.user_hidden_projects");
  });

  it("povoluje zápis pouze vlastníkovi projektu nebo explicitnímu editorovi", () => {
    const writePolicies = migration.split("CREATE POLICY").slice(2);

    for (const policy of writePolicies) {
      expect(policy).toContain("p.owner_id = (SELECT auth.uid())");
      expect(policy).toContain(
        "public.has_project_share_permission(p.id, (SELECT auth.uid()), 'edit')",
      );
    }

    const updatePolicy = writePolicies[1];
    expect(updatePolicy).toContain("USING");
    expect(updatePolicy).toContain("WITH CHECK");
  });

  it("omezuje tabulkové grants a indexuje project_id", () => {
    expect(migration).toContain("REVOKE ALL ON TABLE public.demand_categories FROM anon");
    expect(migration).toContain("REVOKE ALL ON TABLE public.demand_categories FROM authenticated");
    expect(migration).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.demand_categories TO authenticated",
    );
    expect(migration).toContain(
      "CREATE INDEX IF NOT EXISTS idx_demand_categories_project_id",
    );
  });
});
