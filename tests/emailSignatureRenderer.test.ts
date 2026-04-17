import { describe, expect, it } from "vitest";

import {
  appendSignatureToTemplate,
  buildEmailSignature,
  sanitizeEmailDisclaimerHtml,
} from "../shared/email/signature";

describe("email signature renderer", () => {
  it("složí plný HTML podpis včetně e-mailového loga", () => {
    const result = buildEmailSignature({
      profile: {
        displayName: "Martin Kalkuš",
        signatureName: "Martin Kalkuš",
        signatureRole: "technik přípravy staveb",
        signaturePhone: "+420 353 561 325",
        signaturePhoneSecondary: "+420 777 300 042",
        signatureEmail: "kalkus@baustav.cz",
        signatureGreeting: "S pozdravem",
      },
      branding: {
        emailLogoPath: "organizations/org-1/email-logo.png",
        emailLogoUrl: "https://cdn.example/email-logo.png",
        companyName: "BAU-STAV a.s.",
        companyAddress: "Loketská 344/12\n360 06 Karlovy Vary",
        companyMeta: "IČ: 147 05 877, DIČ: CZ 147 05 877",
        disclaimerHtml: "<p>Bezpečný disclaimer</p>",
        fontFamily: null,
        fontSize: null,
      },
    });

    expect(result.html).toContain("https://cdn.example/email-logo.png");
    expect(result.html).toContain("Martin Kalkuš");
    expect(result.html).toContain("BAU-STAV a.s.");
    expect(result.text).toContain("kalkus@baustav.cz");
    expect(result.isBrandingComplete).toBe(true);
  });

  it("funguje i bez loga a označí branding jako nekompletní", () => {
    const result = buildEmailSignature({
      profile: {
        displayName: "Martin Kalkuš",
        signatureName: "Martin Kalkuš",
        signatureRole: null,
        signaturePhone: null,
        signaturePhoneSecondary: null,
        signatureEmail: "kalkus@baustav.cz",
        signatureGreeting: "S pozdravem",
      },
      branding: {
        emailLogoPath: null,
        emailLogoUrl: null,
        companyName: "BAU-STAV a.s.",
        companyAddress: null,
        companyMeta: null,
        disclaimerHtml: null,
        fontFamily: null,
        fontSize: null,
      },
    });

    expect(result.html).not.toContain("<img");
    expect(result.isBrandingComplete).toBe(false);
  });

  it("sanitizuje disclaimer HTML", () => {
    const sanitized = sanitizeEmailDisclaimerHtml(
      `<p onclick="evil()">Text<script>alert(1)</script><a href="https://example.com" target="_blank">odkaz</a></p>`,
    );

    expect(sanitized).toContain("<p>");
    expect(sanitized).toContain("odkaz");
    expect(sanitized).not.toContain("script");
    expect(sanitized).not.toContain("onclick");
  });

  it("odmítne neplatné font nastavení a použije výchozí hodnoty", () => {
    const result = buildEmailSignature({
      profile: {
        displayName: "Martin Kalkuš",
        signatureName: "Martin Kalkuš",
        signatureRole: "technik přípravy staveb",
        signaturePhone: null,
        signaturePhoneSecondary: null,
        signatureEmail: "kalkus@baustav.cz",
        signatureGreeting: "S pozdravem",
      },
      branding: {
        emailLogoPath: null,
        emailLogoUrl: null,
        companyName: null,
        companyAddress: null,
        companyMeta: null,
        disclaimerHtml: null,
        fontFamily: `Arial";><img src=x onerror=alert(1)>`,
        fontSize: `16px";><img src=x onerror=alert(1)>`,
      },
    });

    expect(result.html).toContain(
      `style="margin-top:24px;font-family:Arial, Helvetica, sans-serif;color:#1f2937;"`,
    );
    expect(result.html).toContain(`style="font-size:16px;line-height:1.5;"`);
    expect(result.html).not.toContain("<img src=x onerror=alert(1)>");
  });

  it("doplní podpis na konec šablony jen pokud chybí placeholder", () => {
    expect(
      appendSignatureToTemplate("Dobrý den", "{PODPIS_UZIVATELE}", {
        format: "text",
      }),
    ).toBe("Dobrý den\n\n{PODPIS_UZIVATELE}");

    expect(
      appendSignatureToTemplate("Dobrý den\n{PODPIS_UZIVATELE}", "{PODPIS_UZIVATELE}", {
        format: "text",
      }),
    ).toBe("Dobrý den\n{PODPIS_UZIVATELE}");
  });
});
