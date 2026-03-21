import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("dochub autocreate permission hardening", () => {
  it("vyzaduje ownera nebo share s edit opravnenim", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "supabase/functions/dochub-autocreate/index.ts"),
      "utf8",
    );

    expect(source).toContain('"id, owner_id, dochub_enabled, dochub_status, dochub_provider, dochub_root_id, dochub_drive_id, dochub_structure_v1"');
    expect(source).toContain("const isOwner = project.owner_id === userData.user.id;");
    expect(source).toContain('.from("project_shares")');
    expect(source).toContain('.eq("permission", "edit")');
    expect(source).toContain('return json(403, { error: "Edit permission required" });');
  });
});
