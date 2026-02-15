import { beforeEach, describe, expect, it, vi } from 'vitest';

const saveMock = vi.hoisted(() => vi.fn());
const textMock = vi.hoisted(() => vi.fn());
const autoTableMock = vi.hoisted(() => vi.fn((doc: any, opts: any) => {
  doc.lastAutoTable = { finalY: (opts?.startY ?? 20) + 20 };
}));

const jsPdfCtor = vi.hoisted(() =>
  vi.fn().mockImplementation(function MockJsPDF(this: any) {
    this.addFileToVFS = vi.fn();
    this.addFont = vi.fn();
    this.setFont = vi.fn();
    this.setFontSize = vi.fn();
    this.setTextColor = vi.fn();
    this.setDrawColor = vi.fn();
    this.setFillColor = vi.fn();
    this.roundedRect = vi.fn();
    this.line = vi.fn();
    this.rect = vi.fn();
    this.text = textMock;
    this.splitTextToSize = vi.fn((value: string) => [value]);
    this.addPage = vi.fn();
    this.getNumberOfPages = vi.fn(() => 1);
    this.setPage = vi.fn();
    this.save = saveMock;
    this.internal = {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
        height: 297,
      },
    };
    this.lastAutoTable = { finalY: 40 };
  }),
);

vi.mock('jspdf', () => ({
  default: jsPdfCtor,
}));

vi.mock('jspdf-autotable', () => ({
  default: autoTableMock,
}));

vi.mock('../fonts/roboto-regular', () => ({
  RobotoRegularBase64: 'AA==',
}));

import { exportMarkdownToFile, exportMarkdownToPdf } from '../services/exportService';

describe('exportService markdown helpers', () => {
  beforeEach(() => {
    saveMock.mockReset();
    textMock.mockReset();
    autoTableMock.mockReset();

    if (!('createObjectURL' in URL)) {
      Object.defineProperty(URL, 'createObjectURL', {
        writable: true,
        value: vi.fn(),
      });
    }
    if (!('revokeObjectURL' in URL)) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        writable: true,
        value: vi.fn(),
      });
    }

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  it('exportMarkdownToFile vytvori markdown soubor a spusti download', () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    exportMarkdownToFile('smlouva_test', '# Ahoj');

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    expect(blobArg.type).toContain('text/markdown');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('exportMarkdownToPdf zpracuje heading/list/table a ulozi pdf', () => {
    const md = `# Smlouva\n\n- podminka A\n- podminka B\n\n| Sloupec | Hodnota |\n|---|---|\n| A | B |`;

    exportMarkdownToPdf('smlouva_test', md, 'Náhled smlouvy');

    expect(autoTableMock).toHaveBeenCalled();
    expect(saveMock).toHaveBeenCalledWith('smlouva_test.pdf');
    expect(textMock).toHaveBeenCalled();
  });
});
