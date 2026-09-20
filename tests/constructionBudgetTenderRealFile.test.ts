// Optional private fixture. Never commit a customer workbook or its contents.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { readKrosFile } from '@features/projects/budget/model/krosImport';
import { detectTenderColumns, readTenderRows } from '@features/projects/budget/model/tenderImport';
const path=process.env.TENDER_IMPORT_SMOKE_FILE;
it.skipIf(!path)('reads a private tender-mapping workbook without executing formulas or importing prices',()=>{
  const document=readKrosFile(new Uint8Array(readFileSync(path!)),undefined,{},true);
  const mapping=Object.fromEntries(document.sheets.map(s=>[s.id,detectTenderColumns(s)]));
  const rows=readTenderRows(document,mapping);const named=rows.filter(r=>r.name);
  expect(named.length).toBeGreaterThan(0);
  expect(rows.every(r=>r.node.quantity===null&&r.node.unitPrice===null&&r.node.total===null)).toBe(true);
  console.info(JSON.stringify({sheets:document.sheets.length,items:rows.length,named:named.length,blank:rows.length-named.length,groups:new Set(named.map(r=>r.name)).size}));
},20000);
