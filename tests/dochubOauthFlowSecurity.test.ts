import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("dochub oauth flow project access hardening", () => {
  it("v auth-url a callbackcich overuje pristup k projektu", () => {
    const authUrlSource = fs.readFileSync(
      path.join(ROOT, "supabase/functions/dochub-auth-url/index.ts"),
      "utf8",
    );
    const googleCallbackSource = fs.readFileSync(
      path.join(ROOT, "supabase/functions/dochub-google-callback/index.ts"),
      "utf8",
    );
    const microsoftCallbackSource = fs.readFileSync(
      path.join(ROOT, "supabase/functions/dochub-microsoft-callback/index.ts"),
      "utf8",
    );

    expect(authUrlSource).toContain('.from("projects")');
    expect(authUrlSource).toContain('.select("id")');
    expect(authUrlSource).toContain('return json(403, { error: "Forbidden" });');

    for (const source of [googleCallbackSource, microsoftCallbackSource]) {
      expect(source).toContain('.select("id, owner_id")');
      expect(source).toContain('.from("project_shares")');
      expect(source).toContain('.eq("permission", "edit")');
      expect(source).toContain('return redirect(withQueryParam(defaultReturnTo(), "dochub_error", "forbidden_project"));');
    }
  });
});
