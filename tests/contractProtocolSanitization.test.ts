import { describe, expect, it } from "vitest";

import {
  sanitizeExcelCellText,
  sanitizeProtocolFileName,
} from "@/features/projects/model/contractProtocolUtils";

describe("contract protocol sanitization", () => {
  it("prefixuje rizikové excel výrazy apostrofem", () => {
    expect(sanitizeExcelCellText("=1+1")).toBe("'=1+1");
    expect(sanitizeExcelCellText("+1")).toBe("'+1");
    expect(sanitizeExcelCellText("-cmd")).toBe("'-cmd");
    expect(sanitizeExcelCellText("@SUM(A1:A2)")).toBe("'@SUM(A1:A2)");
    expect(sanitizeExcelCellText("  =2+2")).toBe("'  =2+2");
  });

  it("neprefixuje bezpečný text", () => {
    expect(sanitizeExcelCellText("Stavba Aš")).toBe("Stavba Aš");
  });

  it("sanitizuje filename pro bezpečné uložení", () => {
    expect(sanitizeProtocolFileName("Předání díla: VZT?.xlsx")).toBe(
      "predani_dila_vzt_.xlsx",
    );
    expect(sanitizeProtocolFileName("../../hack")).toBe("hack.xlsx");
  });
});
