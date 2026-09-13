import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { createHandoverDraft, freezeDocument, documentSections } from '@features/projects/contracts/documents/model';
import { exportDocumentDocx, exportDocumentPdf } from '@features/projects/contracts/documents/export';
import type { ContractWithDetails, ProjectDetails } from '@/types';

const contract = { id: 'contract-1', projectId: 'project-1', vendorName: 'Novák & syn', vendorIco: '12345678', title: 'Most', contractNumber: '08/2026', signedAt: '2026-01-01', completionDate: '2026-06-01', warrantyMonths: 60 } as ContractWithDetails;
const project = { id: 'project-1', title: 'Oprava mostu', siteManager: 'Jan Novotný', location: 'Praha' } as ProjectDetails;

describe('contract document workflow', () => {
  it('starts with unknown handover and defects even when the contract has dates', () => {
    const draft = createHandoverDraft(contract, project, 'Stavební firma');
    expect(draft.actualDate).toBe('');
    expect(draft.result).toBe('');
    expect(draft.defects).toBe('');
    expect(draft.vendorName).toBe(contract.vendorName);
    expect(draft.issuerRepresentative).toBe('Jan Novotný');
  });

  it('keeps a snapshot independent of later source changes and preserves blank writing space', () => {
    const draft = createHandoverDraft(contract, project, 'Firma');
    draft.handwritingLines = 10;
    draft.defects = 'Doplnit zábradlí';
    const snapshot = freezeDocument(draft, '2026-09-13T12:00:00Z', 2);
    draft.defects = 'Změna';
    expect(snapshot.fields.defects).toBe('Doplnit zábradlí');
    expect(snapshot.fields.handwritingLines).toBe(10);
    expect(documentSections(snapshot).some(s => s.text.includes('Doplnit zábradlí'))).toBe(true);
    expect(documentSections(snapshot).some(s => s.text.includes('Bez vad'))).toBe(false);
  });

  it('exports editable Czech text with escaped XML, handwriting lines, provenance and page fields', async () => {
    const draft = createHandoverDraft(contract, project, 'Firma');
    draft.defects = '<script> & zábradlí';
    draft.handwritingLines = 5;
    const snapshot = freezeDocument(draft, '2026-09-13T12:00:00Z', 3);
    const zip = unzipSync(await exportDocumentDocx(snapshot));
    const xml = strFromU8(zip['word/document.xml']);
    expect(xml).toContain('Novák &amp; syn');
    expect(xml).toContain('&lt;script&gt; &amp; zábradlí');
    expect(xml.match(/w:pBdr/g)).toHaveLength(10);
    expect(xml.indexOf('w:pBdr')).toBeLessThan(xml.indexOf('Za organizaci'));
    const footer = strFromU8(zip['word/footer1.xml']);
    expect(footer).toContain('Tender Flow');
    expect(footer).toContain('Verze 3');
    expect(footer).toContain('PAGE');
    expect(Object.keys(zip).some(key => /vbaProject|external/i.test(key))).toBe(false);
    const pdf = await exportDocumentPdf(snapshot);
    expect(new TextDecoder().decode(pdf.slice(0, 4))).toBe('%PDF');
  });
});

describe('organization logo snapshot', () => {
  it('embeds the saved organization image in DOCX with its aspect ratio and in PDF', async () => {
    const logo = { dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgaPj/HwAEggJ/59habAAAAABJRU5ErkJggg==', width: 320, height: 80 };
    const snapshot = freezeDocument(createHandoverDraft(contract, project, 'Firma'), '2026-09-13T12:00:00Z', 1, logo);
    logo.width = 20;
    const zip = unzipSync(await exportDocumentDocx(snapshot));
    expect(zip['word/media/logo.png'].length).toBeGreaterThan(20);
    expect(strFromU8(zip['word/document.xml'])).toContain('cx="1512000" cy="378000"');
    expect(strFromU8(zip['word/_rels/document.xml.rels'])).toContain('Target="media/logo.png"');
    const pdf = await exportDocumentPdf(snapshot);
    expect(new TextDecoder('latin1').decode(pdf)).toContain('/Subtype /Image');
  });
});
