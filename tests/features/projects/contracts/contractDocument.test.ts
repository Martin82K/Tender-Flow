import { describe, expect, it } from 'vitest';
import {
  getContractDocumentKind,
  validateContractDocument,
} from '@/shared/contracts/contractDocument';

const fileWithBytes = (name: string, type: string, bytes: number[]): File =>
  new File([new Uint8Array(bytes)], name, { type });

describe('contractDocument', () => {
  it('přijme PDF podle signatury a normalizuje metadata', async () => {
    const file = fileWithBytes('Smlouva 01.PDF', 'application/pdf', [0x25, 0x50, 0x44, 0x46, 0x2d]);
    await expect(validateContractDocument(file)).resolves.toMatchObject({
      extension: 'pdf',
      mimeType: 'application/pdf',
      fileName: 'Smlouva 01.PDF',
    });
  });

  it('přijme DOCX jako ZIP a odmítne podvrženou příponu', async () => {
    const docx = fileWithBytes(
      'smlouva.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      [0x50, 0x4b, 0x03, 0x04],
    );
    await expect(validateContractDocument(docx)).resolves.toMatchObject({ extension: 'docx' });

    const fakePdf = fileWithBytes('smlouva.pdf', 'application/pdf', [0x3c, 0x68, 0x74, 0x6d]);
    await expect(validateContractDocument(fakePdf)).rejects.toThrow('neodpovídá');
  });

  it('vrací typ ikony pouze pro podporované dokumenty', () => {
    expect(getContractDocumentKind('application/pdf', 'x.pdf')).toBe('pdf');
    expect(getContractDocumentKind('', 'x.docx')).toBe('docx');
    expect(getContractDocumentKind('text/html', 'x.html')).toBeNull();
  });
});
