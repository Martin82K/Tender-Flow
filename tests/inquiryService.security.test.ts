import { describe, expect, it } from "vitest";
import { createMailtoLink, generateEmlContent } from "../services/inquiryService";

describe("inquiryService security", () => {
  it("strips CR/LF from mailto recipient and subject", () => {
    const link = createMailtoLink(
      "safe@example.com\r\nbcc:attacker@example.com",
      "Poptávka\r\nX-Test: injected",
      "Body",
    );

    expect(link).not.toContain("\r");
    expect(link).not.toContain("\n");
    expect(link).not.toContain("%0D");
    expect(link).not.toContain("%0A");
  });

  it("strips CR/LF from EML headers", () => {
    const eml = generateEmlContent(
      "safe@example.com\r\nbcc:attacker@example.com",
      "Poptávka\r\nX-Test: injected",
      "<p>Body</p>",
    );

    const headers = eml.split("\r\n").slice(0, 3).join("\r\n");
    expect(headers).toContain("To: safe@example.combcc:attacker@example.com");
    expect(headers).not.toContain("\nX-Test:");
    expect(headers).not.toContain("\nbcc:");
  });

  it("sanitizuje BCC hlavičku v EML", () => {
    const eml = generateEmlContent(
      "safe@example.com",
      "Poptávka",
      "<p>Body</p>",
      {
        bcc: "a@example.com\r\nbcc:attacker@example.com",
      },
    );

    const headers = eml.split("\r\n").slice(0, 4).join("\r\n");
    expect(headers).toContain("Bcc: a@example.combcc:attacker@example.com");
    expect(headers).not.toContain("\nbcc:");
  });

  it("vloží EML přílohu jako multipart/mixed bez injekce v názvu souboru", () => {
    const eml = generateEmlContent("safe@example.com", "Poptávka", "<p>Body</p>", {
      attachments: [
        {
          filename: "rozpocet.xlsx\r\nBcc: attacker@example.com",
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          base64Content: "YWJj",
        },
      ],
    });

    expect(eml).toContain('Content-Type: multipart/mixed; boundary="boundary_string_123456789_mixed"');
    expect(eml).toContain("Content-Disposition: attachment");
    expect(eml).toContain("rozpocet.xlsxBcc_ attacker@example.com");
    expect(eml).not.toContain("\r\nBcc: attacker@example.com");
  });
});
