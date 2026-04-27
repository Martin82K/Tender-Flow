import { describe, expect, it } from "vitest";
import {
  calculateExpiresAt,
  generateOrderNumber,
  getAdditionalParam,
  getPlanAmount,
  getPlanDescription,
  getRecurrenceEndDate,
  getRecurrencePeriod,
  isValidPaymentId,
  shouldInitializeStartedAt,
} from "../supabase/functions/_shared/gopayHelpers.ts";

describe("gopayHelpers — getRecurrenceEndDate", () => {
  it("vrací datum ve formátu yyyy-MM-dd", () => {
    const result = getRecurrenceEndDate(new Date("2026-04-27T12:00:00Z"));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("vrací datum +10 let od daného now", () => {
    const result = getRecurrenceEndDate(new Date("2026-04-27T12:00:00Z"));
    expect(result).toBe("2036-04-27");
  });

  it("zůstává pod GoPay limitem 2099-12-31 i pro pozdější základ", () => {
    const result = getRecurrenceEndDate(new Date("2080-01-15T00:00:00Z"));
    expect(result <= "2099-12-31").toBe(true);
  });

  it("default parametr odpovídá aktuálnímu času (smoke)", () => {
    const result = getRecurrenceEndDate();
    const expectedYear = new Date().getUTCFullYear() + 10;
    expect(result.startsWith(String(expectedYear))).toBe(true);
  });
});

describe("gopayHelpers — getRecurrencePeriod", () => {
  it("monthly = 1", () => {
    expect(getRecurrencePeriod("monthly")).toBe(1);
  });

  it("yearly = 12 (cyklus MONTH × 12 měsíců)", () => {
    expect(getRecurrencePeriod("yearly")).toBe(12);
  });
});

describe("gopayHelpers — generateOrderNumber", () => {
  it("vytváří unikátní strings při každém volání", () => {
    const a = generateOrderNumber("TF", "abcdef0123456789", "pro");
    const b = generateOrderNumber("TF", "abcdef0123456789", "pro");
    expect(a).not.toBe(b);
  });

  it("zkracuje idHint na max 8 znaků", () => {
    const result = generateOrderNumber(
      "TF",
      "abcdef0123456789",
      "starter",
      () => "00000000-0000-0000-0000-000000000000",
    );
    expect(result).toBe("TF-abcdef01-starter-000000000000");
  });

  it("podporuje TF-ORG prefix", () => {
    const result = generateOrderNumber(
      "TF-ORG",
      "org12345extra",
      "pro",
      () => "11111111-2222-3333-4444-555555555555",
    );
    expect(result).toBe("TF-ORG-org12345-pro-111111112222");
  });

  it("akceptuje prázdný idHint bez pádu", () => {
    const result = generateOrderNumber(
      "TF",
      "",
      "pro",
      () => "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    );
    expect(result).toBe("TF--pro-aaaaaaaabbbb");
  });
});

describe("gopayHelpers — isValidPaymentId", () => {
  it.each([
    ["1", true],
    ["12345678901234567890", true],
    ["3000000123", true],
    ["", false],
    [null, false],
    [undefined, false],
    ["abc", false],
    ["123abc", false],
    ["-123", false],
    ["12.5", false],
    ["123 ", false],
    ["123456789012345678901", false], // 21 cifer = nad limitem
  ])("isValidPaymentId(%p) === %p", (input, expected) => {
    expect(isValidPaymentId(input as string | null | undefined)).toBe(expected);
  });
});

describe("gopayHelpers — getPlanAmount", () => {
  it("starter monthly = 39900 haléřů (399 Kč)", () => {
    expect(getPlanAmount("starter", "monthly")).toBe(39900);
  });

  it("pro yearly = 479000 haléřů (4790 Kč)", () => {
    expect(getPlanAmount("pro", "yearly")).toBe(479000);
  });

  it("enterprise vrací 0 (custom pricing)", () => {
    expect(getPlanAmount("enterprise", "monthly")).toBe(0);
  });
});

describe("gopayHelpers — getPlanDescription", () => {
  it("monthly = 'měsíční'", () => {
    expect(getPlanDescription("starter", "monthly")).toBe(
      "Tender Flow Starter (měsíční)",
    );
  });

  it("yearly = 'roční'", () => {
    expect(getPlanDescription("pro", "yearly")).toBe(
      "Tender Flow Pro (roční)",
    );
  });
});

describe("gopayHelpers — getAdditionalParam", () => {
  const params = [
    { name: "userId", value: "u-1" },
    { name: "tier", value: "pro" },
  ];

  it("vrací hodnotu pro existující klíč", () => {
    expect(getAdditionalParam(params, "tier")).toBe("pro");
  });

  it("vrací undefined pro neexistující klíč", () => {
    expect(getAdditionalParam(params, "missing")).toBeUndefined();
  });

  it("zvládá undefined params", () => {
    expect(getAdditionalParam(undefined, "userId")).toBeUndefined();
  });
});

describe("gopayHelpers — calculateExpiresAt", () => {
  it("monthly = +1 měsíc od now", () => {
    const result = calculateExpiresAt("monthly", new Date("2026-04-27T12:00:00Z"));
    expect(result.toISOString()).toBe("2026-05-27T12:00:00.000Z");
  });

  it("yearly = +1 rok od now", () => {
    const result = calculateExpiresAt("yearly", new Date("2026-04-27T12:00:00Z"));
    expect(result.toISOString()).toBe("2027-04-27T12:00:00.000Z");
  });

  it("nemutuje vstupní `now` Date", () => {
    const now = new Date("2026-04-27T12:00:00Z");
    calculateExpiresAt("monthly", now);
    expect(now.toISOString()).toBe("2026-04-27T12:00:00.000Z");
  });

  it("neznámý period defaultuje na monthly (defenzivní)", () => {
    const result = calculateExpiresAt("weird" as never, new Date("2026-04-27T12:00:00Z"));
    expect(result.toISOString()).toBe("2026-05-27T12:00:00.000Z");
  });
});

describe("gopayHelpers — shouldInitializeStartedAt", () => {
  it("active + null existing → true (první předplatné)", () => {
    expect(shouldInitializeStartedAt("active", null)).toBe(true);
  });

  it("active + undefined existing → true", () => {
    expect(shouldInitializeStartedAt("active", undefined)).toBe(true);
  });

  it("active + již nastavené datum → false (zachovat původní)", () => {
    expect(
      shouldInitializeStartedAt("active", "2025-01-15T00:00:00Z"),
    ).toBe(false);
  });

  it("cancelled + cokoliv → false (jen u active iniciujeme)", () => {
    expect(shouldInitializeStartedAt("cancelled", null)).toBe(false);
    expect(shouldInitializeStartedAt("cancelled", "2025-01-15T00:00:00Z")).toBe(false);
  });

  it("expired + null → false (vypršelé subscription neinicializuje začátek)", () => {
    expect(shouldInitializeStartedAt("expired", null)).toBe(false);
  });
});
