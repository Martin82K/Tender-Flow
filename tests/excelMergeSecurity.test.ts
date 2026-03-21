import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("excel merge security hardening", () => {
  it("web klient posílá access token místo anon key", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "services/excelMergerService.ts"),
      "utf8",
    );

    expect(source).toContain("const { data } = await supabase.auth.getSession();");
    expect(source).toContain("const accessToken = data.session?.access_token;");
    expect(source).toContain("'Authorization': `Bearer ${accessToken}`,");
    expect(source).not.toContain("'Authorization': `Bearer ${supabaseAnonKey}`,");
  });

  it("edge funkce vyžaduje auth a omezuje upload vstupy", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "supabase/functions/excel-merge/index.ts"),
      "utf8",
    );

    expect(source).toContain('const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;');
    expect(source).toContain("const MAX_SHEET_SELECTION = 50;");
    expect(source).toContain('if (req.method !== "POST") {');
    expect(source).toContain('if (!authHeader?.startsWith("Bearer ")) {');
    expect(source).toContain("const authed = createAuthedUserClient(req);");
    expect(source).toContain('if (!file.name.toLowerCase().endsWith(".xlsx")) {');
    expect(source).toContain("if (file.size > MAX_UPLOAD_SIZE_BYTES) {");
    expect(source).toContain("sheetsToInclude.length > MAX_SHEET_SELECTION");
  });
});
