import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BidComparisonPanel } from '../components/pipelineComponents/BidComparisonPanel';
import { navigate } from '../shared/routing/router';
import type { BidComparisonDetectionResult } from '../shared/types/desktop';

const platformMocks = vi.hoisted(() => ({
  detectInputs: vi.fn(),
  autoStatus: vi.fn(),
  storageGet: vi.fn(),
  selectFolder: vi.fn(),
  showItemInFolder: vi.fn(),
  start: vi.fn(),
  get: vi.fn(),
  cancel: vi.fn(),
  autoStart: vi.fn(),
  autoStop: vi.fn(),
}));

vi.mock('../services/platformAdapter', () => ({
  default: {
    bidComparison: {
      isAvailable: () => true,
      detectInputs: (...args: unknown[]) => platformMocks.detectInputs(...args),
      autoStatus: (...args: unknown[]) => platformMocks.autoStatus(...args),
      start: (...args: unknown[]) => platformMocks.start(...args),
      get: (...args: unknown[]) => platformMocks.get(...args),
      cancel: (...args: unknown[]) => platformMocks.cancel(...args),
      autoStart: (...args: unknown[]) => platformMocks.autoStart(...args),
      autoStop: (...args: unknown[]) => platformMocks.autoStop(...args),
    },
    storage: {
      get: (...args: unknown[]) => platformMocks.storageGet(...args),
    },
    fs: {
      selectFolder: (...args: unknown[]) => platformMocks.selectFolder(...args),
      showItemInFolder: (...args: unknown[]) => platformMocks.showItemInFolder(...args),
    },
  },
}));

vi.mock('../services/fileSystemService', () => ({
  openInExplorer: vi.fn(),
}));

vi.mock('../services/featureUsageService', () => ({
  trackFeatureUsage: vi.fn(),
}));

vi.mock('../shared/routing/router', () => ({
  navigate: vi.fn(),
}));

const detectedResult = (files: BidComparisonDetectionResult['files']): BidComparisonDetectionResult => ({
  tenderFolderPath: '/Tender/Vyberove-rizeni',
  warnings: [],
  files,
});

const detectedFile = (
  fileName: string,
  relativePath: string,
  suggestedRole: 'ignore' | 'zadani' | 'offer',
  suggestedSupplierName: string | null,
): BidComparisonDetectionResult['files'][number] => ({
  path: `/Tender/Vyberove-rizeni/${relativePath}`,
  relativePath,
  fileName,
  sizeBytes: 42_000,
  mtimeMs: 1_700_000_000_000,
  suggestedRole,
  suggestedSupplierName,
  suggestedRound: 0,
  analysis: {
    headerRow: 4,
    kRows: 12,
    pricedKRows: suggestedRole === 'offer' ? 10 : 0,
    columnMap: {
      pc: 1,
      typ: 2,
      kod: 3,
      popis: 4,
      mj: 5,
      mnozstvi: 6,
      jcena: suggestedRole === 'offer' ? 7 : undefined,
      celkem: suggestedRole === 'offer' ? 8 : undefined,
    },
    isValidTemplate: true,
  },
  analysisError: null,
});

const renderPanel = (onClose = vi.fn(), mappedBudgetAttachment: React.ComponentProps<typeof BidComparisonPanel>['mappedBudgetAttachment'] = null) =>
  render(
    <BidComparisonPanel
      isOpen
      onClose={onClose}
      projectId="project-1"
      categoryId="category-1"
      initialTenderFolderPath="/Tender/Vyberove-rizeni"
      supplierNames={['Kamenolom Číhaná', 'Doprava']}
      mappedBudgetAttachment={mappedBudgetAttachment}
    />,
  );

