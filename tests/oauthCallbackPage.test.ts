import { describe, expect, it } from "vitest";

import {
  OAUTH_CALLBACK_CONTENT_TYPE,
  buildOAuthCallbackPage,
} from "../desktop/main/ipc/modules/oauthCallbackPage";

describe("desktop OAuth callback page", () => {
  it("deklaruje UTF-8 a zobrazí správnou českou zprávu po úspěchu", () => {
    const html = buildOAuthCallbackPage("success");

    expect(OAUTH_CALLBACK_CONTENT_TYPE).toBe("text/html; charset=utf-8");
    expect(html).toContain('<html lang="cs">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain("Přihlášení dokončeno");
    expect(html).toContain("Toto okno můžete zavřít.");
  });

  it("při chybě nezobrazuje falešné potvrzení o dokončení", () => {
    const html = buildOAuthCallbackPage("error");

    expect(html).toContain("Přihlášení se nepodařilo");
    expect(html).toContain("Vraťte se do Tender Flow a zkuste to znovu.");
    expect(html).not.toContain("Přihlášení dokončeno");
  });
});
