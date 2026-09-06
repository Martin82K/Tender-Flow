import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SubscriptionFeaturesManagement } from '@/features/settings/SubscriptionFeaturesManagement';

const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('@features/subscription/api', () => ({
  listSubscriptionFeatures: async () => [{ key: 'ai_ocr', name: 'Povolit OCR', category: 'AI moduly' }],
  listSubscriptionTierFlags: async () => [],
  setSubscriptionTierFlag: mocks.save,
  createSubscriptionFeature: vi.fn(),
  deleteSubscriptionFeature: vi.fn(),
  updateSubscriptionFeature: vi.fn(),
}));
vi.mock('@/context/UIContext', () => ({ useUI: () => ({ showAlert: vi.fn(), showConfirm: vi.fn() }) }));

describe('ukládání společných pravidel tarifu', () => {
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
    finish();
    await waitFor(() => expect(pro).toBeEnabled());
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    expect(free).toHaveAttribute('aria-pressed', 'true');
  });
});
