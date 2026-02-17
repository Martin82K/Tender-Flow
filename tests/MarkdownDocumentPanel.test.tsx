import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
  getMarkdownVersions: vi.fn(),
  createMarkdownVersion: vi.fn(),
  logMarkdownAccess: vi.fn(),
}));

const exportMocks = vi.hoisted(() => ({
  exportMarkdownToFile: vi.fn(),
  exportMarkdownToPdf: vi.fn(),
}));

vi.mock('../services/contractService', () => ({
  contractService: {
    getMarkdownVersions: (...args: any[]) => serviceMocks.getMarkdownVersions(...args),
    createMarkdownVersion: (...args: any[]) => serviceMocks.createMarkdownVersion(...args),
    logMarkdownAccess: (...args: any[]) => serviceMocks.logMarkdownAccess(...args),
  },
}));

vi.mock('../services/exportService', () => ({
  exportMarkdownToFile: (...args: any[]) => exportMocks.exportMarkdownToFile(...args),
  exportMarkdownToPdf: (...args: any[]) => exportMocks.exportMarkdownToPdf(...args),
}));

import { MarkdownDocumentPanel } from '../shared/contracts/MarkdownDocumentPanel';

const versionsFixture = [
  {
    id: 'v2',
    entityType: 'contract',
    contractId: 'c1',
    projectId: 'p1',
    vendorId: 'ven1',
    versionNo: 2,
    sourceKind: 'manual_edit',
    sourceFileName: 'manual.md',
    contentMd: '# Druha verze\nVerze je připravena.\nTato verze je finální.',
    metadata: {},
    createdBy: 'u1',
    createdAt: '2026-02-15T10:00:00.000Z',
  },
  {
    id: 'v1',
    entityType: 'contract',
    contractId: 'c1',
    projectId: 'p1',
    vendorId: 'ven1',
    versionNo: 1,
    sourceKind: 'ocr',
    sourceFileName: 'ocr.pdf',
    ocrProvider: 'mistral-ocr',
    ocrModel: 'mistral-ocr-latest',
    contentMd: '# Prvni verze\nHistorická verze dokumentu.',
    metadata: {},
    createdBy: 'u1',
    createdAt: '2026-02-14T10:00:00.000Z',
  },
] as any;

