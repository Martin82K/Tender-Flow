import { describe, expect, it } from "vitest";
import {
  redactSensitiveText,
  sanitizeLogText,
} from "@/shared/security/logSanitizer";

describe("logSanitizer", () => {
  it("rediguje e-mail, bearer token, jwt a refresh token", () => {
    const input =
      "Kontakt admin@example.com Bearer secret-token authorization=aaa refresh_token=bbb abcdefghijklmnopqrst.abcdefghijklmnopqrst.abcdefghijklmnopqrst";

    const output = redactSensitiveText(input);

    expect(output).toContain("[redacted-email]");
    expect(output).toContain("Bearer [redacted-token]");
    expect(output).toContain("authorization=[redacted-token]");
    expect(output).toContain("refresh_token=[redacted-token]");
    expect(output).toContain("[redacted-jwt]");
  });

  it("zkrátí text na maximální délku", () => {
    const output = sanitizeLogText("x".repeat(20), 10);
    expect(output).toBe("xxxxxxxxxx…");
  });
});
