import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const requestSource = fs.readFileSync(
  path.resolve("supabase/functions/request-password-reset/index.ts"),
  "utf8",
);
const confirmSource = fs.readFileSync(
  path.resolve("supabase/functions/confirm-password-reset/index.ts"),
  "utf8",
);

describe("password reset security", () => {
  it("nikdy neloguje raw reset odkaz a bez email konfigurace selže před vytvořením tokenu", () => {
    expect(requestSource).not.toContain("Logging link");
    expect(requestSource).not.toMatch(/console\.(?:log|warn|error)\([^\n]*resetLink/);

    const configCheckIndex = requestSource.indexOf("if (!RESEND_API_KEY");
    const tokenCreationIndex = requestSource.indexOf("crypto.randomUUID()");
    expect(configCheckIndex).toBeGreaterThan(-1);
    expect(tokenCreationIndex).toBeGreaterThan(configCheckIndex);
  });

  it("selže uzavřeně, když nelze ověřit rate limit", () => {
    expect(requestSource).toContain("if (rlError)");
    expect(requestSource).toContain("Failed to verify reset rate limit");
  });

  it("odstraní token, pokud se reset email nepodaří odeslat", () => {
    const resendCallIndex = requestSource.indexOf('fetch("https://api.resend.com/emails"');
    const cleanupIndex = requestSource.indexOf('.eq("token_hash", tokenHashHex)');

    expect(resendCallIndex).toBeGreaterThan(-1);
    expect(cleanupIndex).toBeGreaterThan(resendCallIndex);
    expect(requestSource).toContain("Failed to clean up an unsent reset token");
  });

  it("potvrzení atomicky označí token jako použitý před změnou hesla", () => {
    const claimIndex = confirmSource.indexOf('.update({ used_at: new Date().toISOString() })');
    const passwordUpdateIndex = confirmSource.indexOf("updateUserById");

    expect(claimIndex).toBeGreaterThan(-1);
    expect(confirmSource).toContain('.is("used_at", null)');
    expect(confirmSource).toContain('.gt("expires_at", new Date().toISOString())');
    expect(passwordUpdateIndex).toBeGreaterThan(claimIndex);
  });

  it("nevrací interní text výjimky klientovi", () => {
    expect(confirmSource).not.toMatch(/JSON\.stringify\(\{ error: error\.message \}\)/);
    expect(confirmSource).toContain('JSON.stringify({ error: "Interní chyba serveru" })');
  });
});