describe('BidComparisonPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    platformMocks.autoStatus.mockResolvedValue(null);
    platformMocks.storageGet.mockResolvedValue(null);
    platformMocks.showItemInFolder.mockResolvedValue({ success: true });
  });

  it('využije celou obrazovku aplikace místo omezeného modalu', async () => {
    platformMocks.detectInputs.mockResolvedValue(
      detectedResult([
        detectedFile('zadani.xlsx', '00 Zadání/zadani.xlsx', 'zadani', null),
        detectedFile('nabidka-kamenolom.xlsx', '01 Kamenolom Číhaná/nabidka-kamenolom.xlsx', 'offer', 'Kamenolom Číhaná'),
      ]),
    );

    const { container } = renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Porovnání nabídek')).toBeInTheDocument();
    });

    const panel = container.querySelector('.tf-pipeline-modal-panel');
    expect(screen.getByRole('dialog', { name: 'Porovnání nabídek' })).toHaveAccessibleDescription(
      'Zkontrolujte podklady, spusťte porovnání a otevřete hotový Excel.',
    );
    expect(panel).toHaveClass('h-screen');
    expect(panel).toHaveClass('w-screen');
    expect(panel).not.toHaveClass('max-w-6xl');
  });

  it('upřednostní mapovanou rozpočtovou přílohu jako základní poptávku', async () => {
    platformMocks.detectInputs.mockResolvedValue(
      detectedResult([
        detectedFile('automaticke-zadani.xlsx', '00 Zadání/automaticke-zadani.xlsx', 'zadani', null),
        detectedFile('zakladni-poptavka.pdf', 'Dokumentace/zakladni-poptavka.pdf', 'ignore', null),
        detectedFile('nabidka-kamenolom.xlsx', '01 Kamenolom Číhaná/nabidka-kamenolom.xlsx', 'offer', 'Kamenolom Číhaná'),
      ].map((file) => file.fileName.endsWith('.pdf') ? { ...file, sourceFormat: 'pdf' as const, requiresNormalization: true, analysis: null } : file)),
    );

    renderPanel(vi.fn(), {
      source: 'dochub', fileName: 'zakladni-poptavka.pdf', relativePath: 'Dokumentace/zakladni-poptavka.pdf',
      selectedAt: '2026-07-16T00:00:00.000Z', enabled: true,
    });

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Typ souboru zakladni-poptavka.pdf' })).toHaveValue('zadani');
      expect(screen.getByRole('combobox', { name: 'Typ souboru automaticke-zadani.xlsx' })).toHaveValue('ignore');
    });
  });

  it('zavře dialog klávesou Escape a vrátí fokus', async () => {
    platformMocks.detectInputs.mockResolvedValue(detectedResult([]));
    const onClose = vi.fn();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = renderPanel(onClose);
    await screen.findByRole('dialog', { name: 'Porovnání nabídek' });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('otevře nastavení agenta v administraci místo nástrojů', async () => {
    platformMocks.detectInputs.mockResolvedValue(detectedResult([]));

    renderPanel();

    await waitFor(() => {
      expect(platformMocks.detectInputs).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Pokročilé nastavení' }));

    expect(navigate).toHaveBeenCalledWith('/app/settings?tab=admin&subTab=bidComparison');
  });

  it('zobrazí alternativní porovnání, když složka nemá soubor zadání', async () => {
    platformMocks.detectInputs.mockResolvedValue({
      ...detectedResult([
        detectedFile('nabidka-kamenolom.xlsx', '01 Kamenolom Číhaná/nabidka-kamenolom.xlsx', 'offer', 'Kamenolom Číhaná'),
        detectedFile('nabidka-doprava.xlsx', '02 Doprava/nabidka-doprava.xlsx', 'offer', 'Doprava'),
      ]),
      warnings: ['Nebyl nalezen vhodný soubor zadání. Porovnání bude možné spustit pouze z dodaných nabídek.'],
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Alternativní ocenění')).toBeInTheDocument();
    });

    expect(screen.getByText('Rozpočet chybí')).toBeInTheDocument();
    expect(screen.getByText('Rozpočet chybí, porovnání se vytvoří z dodavatelských nabídek.')).toBeInTheDocument();
    expect(screen.queryByText(/Nebyl nalezen vhodný soubor zadání/)).not.toBeInTheDocument();
    expect(screen.getByText('Cenová matice')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Kamenolom Číhaná' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Doprava' })).toBeInTheDocument();
  });

  it('blokuje spuštění, když nabídka nemá přiřazeného dodavatele', async () => {
    platformMocks.detectInputs.mockResolvedValue(
      detectedResult([
        detectedFile('zadani.xlsx', '00 Zadání/zadani.xlsx', 'zadani', null),
        detectedFile('neprirazena-nabidka.xlsx', '01 Neznámý/neprirazena-nabidka.xlsx', 'offer', null),
      ]),
    );

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Každá nabídka musí mít přiřazeného dodavatele.')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Porovnat nabídky' })).toBeDisabled();
  });

  it('po dokončeném jobu označí nejnižší cenu v náhledu výstupu', async () => {
    platformMocks.detectInputs.mockResolvedValue(
      detectedResult([
        detectedFile('nabidka-kamenolom.xlsx', '01 Kamenolom Číhaná/nabidka-kamenolom.xlsx', 'offer', 'Kamenolom Číhaná'),
        detectedFile('nabidka-doprava.xlsx', '02 Doprava/nabidka-doprava.xlsx', 'offer', 'Doprava'),
      ]),
    );
    platformMocks.start.mockResolvedValue({ jobId: 'job-1' });
    platformMocks.get.mockResolvedValue({
      id: 'job-1',
      projectId: 'project-1',
      categoryId: 'category-1',
      tenderFolderPath: '/Tender/Vyberove-rizeni',
      status: 'success',
      progressPercent: 100,
      step: 'Hotovo',
      logs: ['Hotovo'],
      startedAt: '2026-06-21T20:00:00.000Z',
      finishedAt: '2026-06-21T20:00:01.000Z',
      outputPath: '/Tender/Vyberove-rizeni/porovnani-nabidek.xlsx',
      outputLatestPath: '/Tender/Vyberove-rizeni/porovnani-nabidek-latest.xlsx',
      outputWorkbookPath: '/Tender/Vyberove-rizeni/porovnani-nabidek-latest.xlsx',
      agentAnalysisStatus: 'disabled',
      agentAnalysisError: null,
      agentRecommendationWrittenAt: null,
      error: null,
      stats: {
        pocetPolozek: 1,
        sourceMode: 'offers_only',
        suppliers: {
          'Kamenolom Číhaná': { sparovano: 1, nesparovano: [], round: 0, variant: 1 },
          Doprava: { sparovano: 1, nesparovano: [], round: 0, variant: 1 },
        },
        matrix: [
          {
            pc: '1',
            kod: 'MAT-1',
            popis: 'Kamenivo frakce 0/32',
            mj: 't',
            mnozstvi: 10,
            radek: 5,
            offers: {
              'Kamenolom Číhaná': {
                supplierName: 'Kamenolom Číhaná',
                displayLabel: 'Kamenolom Číhaná',
                round: 0,
                variant: 1,
                jcena: 100,
                celkem: 1000,
                matched: true,
              },
              Doprava: {
                supplierName: 'Doprava',
                displayLabel: 'Doprava',
                round: 0,
                variant: 1,
                jcena: 130,
                celkem: 1300,
                matched: true,
              },
            },
          },
        ],
      },
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Porovnat nabídky' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Porovnat nabídky' }));

    await waitFor(() => {
      expect(screen.getByText('nejnižší')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(platformMocks.get).toHaveBeenCalledTimes(2);
    });

    await new Promise((resolve) => window.setTimeout(resolve, 800));
    expect(platformMocks.get).toHaveBeenCalledTimes(2);
  });
});
