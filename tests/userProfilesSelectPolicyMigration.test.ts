import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("user_profiles select policy migration", () => {
  it("omezuje přímý SELECT jen na vlastní profil", () => {
    const migration = fs.readFileSync(
      path.join(ROOT, "supabase/migrations/20260321100000_restrict_user_profiles_select.sql"),
      "utf8",
    );

    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.user_profiles;',
    );
    expect(migration).toContain(
      'CREATE POLICY "Users can view own profile" ON public.user_profiles',
    );
    expect(migration).toContain("FOR SELECT USING (auth.uid() = user_id);");
    expect(migration).not.toContain("auth.role() = 'authenticated'");
  });
});
