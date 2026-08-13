import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("dochub oauth flow project access hardening", () => {
  it("v auth-url a callbackcich vyzaduje vlastnika projektu", () => {
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
    expect(authUrlSource).toContain('.select("id, owner_id")');
    expect(authUrlSource).toContain('return json(req, 403, { error: "Forbidden" });');
    expect(authUrlSource).toContain('return json(req, 403, { error: "Project owner permission required" });');

    for (const source of [googleCallbackSource, microsoftCallbackSource]) {
      expect(source).toContain('.select("id, owner_id")');
      expect(source).toContain("!project.owner_id || project.owner_id !== stateRow.user_id");
      expect(source).toContain('withQueryParam(defaultReturnTo(), "dochub_error", "forbidden_project")');
    }
    expect(googleCallbackSource).not.toContain('.from("project_shares")');
  });

  it("povoluje sdilenemu uzivateli pouze osobni read-only Microsoft OAuth", () => {
    const authUrlSource = fs.readFileSync(
      path.join(ROOT, "supabase/functions/dochub-auth-url/index.ts"),
      "utf8",
    );
    const microsoftCallbackSource = fs.readFileSync(
      path.join(ROOT, "supabase/functions/dochub-microsoft-callback/index.ts"),
      "utf8",
    );

    expect(authUrlSource).toContain('type AccessKind = "manage" | "personal_read"');
    expect(authUrlSource).toContain('accessKind === "personal_read"');
    expect(authUrlSource).toContain('.from("project_shares")');
    expect(authUrlSource).toContain('"Files.Read.All"');
    expect(authUrlSource).toContain("PERSONAL_READ_SCOPES");
    const personalScopes = authUrlSource.slice(
      authUrlSource.indexOf("const PERSONAL_READ_SCOPES"),
      authUrlSource.indexOf("const MICROSOFT_MANAGE_SCOPES"),
    );
    expect(personalScopes).not.toContain("ReadWrite");
    expect(personalScopes).not.toContain("Sites.");
    expect(microsoftCallbackSource).toContain('.from("project_shares")');
    expect(microsoftCallbackSource).toContain("access_kind: accessKind");
    expect(microsoftCallbackSource).toContain("skipProjectMutation");
  });

  it("uchovava osobni read token oddelene od vlastnikova spravcovskeho tokenu", () => {
    const migration = fs.readFileSync(
      path.join(ROOT, "supabase/migrations/20260813151843_add_dochub_personal_read_tokens.sql"),
      "utf8",
    );
    const tokenSource = fs.readFileSync(
      path.join(ROOT, "supabase/functions/_shared/tokens.ts"),
      "utf8",
    );

    expect(migration).toContain("access_kind TEXT NOT NULL DEFAULT 'manage'");
    expect(migration).toContain("PRIMARY KEY (user_id, provider, access_kind)");
    expect(tokenSource).toContain('accessKind?: "manage" | "personal_read"');
    expect(tokenSource).toContain('.eq("access_kind", accessKind)');
  });

  it("stav a odpojeni osobniho Microsoft uctu jsou omezeny na aktualniho uzivatele", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "supabase/functions/dochub-personal-microsoft/index.ts"),
      "utf8",
    );

    expect(source).toContain("authed.auth.getUser()");
    expect(source).toContain('.from("project_shares")');
    expect(source).toContain('.eq("user_id", userData.user.id)');
    expect(source).toContain('.eq("access_kind", "personal_read")');
    expect(source).toContain('.select("user_id")');
    expect(source).not.toContain('select("token_ciphertext")');
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
