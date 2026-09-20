import * as XLSX from 'xlsx';
import { Unzip, UnzipInflate } from 'fflate';
import { decimal, money, multiplyMoney, normalizeSearch } from './budgetModel';
import { detectBudgetLayout, globusIdentity, isGlobusColumnGuide } from './importProfiles';
import type { BudgetDocument, BudgetImportFormat, BudgetNode, BudgetSheet, FigureConflict, FigureSource, SourceCell } from './types';

export interface KrosSheetMapping { headerRow?: number; columns?: Record<string,number>; role?: BudgetSheet['role']; object?: string; title?: string; format?: BudgetImportFormat | 'auto' }
export type KrosMapping = Record<string,KrosSheetMapping>;
export const XLSX_LIMITS = { compressed: 30 * 1024 * 1024, expanded: 160 * 1024 * 1024, entry: 32 * 1024 * 1024, entries: 4000, sheets: 200, rows: 250000, columns: 512, text: 32768 };
/** Check actual streamed output sizes, not ZIP size declarations. Never execute macros/links. */
export function inspectXlsxArchive(input: Uint8Array | ArrayBuffer): void {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length > XLSX_LIMITS.compressed || bytes.length < 22 || bytes[0] !== 80 || bytes[1] !== 75) throw new Error('Neplatný XLSX nebo překročen limit 30 MB.');
  let total = 0; let entries = 0; let workbook = false; let contentTypes = false; const names = new Set<string>();
  const unzip = new Unzip(file => {
    if (++entries > XLSX_LIMITS.entries || names.has(file.name) || /(^\/|\.\.|\\)/.test(file.name)) throw new Error('Neplatná struktura ZIP.');
    names.add(file.name);
    if (/vbaProject|externalLinks|embeddings|activeX/i.test(file.name)) throw new Error('Makra, externí vazby a vložené objekty nejsou podporovány.');
    workbook ||= file.name === 'xl/workbook.xml'; contentTypes ||= file.name === '[Content_Types].xml';
    let size = 0;
    file.ondata = (error, data) => {
      if (error) throw error;
      size += data.length; total += data.length;
      if (size > XLSX_LIMITS.entry || total > XLSX_LIMITS.expanded) throw new Error('Rozbalený XLSX překročil bezpečnostní limit.');
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let i = 0; i < bytes.length; i += 16384) unzip.push(bytes.subarray(i, i + 16384), i + 16384 >= bytes.length);
  if (!workbook || !contentTypes) throw new Error('Soubor není sešit XLSX.');
}
const text = (v: unknown) => v === undefined || v === null ? '' : String(v);
export function parseKrosWorkbook(workbook: XLSX.WorkBook, progress?: (done: number, total: number) => void, overrides: KrosMapping = {}): BudgetDocument {
  if (workbook.SheetNames.length > XLSX_LIMITS.sheets) throw new Error('Příliš mnoho listů.');
  const document: BudgetDocument = { schemaVersion: 1, sheets: [], nodes: [], issues: [], figures: {} };
  const figureSources = new Map<string, FigureSource[]>();
  let rowCount = 0;
  for (const [sheetIndex, name] of workbook.SheetNames.entries()) {
    const sheet = workbook.Sheets[name]; const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    rowCount += range.e.r + 1;
    if (rowCount > XLSX_LIMITS.rows || range.e.c >= XLSX_LIMITS.columns) throw new Error('Sešit překročil limit řádků nebo sloupců.');
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: true, range: { s: { r: 0, c: 0 }, e: range.e } });
    const override=Object.hasOwn(overrides,name)?overrides[name]:{};
    const detected = detectBudgetLayout(rows);
    const header=override.headerRow !== undefined ? override.headerRow-1 : detected?.header ?? -1;
    if(!Number.isInteger(header)||header>=rows.length||header < -1||override.headerRow===0)throw new Error("Neplatný řádek hlavičky.");
    const layout = detectBudgetLayout(rows, header);
    const format = (override.format === 'auto' ? undefined : override.format) ?? layout?.format;
    const globus = format === 'globus';
    const columns = (rows[header] ?? []).map(v => normalizeSearch(text(v)));
    const col = (pattern: RegExp) => columns.findIndex(v => pattern.test(v));
    const mapping = { kind: col(/^typ$/), code: col(/^kod$/), description: col(/^popis$/), unit: col(/^mj$/), quantity: col(/^mnozstvi$/), unitPrice: col(/^j\.?\s*cena/), total: col(/^(cena celkem|celkem)/), ...layout?.columns, ...override.columns };
    const sheetId = `sheet:${sheetIndex}`;
    const heading = rows.slice(0, 30).flat().map(text).join(' ');
    const role: BudgetSheet['role'] = override.role ?? (header >= 0 ? 'items' : /rekapitulace/i.test(heading) ? 'summary' : /seznam figur/i.test(heading + name) ? 'figures' : /pokyny/i.test(heading + name) ? 'instructions' : 'unknown');
    const labelAfter = (label: string) => { const i = rows.slice(0, 35).findIndex(row => row.some(v => text(v) === label)); return i >= 0 ? rows[i + 1]?.map(text).find(v => v.trim()) || '' : ''; };
    const identity = globus ? globusIdentity(rows, header, mapping) : undefined;
    const object = override.object || identity?.object || labelAfter('Objekt:') || 'Bez objektu';
    const levelLabels = rows.slice(0, header >= 0 ? header : 35).flat().map(text)
      .filter(value => /^Úroveň \d+:$/.test(value))
      .sort((a, b) => Number(b.match(/\d+/)?.[0]) - Number(a.match(/\d+/)?.[0]));
    const title = override.title || identity?.title || levelLabels.map(labelAfter).find(Boolean) || labelAfter('Soupis:') || name;
    // Bounded, ephemeral raw preview also works when recognition fails.
    const previewStart = Math.max(0, header - 5);
    const sourcePreview = { rowCount: rows.length, columnCount: range.e.c + 1, rows: rows.slice(previewStart, previewStart + 60).map((values, index) => ({
      row: previewStart + index + 1, cells: values.map((value, column) => {
        const formula = sheet[XLSX.utils.encode_cell({ r: previewStart + index, c: column })]?.f;
        if (text(value).length > XLSX_LIMITS.text || (formula?.length ?? 0) > XLSX_LIMITS.text) throw new Error('Text buňky překročil limit.');
        return { value: value as SourceCell['value'], ...(formula ? { formula } : {}) };
      }),
    })) };
    document.sheets.push({ id: sheetId, name, role, object, title, headerRow: header + 1, selected: role === 'items', sourcePreview, ...(format ? { format } : {}) });
    if (role === 'figures') {
      const figureHeader=rows.findIndex(row=>row.some(v=>normalizeSearch(text(v))==='vymera')&&row.some(v=>normalizeSearch(text(v))==='kod'));
      if(figureHeader>=0){
        const labels=rows[figureHeader].map(v=>normalizeSearch(text(v))); const codeColumn=labels.indexOf('kod'); const valueColumn=labels.indexOf('vymera');
        for (let rowIndex = figureHeader + 1; rowIndex < rows.length; rowIndex++) {
          const row = rows[rowIndex]; const code = text(row[codeColumn]);
          if (code.length > XLSX_LIMITS.text) throw new Error('Text buňky překročil limit.');
          if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(code) || row[valueColumn] === null) continue;
          try {
            const value = decimal(row[valueColumn]);
            if (value !== null) {
              const sources = figureSources.get(code) ?? [];
              sources.push({ sheet: name, row: rowIndex + 1, cell: XLSX.utils.encode_cell({ r: rowIndex, c: valueColumn }), value });
              figureSources.set(code, sources);
            }
          } catch { /* Never infer a missing numeric value or execute a workbook formula. */ }
        }
      }
    }
    if (role !== 'items') { progress?.(sheetIndex + 1, workbook.SheetNames.length); continue; }
    if(header<0){document.issues.push({sheet:name,row:1,severity:'error',message:'Zvolte hlavičku a mapování sloupců.'});continue;}
    document.sheets[document.sheets.length-1].columns=mapping;
    if (Object.entries(mapping).some(([key,v]) => !(key === 'depth' && v === -1) && (!Number.isInteger(v) || v < 0 || v >= XLSX_LIMITS.columns))) { document.issues.push({ sheet: name, row: header + 1, severity: 'error', message: 'Chybí požadovaný sloupec; upravte mapování ve zdrojovém sešitu.' }); continue; }
    const objectId = `object:${object}`;
    const source = { sheet: name, row: 0, cells: {} };
    const base = { code: '', unit: '', quantity: null, unitPrice: null, total: null, sourceType: '', tags: [], tenders: [] };
    if (!document.nodes.some(n => n.id === objectId)) document.nodes.push({ ...base, id: objectId, parentId: null, sheetId: '', kind: 'object', description: object, order: document.nodes.length, source });
    document.nodes.push({ ...base, id: sheetId, parentId: objectId, sheetId, kind: 'sheet', description: title, order: document.nodes.length, source });
    const sections: string[] = []; let lastItem: string | null = null;
    for (let r = header + 1; r < rows.length; r++) {
      const row = rows[r]; const rawKind = text(row[mapping.kind]).trim();
      if (!row.some(value => text(value).trim())) continue;
      if (globus && r === header + 1 && !rawKind) continue; // Second header row remains in sourcePreview.
      if (globus && r === header + 2 && isGlobusColumnGuide(row, mapping)) continue;
      const repeatedHeader = normalizeSearch(rawKind) === 'typ' && normalizeSearch(text(row[mapping.description])) === normalizeSearch(text(rows[header][mapping.description]));
      const kind: BudgetNode['kind'] = rawKind === 'D' || (globus && rawKind === 'SD') ? 'section' : globus && rawKind === 'P' ? 'K' : rawKind === 'K' || rawKind === 'M' || rawKind === 'VV' ? rawKind : 'note';
      const cells: Record<string, SourceCell> = {};
      for (let c = 0; c <= range.e.c; c++) {
        const address = XLSX.utils.encode_cell({ r, c }); const cell = sheet[address]; if (!cell) continue;
        if (text(cell.v).length > XLSX_LIMITS.text || (cell.f?.length ?? 0) > XLSX_LIMITS.text) throw new Error('Text buňky překročil limit.');
        cells[address] = { value: cell.v ?? null, ...(cell.f ? { formula: cell.f } : {}) };
      }
      const number = (column: number): string | null => {
        const cell = sheet[XLSX.utils.encode_cell({ r, c: column })];
        try {
          if (cell?.t === 'e') throw new Error('Chyba Excelu');
          if (cell?.f && (cell.v === undefined || cell.v === null || cell.v === '')) throw new Error('Chybí uložený výsledek vzorce');
          // Excel numeric values are IEEE754. Preserve original alongside a 15 significant digit decimal.
          return decimal(typeof cell?.v === 'number' ? Number(cell.v.toPrecision(15)).toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 18 }) : cell?.v);
        } catch { document.issues.push({ sheet: name, row: r + 1, severity: kind === 'K' || kind === 'M' ? 'error' : 'warning', message: `Neplatná nebo chybějící hodnota ${XLSX.utils.encode_col(column)}.` }); return null; }
      };
      const id = `${sheetId}:row:${r + 1}`;
      if (!repeatedHeader && !['D','K','M','VV','PP','PSC','TS',...(globus?['SD','P']:[])].includes(rawKind)) document.issues.push({sheet:name,row:r+1,severity:'error',kind:'unclassified',message:'Typ řádku nebyl rozpoznán. Určete položku, poznámku nebo mezisoučet v editoru struktury.'});
      let parentId = sections.at(-1) || sheetId;
      if (kind === 'section') {
        const depthColumn = override.columns?.depth;
        const depthCell = depthColumn === -1 || (globus && depthColumn === undefined) ? undefined : sheet[XLSX.utils.encode_cell({r,c:depthColumn ?? 46})];
        const explicit = depthCell && depthCell.t !== 'e' && /^\d+$/.test(text(depthCell.v)) ? Number(depthCell.v) : null;
        const depth = explicit ?? (globus ? 0 : (/^[A-Z]+$/.test(text(row[mapping.code])) ? 0 : 1));
        if ((!globus && explicit === null) || (globus && depthColumn !== undefined && depthColumn !== -1 && explicit === null) || depth > sections.length || depth > 32) {
          document.issues.push({sheet:name,row:r+1,severity:'error',kind:'hierarchy',message:explicit===null?'Nadřazený oddíl je pouze návrh; ve zdroji chybí platná úroveň. Ověřte jej v editoru struktury.':'Úroveň přeskakuje chybějící nadřazený oddíl nebo překračuje limit 32. Opravte rodiče.'});
        }
        sections.length = Math.min(depth, sections.length); parentId = sections.at(-1) || sheetId; sections.push(id); lastItem = null;
      } else if (kind === 'VV' || kind === 'note') parentId = lastItem || parentId;
      else lastItem = id;
      const priced = kind === 'K' || kind === 'M'; const quantity = (priced || kind === 'VV') ? number(mapping.quantity) : null;
      const unitPrice = priced ? number(mapping.unitPrice) : null; const rawTotal = priced ? number(mapping.total) : null;
      const total = rawTotal === null ? null : money(rawTotal);
      if (priced && (quantity === null || unitPrice === null || total === null)) document.issues.push({ sheet: name, row: r + 1, severity: 'error', message: 'Položka nemá úplné ocenění; prázdná hodnota není nula.' });
      if (priced && quantity !== null && unitPrice !== null && total !== null && multiplyMoney(quantity, unitPrice) !== total) document.issues.push({ sheet: name, row: r + 1, severity: 'warning', message: 'Uložená cena se liší od množství × jednotkové ceny.' });
      document.nodes.push({ id, parentId, sheetId, kind, order: document.nodes.length, code: text(row[mapping.code]), description: text(row[mapping.description]), unit: text(row[mapping.unit]), quantity, unitPrice, total, source: { sheet: name, row: r + 1, cells }, sourceType: rawKind, tags: [], tenders: [] });
    }
    progress?.(sheetIndex + 1, workbook.SheetNames.length);
  }
  const conflicts: FigureConflict[] = [];
  const figures = new Map<string, string>();
  for (const [code, sources] of figureSources) {
    const values = [...new Set(sources.map(source => source.value))];
    if (values.length === 1) figures.set(code, values[0]);
    else conflicts.push({ code, values, sources });
  }
  document.figures = Object.fromEntries(figures);
  if (conflicts.length) {
    const first = conflicts[0].sources![0];
    document.issues.push({ sheet: first.sheet, row: first.row, severity: 'warning', kind: 'ambiguous-figures', figures: conflicts,
      message: 'Některé figury mají více různých hodnot. Vyberte hodnoty pro přepočet výkazu výměr. Uložená množství a ceny položek zůstávají zachované.' });
  }
  return document;
}
export function readKrosFile(bytes: Uint8Array, progress?: (done: number, total: number) => void, overrides: KrosMapping = {}): BudgetDocument {
  inspectXlsxArchive(bytes);
  return parseKrosWorkbook(XLSX.read(bytes, { type: 'array', cellFormula: true, cellHTML: false, cellStyles: false, bookVBA: false }), progress, overrides);
}
