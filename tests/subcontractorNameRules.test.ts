import { describe, expect, it } from "vitest";
import {
  sanitizeSubcontractorCompanyName,
  validateSubcontractorCompanyName,
} from "../shared/dochub/subcontractorNameRules";

describe("subcontractorNameRules", () => {
  it("accepts valid company names including diacritics", () => {
    expect(validateSubcontractorCompanyName("Strechy Praha s.r.o").isValid).toBe(true);
    expect(validateSubcontractorCompanyName("České Stavby a.s").isValid).toBe(true);
  });

  it("rejects forbidden characters", () => {
    const result = validateSubcontractorCompanyName("ACME/Group");
    expect(result.isValid).toBe(false);
    expect(result.code).toBe("FORBIDDEN_CHARACTER");
  });

  it("rejects leading or trailing spaces", () => {
    expect(validateSubcontractorCompanyName(" ACME").isValid).toBe(false);
    expect(validateSubcontractorCompanyName("ACME ").isValid).toBe(false);
  });

  it("rejects leading or trailing dot", () => {
    expect(validateSubcontractorCompanyName(".ACME").isValid).toBe(false);
    expect(validateSubcontractorCompanyName("ACME.").isValid).toBe(false);
  });

  it("rejects names starting with double dot", () => {
    const result = validateSubcontractorCompanyName("..ACME");
    expect(result.isValid).toBe(false);
    expect(result.code).toBe("LEADING_DOUBLE_DOT");
  });

  it("rejects reserved windows names", () => {
    expect(validateSubcontractorCompanyName("CON").isValid).toBe(false);
    expect(validateSubcontractorCompanyName("con.txt").isValid).toBe(false);
  });

  it("sanitizes forbidden and reserved names deterministically", () => {
    const result = sanitizeSubcontractorCompanyName("..CON?.txt ");
    expect(result.sanitized).toBe("CON_.txt");
    expect(result.changed).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("uses fallback when sanitized value becomes empty", () => {
    const result = sanitizeSubcontractorCompanyName("...");
    expect(result.sanitized).toBe("Neznamy_dodavatel");
  });
});
