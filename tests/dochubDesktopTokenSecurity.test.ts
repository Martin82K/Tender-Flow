import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("dochub desktop token permission hardening", () => {
  it("vyžaduje owner nebo share s edit oprávněním pro update projektu", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "supabase/functions/dochub-google-desktop-token/index.ts"),
      "utf8",
    );

    expect(source).toContain('.select("id, owner_id")');
    expect(source).toContain("let canUpdateProject = project.owner_id === null || project.owner_id === userData.user.id;");
    expect(source).toContain('"has_project_share_permission"');
    expect(source).toContain('required_permission: "edit"');
    expect(source).toContain('if (!canUpdateProject) return json(403, { error: "No edit access to project" });');
  });
});
