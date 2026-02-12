import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ExcelUnlockerProSettings } from '../features/settings/ExcelUnlockerProSettings';

const uiMocks = vi.hoisted(() => ({
  showAlert: vi.fn(),
}));

const toolMocks = vi.hoisted(() => ({
  unlockExcelZipWithStats: vi.fn(),
}));

const trackingMocks = vi.hoisted(() => ({
  trackFeatureUsage: vi.fn(),
}));

vi.mock('../context/UIContext', () => ({
  useUI: () => uiMocks,
}));

vi.mock('@/utils/excelUnlockZip', () => ({
  unlockExcelZipWithStats: toolMocks.unlockExcelZipWithStats,
}));

vi.mock('../services/featureUsageService', () => ({
  trackFeatureUsage: trackingMocks.trackFeatureUsage,
}));

describe('ExcelUnlockerProSettings tracking', () => {
  beforeEach(() => {
    uiMocks.showAlert.mockReset();
    toolMocks.unlockExcelZipWithStats.mockReset();
    trackingMocks.trackFeatureUsage.mockReset();

    toolMocks.unlockExcelZipWithStats.mockResolvedValue({
      output: new Uint8Array([1, 2, 3]),
      worksheetCount: 5,
    });
    trackingMocks.trackFeatureUsage.mockResolvedValue(true);

    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => 'blob:test-url'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    });

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it('po úspěšném odemčení odešle usage tracking', async () => {
    const { container } = render(<ExcelUnlockerProSettings />);

    const input = container.querySelector('#excel-upload-trigger') as HTMLInputElement;
    const file = new File(['abc123'], 'rozpocet.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    Object.defineProperty(file, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /Odemknout soubor/i }));

    await waitFor(() => {
      expect(toolMocks.unlockExcelZipWithStats).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(trackingMocks.trackFeatureUsage).toHaveBeenCalledWith('excel_unlocker', {
        fileSizeBytes: file.size,
        unlockedSheetsCount: 5,
        minutesSavedEstimate: 10,
      });
    });
  });
});
