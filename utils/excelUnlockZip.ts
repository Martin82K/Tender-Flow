import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

type ProgressReporter = (percent: number, label: string) => void;

export interface UnlockExcelZipResult {
  output: Uint8Array;
  worksheetCount: number;
}

const stripTag = (xml: string, tagName: string) => {
  const selfClosing = new RegExp(`<${tagName}\\b[^>]*\\/\\s*>`, "gi");
  const paired = new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, "gi");
  return xml.replace(selfClosing, "").replace(paired, "");
};

export const unlockExcelZipWithStats = async (
  input: ArrayBuffer,
  opts?: { onProgress?: ProgressReporter }
): Promise<UnlockExcelZipResult> => {
  const onProgress = opts?.onProgress;
  onProgress?.(5, "Rozbaluji Excel (ZIP)...");

  const zip = unzipSync(new Uint8Array(input));
  const allPaths = Object.keys(zip);
  const worksheetPaths = allPaths.filter((p) =>
    /^xl\/worksheets\/.+\.xml$/i.test(p)
  );

  if (worksheetPaths.length === 0) {
    throw new Error(
      "V souboru nebyly nalezeny worksheet XML soubory (xl/worksheets/*.xml)."
    );
  }

  let patchedCount = 0;
  for (const p of worksheetPaths) {
    const raw = zip[p];
    const xml = strFromU8(raw);
    const next = stripTag(xml, "sheetProtection");
    if (next !== xml) {
      zip[p] = strToU8(next);
    }
    patchedCount += 1;
    const percent = 5 + Math.round((patchedCount / worksheetPaths.length) * 55);
    onProgress?.(percent, `Odstraňuji ochranu listů (${patchedCount}/${worksheetPaths.length})...`);
    await new Promise((r) => setTimeout(r, 0));
  }

  // Keep changes minimal for best compatibility: do not rewrite other XML parts unless necessary.

  onProgress?.(80, "Zabaluji odemčený soubor...");

  // Office apps can be picky about entry order; keep common files first.
  const ordered: Record<string, Uint8Array> = {};
  const pushIf = (p: string) => {
    const v = (zip as any)[p] as Uint8Array | undefined;
    if (v) ordered[p] = v;
  };
  pushIf("[Content_Types].xml");
  pushIf("_rels/.rels");
  pushIf("xl/workbook.xml");
  pushIf("xl/_rels/workbook.xml.rels");

  const remaining = allPaths.filter((p) => !(p in ordered)).sort((a, b) => a.localeCompare(b));
  for (const p of remaining) {
    ordered[p] = zip[p];
  }

  const out = zipSync(ordered, { level: 6 });
  onProgress?.(95, "Připravuji stažení...");
  return {
    output: out,
    worksheetCount: worksheetPaths.length,
  };
};

export const unlockExcelZip = async (
  input: ArrayBuffer,
  opts?: { onProgress?: ProgressReporter }
): Promise<Uint8Array> => {
  const result = await unlockExcelZipWithStats(input, opts);
  return result.output;
};
