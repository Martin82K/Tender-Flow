import { writeFileSync, mkdirSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { createHandoverDraft, freezeDocument } from '@features/projects/contracts/documents/model';
import { exportDocumentDocx, exportDocumentPdf } from '@features/projects/contracts/documents/export';
import type { ContractWithDetails, ProjectDetails } from '@/types';
// Opt-in render fixtures; the normal suite verifies bytes without writing files.
const output = process.env.TF_PROTOCOL_RENDER_DIR;
describe('contract document export page flow', () => {
  it('exports long Czech content and ten handwritten rows with separate attachments', async () => {
    const fields = createHandoverDraft({vendorName:'Silnice Novák s.r.o.',vendorIco:'12345678',contractNumber:'08/2026',title:'Asfaltové souvrství mostu'} as ContractWithDetails, {title:'26026 · Oprava mostu',siteManager:'Jan Novotný',location:'Praha'} as ProjectDetails,'Stavební firma');
    fields.defects = 'Doplnit zábradlí a dokončit spárování.\nTermín opravy bude doplněn při předání.';
    fields.handwritingLines = 10;
    fields.attachments = 'Certifikáty materiálů, dokumentace skutečného provedení.';
    const snapshot = freezeDocument(fields,'2026-09-13T12:00:00Z',1);
    const docx = await exportDocumentDocx(snapshot); const pdf = await exportDocumentPdf(snapshot);
    expect(docx.length).toBeGreaterThan(1000); expect(pdf.length).toBeGreaterThan(1000);
    if (output) { mkdirSync(output,{recursive:true}); writeFileSync(`${output}/protokol.docx`,docx); writeFileSync(`${output}/protokol.pdf`,pdf); }
    fields.defects = Array.from({length:80},(_,i) => `${i+1}. Zkontrolovat doplnění zábradlí a spárování mostu.`).join('\n');
    const longPdf = await exportDocumentPdf(freezeDocument(fields,'2026-09-13T12:00:00Z',2));
    expect(longPdf.length).toBeGreaterThan(pdf.length);
    if (output) writeFileSync(`${output}/protokol-dlouhy.pdf`,longPdf);
  });
});
