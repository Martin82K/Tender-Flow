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
});
