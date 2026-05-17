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

  it("spotrebovava OAuth state atomicky pred token exchange a omezuje ho TTL", () => {
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

    expect(authUrlSource).toContain("OAUTH_STATE_TTL_MS");
    expect(authUrlSource).toContain("cleanupExpiredOAuthStates(service)");
    expect(authUrlSource).toContain('.delete().lt("created_at", oauthStateCutoffIso())');

    for (const source of [googleCallbackSource, microsoftCallbackSource]) {
      expect(source).toContain("consumeFreshOAuthState");
      expect(source).toContain(".delete()");
      expect(source).toContain('.gte("created_at", oauthStateCutoffIso())');
      expect(source).toContain('.select("*")');
      expect(source).toContain(".maybeSingle()");
      expect(source).toContain("state_not_found_or_expired");

      const consumeIndex = source.indexOf("consumeFreshOAuthState({");
      const tokenExchangeIndex = source.indexOf("const token = await tokenExchange");
      expect(consumeIndex).toBeGreaterThan(-1);
      expect(tokenExchangeIndex).toBeGreaterThan(-1);
      expect(consumeIndex).toBeLessThan(tokenExchangeIndex);
    }
  });

  it("vaze provider identitu na Supabase uzivatele pred ulozenim tokenu", () => {
    const googleCallbackSource = fs.readFileSync(
      path.join(ROOT, "supabase/functions/dochub-google-callback/index.ts"),
      "utf8",
    );
    const microsoftCallbackSource = fs.readFileSync(
      path.join(ROOT, "supabase/functions/dochub-microsoft-callback/index.ts"),
      "utf8",
    );
    const authUrlSource = fs.readFileSync(
      path.join(ROOT, "supabase/functions/dochub-auth-url/index.ts"),
      "utf8",
    );

    expect(authUrlSource).toContain('"openid"');
    expect(authUrlSource).toContain('"email"');
    expect(authUrlSource).toContain('"profile"');

    expect(googleCallbackSource).toContain("fetchGoogleTokenInfo");
    expect(googleCallbackSource).toContain("fetchGoogleUserInfo");
    expect(googleCallbackSource).toContain("OAuth provider audience mismatch");
    expect(googleCallbackSource).toContain("OAuth provider identity does not match signed-in user");
    expect(googleCallbackSource).toContain("service.auth.admin.getUserById(userId)");
    expect(googleCallbackSource).toContain("provider_subject");
    expect(googleCallbackSource).toContain("provider_email");

    expect(microsoftCallbackSource).toContain("decodeJwtPayload");
    expect(microsoftCallbackSource).toContain("fetchMicrosoftUserInfo");
    expect(microsoftCallbackSource).toContain("OAuth provider audience mismatch");
    expect(microsoftCallbackSource).toContain("OAuth provider identity does not match signed-in user");
    expect(microsoftCallbackSource).toContain("service.auth.admin.getUserById(userId)");
    expect(microsoftCallbackSource).toContain("provider_subject");
    expect(microsoftCallbackSource).toContain("provider_email");
  });
});
