import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BidComparisonPanel } from '../components/pipelineComponents/BidComparisonPanel';
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

const renderPanel = () =>
  render(
    <BidComparisonPanel
      isOpen
      onClose={vi.fn()}
      projectId="project-1"
      categoryId="category-1"
      initialTenderFolderPath="/Tender/Vyberove-rizeni"
      supplierNames={['Kamenolom Číhaná', 'Doprava']}
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

  it('zobrazí alternativní porovnání, když složka nemá soubor zadání', async () => {
    platformMocks.detectInputs.mockResolvedValue(
      detectedResult([
        detectedFile('nabidka-kamenolom.xlsx', '01 Kamenolom Číhaná/nabidka-kamenolom.xlsx', 'offer', 'Kamenolom Číhaná'),
        detectedFile('nabidka-doprava.xlsx', '02 Doprava/nabidka-doprava.xlsx', 'offer', 'Doprava'),
      ]),
    );

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Alternativní porovnání')).toBeInTheDocument();
    });

    expect(screen.getByText('Bez zadání vznikne alternativní porovnání z dodaných nabídek.')).toBeInTheDocument();
    expect(screen.getByText('Struktura VŘ')).toBeInTheDocument();
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

    expect(screen.getByRole('button', { name: 'Spustit porovnání' })).toBeDisabled();
  });
});
