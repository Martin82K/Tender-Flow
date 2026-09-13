import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHandoverDraft, freezeDocument } from '@features/projects/contracts/documents/model';
import type { ContractWithDetails } from '@/types';

const pdf = vi.hoisted(() => ({ page: 1, count: 1, texts: [] as { value: string; page: number; y: number }[] }));
vi.mock('@infra/db/dbAdapter', () => ({ dbAdapter: {} }));
vi.mock('@features/organization', () => ({ organizationService: {} }));
vi.mock('@shared/pdf/pdfRuntime', () => ({
  registerRobotoFont: vi.fn(),
  loadPdfRuntime: async () => ({ jsPDF: class {
    setFont() {} setTextColor() {} setDrawColor() {} setFontSize() {} addImage() {} line() {}
    splitTextToSize(value: string, width: number) { return value.split('\n').flatMap(line => line.match(new RegExp(`.{1,${width === 74 ? 40 : 100}}`, 'g')) || ['']); }
    text(value: string, _x: number, y: number) { pdf.texts.push({ value, page: pdf.page, y }); }
    addPage() { pdf.page = ++pdf.count; } setPage(page: number) { pdf.page = page; }
    getNumberOfPages() { return pdf.count; } output() { return new ArrayBuffer(0); }
  } }),
}));
import { snapshotLogo } from '@features/projects/contracts/documents/api';
import { exportDocumentPdf } from '@features/projects/contracts/documents/export';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('document review regressions', () => {
  it('reduces an incompressible organization logo until its snapshot fits with all fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['image'], { type: 'image/png' }) }));
    vi.stubGlobal('Image', class { src = ''; naturalWidth = 640; naturalHeight = 640; decode = async () => {}; });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:logo');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function (this: HTMLCanvasElement) {
      return 'data:image/png;base64,' + 'A'.repeat(Math.ceil(this.width * this.height * 4 * 4 / 3));
    });
    const logo = await snapshotLogo('https://storage.example/logo.png');
    const fields = createHandoverDraft({ vendorName: 'Firma', title: 'Dílo' } as ContractWithDetails);
    for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
      if (!['handwritingLines', 'scopeKind', 'result', 'actualDate', 'defectsDeadline'].includes(key)) Object.assign(fields, { [key]: '界'.repeat(11990) });
    }
    const bytes = new TextEncoder().encode(JSON.stringify(freezeDocument(fields, '2026-09-13', 1, logo))).length;
    expect(bytes + 2048).toBeLessThan(1500000);
    expect(logo.dataUrl.length).toBeLessThanOrEqual(256000);
    expect(logo.width).toBe(logo.height);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:logo');
  });

  it('keeps long representatives with both signature lines and labels near every page boundary', async () => {
    for (let lines = 0; lines < 42; lines++) {
      pdf.page = 1; pdf.count = 1; pdf.texts = [];
      const fields = createHandoverDraft({ vendorName: 'Firma', title: 'Dílo' } as ContractWithDetails);
      fields.issuerRepresentative = 'Z'.repeat(300);
      fields.vendorRepresentative = 'Y'.repeat(300);
      fields.defects = Array.from({ length: lines }, () => 'Vada').join('\n');
      await exportDocumentPdf(freezeDocument(fields, '2026-09-13', 1));
      const label = pdf.texts.find(t => t.value === 'Za organizaci')!;
      const representatives = pdf.texts.filter(t => /^[ZY]/.test(t.value) && t.value !== 'Za organizaci' && t.value !== 'Za subdodavatele');
      expect(representatives.length).toBeGreaterThan(10);
      expect(representatives.every(t => t.page === label.page && t.y < 271)).toBe(true);
    }
  });
});
