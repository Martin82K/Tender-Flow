import { describe, expect, it } from "vitest";

import {
  formatChartAxis,
  formatInputNumber,
  formatMoney,
  formatMoneyShort,
  formatNumber,
} from "@/shared/formatting/numberFormatters";
import {
  formatChartAxis as legacyFormatChartAxis,
  formatInputNumber as legacyFormatInputNumber,
  formatMoney as legacyFormatMoney,
  formatMoneyShort as legacyFormatMoneyShort,
  formatNumber as legacyFormatNumber,
} from "@/utils/formatters";

describe("number formatters", () => {
  it("preserves exact Czech money and number formatting", () => {
    expect(formatMoney(1_234_567.89)).toBe("1 234 567,89 Kč");
    expect(formatMoney(Number.NaN)).toBe("-");
    expect(formatMoneyShort(1_500_000)).toBe("1,5M Kč");
    expect(formatMoneyShort(1_500)).toBe("2k Kč");
    expect(formatMoneyShort(999)).toBe("999,00 Kč");
    expect(formatNumber(1_234.5)).toBe("1 234,50");
    expect(formatNumber(Number.NaN)).toBe("-");
  });

  it("preserves input and chart formatting edge cases", () => {
    expect(formatInputNumber("1 234,5 Kč")).toBe("1 234,50");
    expect(formatInputNumber("invalid")).toBe("");
    expect(formatChartAxis(1_500_000)).toBe("1.5M");
    expect(formatChartAxis(1_500)).toBe("2k");
    expect(formatChartAxis(12)).toBe("12");
  });

  it("preserves every legacy export identity", () => {
    expect(legacyFormatMoney).toBe(formatMoney);
    expect(legacyFormatMoneyShort).toBe(formatMoneyShort);
    expect(legacyFormatNumber).toBe(formatNumber);
    expect(legacyFormatInputNumber).toBe(formatInputNumber);
    expect(legacyFormatChartAxis).toBe(formatChartAxis);
  });
});
