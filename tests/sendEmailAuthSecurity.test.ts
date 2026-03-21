import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("send-email authentication hardening", () => {
  it("ověřuje bearer token přes Supabase getUser", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "supabase/functions/send-email/index.ts"),
      "utf8",
    );

    expect(source).toContain(
      'import { createClient } from "https://esm.sh/@supabase/supabase-js@2";',
    );
    expect(source).toContain('const SUPABASE_URL = Deno.env.get("SUPABASE_URL");');
    expect(source).toContain('const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");');
    expect(source).toContain('if (!authHeader.startsWith("Bearer ")) {');
    expect(source).toContain("const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {");
    expect(source).toContain("Authorization: authHeader,");
    expect(source).toContain("const { data: userData, error: userError } = await supabase.auth.getUser();");
    expect(source).toContain('JSON.stringify({ error: "Unauthorized" })');
  });
});
