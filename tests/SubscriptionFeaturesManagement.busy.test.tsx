import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionFeaturesManagement } from '@/features/settings/SubscriptionFeaturesManagement';

const mocks = vi.hoisted(() => ({ save: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock('@features/subscription/api', () => ({
  listSubscriptionFeatures: async () => [{ key: 'ai_ocr', name: 'Povolit OCR', category: 'AI moduly' }, { key: 'export_pdf', name: 'Export PDF', category: 'Export' }],
  listSubscriptionTierFlags: async () => [],
  setSubscriptionTierFlag: mocks.save,
  createSubscriptionFeature: vi.fn(),
  deleteSubscriptionFeature: mocks.remove,
  updateSubscriptionFeature: mocks.update,
}));
vi.mock('@/context/UIContext', () => ({ useUI: () => ({ showAlert: vi.fn(), showConfirm: vi.fn().mockResolvedValue(true) }) }));

describe('ukládání společných pravidel tarifu', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('blokuje další přepínače a hlásí zaneprázdnění do dokončení zápisu', async () => {
    let finish!: () => void;
    mocks.save.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    const onBusyChange = vi.fn();
    render(<SubscriptionFeaturesManagement onBusyChange={onBusyChange} />);
    const free = await screen.findByRole('button', { name: 'Povolit OCR – Free' });
    const pro = screen.getByRole('button', { name: 'Povolit OCR – Pro' });
    fireEvent.click(free);
    expect(free).toBeDisabled();
    expect(pro).toBeDisabled();
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(pro);
    await waitFor(() => expect(mocks.save).toHaveBeenCalledExactlyOnceWith('free', 'ai_ocr', true));
    fireEvent.click(screen.getByText('Export PDF', { exact: true }));
    expect(screen.getByRole('button', { name: /Uložit$/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Smazat$/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Obnovit$/ })).toBeDisabled();
    finish();
    await waitFor(() => expect(pro).toBeEnabled());
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    expect(free).toHaveAttribute('aria-pressed', 'true');
  });

  it.each(['metadata', 'delete'] as const)('blokuje přepnutí během zápisu %s i po zavření detailu', async (action) => {
    let finish!: () => void;
    const write = action === 'metadata' ? mocks.update : mocks.remove;
    write.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    const onBusyChange = vi.fn();
    render(<SubscriptionFeaturesManagement onBusyChange={onBusyChange} />);
    fireEvent.click(await screen.findByText('Export PDF', { exact: true }));
    fireEvent.click(screen.getByRole('button', { name: action === 'metadata' ? /Uložit$/ : /Smazat$/ }));
    await waitFor(() => expect(write).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Zavřít detail funkce' }));
    const toggle = screen.getByRole('button', { name: 'Povolit OCR – Free' });
    expect(toggle).toBeDisabled();
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(toggle);
    expect(mocks.save).not.toHaveBeenCalled();
    finish();
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
    expect(await screen.findByRole('button', { name: 'Povolit OCR – Free' })).toBeEnabled();
  });

});
