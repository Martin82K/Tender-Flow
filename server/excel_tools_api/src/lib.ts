import fs from "node:fs/promises";
import path from "node:path";
import { mergeExcelSheets } from "./merge";

export type ExcelMergerOptions = {
  inputPath: string;
  outputPath?: string;
  skipSheets?: string[];
  headerFillArgb?: string; // default FF366092
  sheetSeparatorFillArgb?: string; // default headerFillArgb
};

export class ExcelMerger {
  private options: ExcelMergerOptions;

  constructor(options: ExcelMergerOptions) {
    this.options = options;
  }

  async merge(): Promise<{ outputPath: string }> {
    const input = await fs.readFile(this.options.inputPath);
    const out = await mergeExcelSheets({
      input,
      skipSheets: this.options.skipSheets,
      headerFillArgb: this.options.headerFillArgb,
      sheetSeparatorFillArgb: this.options.sheetSeparatorFillArgb,
    });

    const outputPath =
      this.options.outputPath ??
      this.options.inputPath.replace(/\.xlsx$/i, "") + "_combined_final.xlsx";

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, out);
    return { outputPath };
  }
}

export const mergeExcelSheetsToFile = async (options: ExcelMergerOptions): Promise<{ outputPath: string }> => {
  const merger = new ExcelMerger(options);
  return await merger.merge();
};

