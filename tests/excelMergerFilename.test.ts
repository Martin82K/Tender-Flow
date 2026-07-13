import { buildExcelMergerOutputFilename } from "@/features/settings/model";

describe("buildExcelMergerOutputFilename", () => {
  it("uses the Czech _spojeno suffix", () => {
    expect(buildExcelMergerOutputFilename("rozpocet.xlsx")).toBe(
      "rozpocet_spojeno.xlsx",
    );
    expect(buildExcelMergerOutputFilename("ROZPOCET.XLSX")).toBe(
      "ROZPOCET_spojeno.xlsx",
    );
  });

  it("uses a safe fallback for an empty base name", () => {
    expect(buildExcelMergerOutputFilename(".xlsx")).toBe("excel_spojeno.xlsx");
  });
});
