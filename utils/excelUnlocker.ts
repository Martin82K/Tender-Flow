import * as XLSX from "xlsx";
import path from "node:path";
import { access, readFile, writeFile } from "node:fs/promises";
import { unlockWorkbook } from "./excelUnlockerShared";

/**
 * Unlocks sheet protection in an Excel workbook by removing SheetJS `!protect` metadata from each sheet.
 * Saves the resulting workbook as `.xlsm` (macro-enabled) to make it clear the file may contain macros
 * (macros are preserved if present; this does not add VBA).
 */
export const unlockExcel = async (
  inputPath: string,
  outputPath: string
): Promise<void> => {
  console.log(`[excelUnlocker] input=${inputPath}`);
  console.log(`[excelUnlocker] output=${outputPath}`);

  try {
    await access(inputPath);
  } catch {
    throw new Error(`Soubor neexistuje nebo není přístupný: ${inputPath}`);
  }

  const normalizedOutputPath = (() => {
    const parsed = path.parse(outputPath);
    if (parsed.ext.toLowerCase() === ".xlsm") return outputPath;
    return path.join(parsed.dir, `${parsed.name}.xlsm`);
  })();

  console.log("[excelUnlocker] reading workbook...");
  const buffer = await readFile(inputPath);
  const workbook = XLSX.read(buffer, { type: "buffer", bookVBA: true });

  console.log("[excelUnlocker] unlocking sheets...");
  unlockWorkbook(workbook);

  console.log("[excelUnlocker] writing workbook...");
  const outBuffer = XLSX.write(workbook, {
    bookType: "xlsm",
    type: "buffer",
    bookVBA: true,
    // Prefer Shared String Table to avoid huge inline string XML and keep ZIP compression enabled.
    bookSST: true,
    compression: true,
  }) as Buffer;

  await writeFile(normalizedOutputPath, outBuffer);
  console.log(`[excelUnlocker] done: ${normalizedOutputPath}`);
};

/**
 * Example usage:
 *
 * import { unlockExcel } from "./utils/excelUnlocker";
 *
 * await unlockExcel(
 *   "/path/to/input.xlsx",
 *   "/path/to/output.xlsm" // extension is enforced to .xlsm
 * );
 */