describe('MarkdownDocumentPanel', () => {
  beforeEach(() => {
    serviceMocks.getMarkdownVersions.mockReset();
    serviceMocks.createMarkdownVersion.mockReset();
    serviceMocks.logMarkdownAccess.mockReset();
    serviceMocks.logMarkdownAccess.mockResolvedValue(undefined);
    exportMocks.exportMarkdownToFile.mockReset();
    exportMocks.exportMarkdownToPdf.mockReset();
  });

  it('zobrazi prazdny stav bez verzi', async () => {
    serviceMocks.getMarkdownVersions.mockResolvedValue([]);

    render(
      <MarkdownDocumentPanel
        entityType="contract"
        entityId="c1"
        entityLabel="Smlouva A"
      />,
    );

    expect(
      await screen.findByText('Zatím není uložená žádná verze markdownu.'),
    ).toBeInTheDocument();
  });

  it('zobrazi verze a umi prepinat obsah', async () => {
    serviceMocks.getMarkdownVersions.mockResolvedValue(versionsFixture);

    render(
      <MarkdownDocumentPanel
        entityType="contract"
        entityId="c1"
        entityLabel="Smlouva A"
      />,
    );

    expect(await screen.findByText('Druha verze')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /v1/i }));

    expect(await screen.findByText('Prvni verze')).toBeInTheDocument();
  });

  it('tlacitka stahnout a export volaji helpery s vybranou verzi', async () => {
    serviceMocks.getMarkdownVersions.mockResolvedValue(versionsFixture);

    render(
      <MarkdownDocumentPanel
        entityType="contract"
        entityId="c1"
        entityLabel="Smlouva A"
      />,
    );

    await screen.findByText('Druha verze');

    fireEvent.click(screen.getByRole('button', { name: 'Stáhnout .md' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export PDF' }));

    expect(serviceMocks.logMarkdownAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        markdownVersionId: 'v2',
        accessKind: 'download',
      }),
    );
    expect(serviceMocks.logMarkdownAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        markdownVersionId: 'v2',
        accessKind: 'export',
      }),
    );
    expect(exportMocks.exportMarkdownToFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('# Druha verze'),
    );
    expect(exportMocks.exportMarkdownToPdf).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('# Druha verze'),
      expect.stringContaining('Smlouva A'),
    );
  });

  it('v editable modu ulozi novou verzi', async () => {
    serviceMocks.getMarkdownVersions
      .mockResolvedValueOnce(versionsFixture)
      .mockResolvedValueOnce(versionsFixture);
    serviceMocks.createMarkdownVersion.mockResolvedValue({ id: 'v3' });

    render(
      <MarkdownDocumentPanel
        entityType="contract"
        entityId="c1"
        entityLabel="Smlouva A"
        editable={true}
      />,
    );

    await screen.findByText('Druha verze');

    fireEvent.click(screen.getByRole('button', { name: 'Upravit' }));
    fireEvent.change(screen.getByPlaceholderText('Vložte nebo upravte markdown obsah smlouvy...'), {
      target: { value: '# Nova verze' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit novou verzi' }));

    await waitFor(() => {
      expect(serviceMocks.createMarkdownVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'contract',
          contractId: 'c1',
          sourceKind: 'manual_edit',
          contentMd: '# Nova verze',
        }),
      );
    });
  });

  it('vyhledavani vykresli jen pri enableSearch', async () => {
    serviceMocks.getMarkdownVersions.mockResolvedValue(versionsFixture);

    const { rerender } = render(
      <MarkdownDocumentPanel
        entityType="contract"
        entityId="c1"
        entityLabel="Smlouva A"
      />,
    );

    await screen.findByText('Druha verze');
    expect(screen.queryByPlaceholderText('Vyhledat v dokumentu...')).not.toBeInTheDocument();

    rerender(
      <MarkdownDocumentPanel
        entityType="contract"
        entityId="c1"
        entityLabel="Smlouva A"
        enableSearch={true}
      />,
    );

    expect(await screen.findByPlaceholderText('Vyhledat v dokumentu...')).toBeInTheDocument();
  });

  it('query zvyrazni vyskyt a zobrazi pocet nalezu', async () => {
    serviceMocks.getMarkdownVersions.mockResolvedValue(versionsFixture);

    const { container } = render(
      <MarkdownDocumentPanel
        entityType="contract"
        entityId="c1"
        entityLabel="Smlouva A"
        enableSearch={true}
      />,
    );

    await screen.findByText('Druha verze');

    fireEvent.change(screen.getByPlaceholderText('Vyhledat v dokumentu...'), {
      target: { value: 'verze' },
    });

    await waitFor(() => {
      expect(screen.getByText('1/3')).toBeInTheDocument();
      expect(container.querySelectorAll('mark.md-search-mark').length).toBe(3);
    });
  });

  it('sipky prepinaji aktivni nalez cyklicky', async () => {
    serviceMocks.getMarkdownVersions.mockResolvedValue(versionsFixture);

    render(
      <MarkdownDocumentPanel
        entityType="contract"
        entityId="c1"
        entityLabel="Smlouva A"
        enableSearch={true}
      />,
    );

    await screen.findByText('Druha verze');

    fireEvent.change(screen.getByPlaceholderText('Vyhledat v dokumentu...'), {
      target: { value: 'verze' },
    });

    await screen.findByText('1/3');

    fireEvent.click(screen.getByRole('button', { name: 'Další výskyt' }));
    expect(screen.getByText('2/3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Další výskyt' }));
    expect(screen.getByText('3/3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Další výskyt' }));
    expect(screen.getByText('1/3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Předchozí výskyt' }));
    expect(screen.getByText('3/3')).toBeInTheDocument();
  });

  it('vymazani query odstrani highlight', async () => {
    serviceMocks.getMarkdownVersions.mockResolvedValue(versionsFixture);

    const { container } = render(
      <MarkdownDocumentPanel
        entityType="contract"
        entityId="c1"
        entityLabel="Smlouva A"
        enableSearch={true}
      />,
    );

    await screen.findByText('Druha verze');

    const searchInput = screen.getByPlaceholderText('Vyhledat v dokumentu...');
    fireEvent.change(searchInput, { target: { value: 'verze' } });

    await waitFor(() => {
      expect(container.querySelectorAll('mark.md-search-mark').length).toBeGreaterThan(0);
    });

    fireEvent.change(searchInput, { target: { value: '' } });

    await waitFor(() => {
      expect(container.querySelectorAll('mark.md-search-mark').length).toBe(0);
      expect(screen.getByText('Bez filtru')).toBeInTheDocument();
    });
  });
});
