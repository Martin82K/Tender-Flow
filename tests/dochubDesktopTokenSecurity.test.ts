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

  it("overuje renderer-supplied Google token u provideru pred ulozenim", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "supabase/functions/dochub-google-desktop-token/index.ts"),
      "utf8",
    );

    expect(source).toContain("verifyGoogleDesktopToken");
    expect(source).toContain("https://oauth2.googleapis.com/tokeninfo");
    expect(source).toContain("https://openidconnect.googleapis.com/v1/userinfo");
    expect(source).toContain("getAllowedGoogleClientIds");
    expect(source).toContain("Google token audience mismatch");
    expect(source).toContain("Google token identity does not match signed-in user");
    expect(source).toContain("Google token missing required Drive scope");
    expect(source).toContain("refreshGoogleDesktopToken");
    expect(source).toContain("Google refresh token identity mismatch");
    expect(source).toContain('body.set("grant_type", "refresh_token")');
    expect(source).toContain("verifiedToken.scopes");
    expect(source).toContain("provider_subject");
    expect(source).toContain("provider_email");

    const verifyIndex = source.indexOf("let verifiedToken = await verifyGoogleDesktopToken");
    const upsertIndex = source.indexOf('await service.from("dochub_user_tokens").upsert');
    expect(verifyIndex).toBeGreaterThan(-1);
    expect(upsertIndex).toBeGreaterThan(-1);
    expect(verifyIndex).toBeLessThan(upsertIndex);
  });
});
