import { describe, expect, it } from "vitest";
import {
  sanitizeLogValue,
  summarizeErrorForLog,
} from "../shared/security/logSanitizer";

describe("logSanitizer", () => {
  it("rediguje citlivé hodnoty v objektech", () => {
    const result = sanitizeLogValue({
      email: "john@example.com",
      apiKey: "super-secret",
      nested: {
        authorization: "Bearer abc.def.ghi",
      },
    });

    expect(JSON.stringify(result)).toContain("[redacted-email]");
    expect(JSON.stringify(result)).toContain("[redacted]");
    expect(JSON.stringify(result)).not.toContain("super-secret");
    expect(JSON.stringify(result)).not.toContain("abc.def.ghi");
  });

  it("shrnutí chyby rediguje tokeny a e-maily", () => {
    const error = new Error("Kontakt john@example.com token Bearer abc.def.ghi");
    error.stack = "authorization=supersecret";

    const result = summarizeErrorForLog(error);
    const serialized = JSON.stringify(result);

    expect(serialized).toContain("[redacted-email]");
    expect(serialized).toContain("[redacted-token]");
    expect(serialized).not.toContain("john@example.com");
    expect(serialized).not.toContain("supersecret");
  });
});
