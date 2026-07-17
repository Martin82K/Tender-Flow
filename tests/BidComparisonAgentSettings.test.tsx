import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BID_COMPARISON_AGENT_SETTINGS_KEY } from '../shared/bidComparisonAgentSettings';
import { BidComparisonAgentSettings } from '../features/settings/BidComparisonAgentSettings';

const adapterMocks = vi.hoisted(() => ({
  storageGet: vi.fn(),
  storageSet: vi.fn(),
  hasAgentSecret: vi.fn(),
  saveAgentSecret: vi.fn(),
  clearAgentSecret: vi.fn(),
  testAgent: vi.fn(),
}));

vi.mock('../services/platformAdapter', () => ({
  default: {
    storage: { get: adapterMocks.storageGet, set: adapterMocks.storageSet },
    bidComparison: {
      hasAgentSecret: adapterMocks.hasAgentSecret,
      saveAgentSecret: adapterMocks.saveAgentSecret,
      clearAgentSecret: adapterMocks.clearAgentSecret,
      testAgent: adapterMocks.testAgent,
    },
  },
}));

describe('BidComparisonAgentSettings', () => {
  beforeEach(() => {
    Object.values(adapterMocks).forEach((mock) => mock.mockReset());
    adapterMocks.storageGet.mockResolvedValue(JSON.stringify({ enabled: true, baseUrl: 'https://agent.kalmatech.cz', timeoutMs: 60_000 }));
    adapterMocks.storageSet.mockResolvedValue(undefined);
    adapterMocks.hasAgentSecret.mockResolvedValue(true);
    adapterMocks.saveAgentSecret.mockResolvedValue(undefined);
    adapterMocks.clearAgentSecret.mockResolvedValue(undefined);
    adapterMocks.testAgent.mockResolvedValue({ success: true, endpoint: 'https://agent.kalmatech.cz/v1/tender-flow/analyze', status: 200, error: null });
  });

  it('po načtení a uložení ponechá uložený token viditelně zamaskovaný', async () => {
    render(<BidComparisonAgentSettings />);
    const tokenInput = await screen.findByLabelText('API token') as HTMLInputElement;
    await waitFor(() => expect(tokenInput.value).toBe('••••••••••••••••'));
    expect(screen.getByText('Token je uložený')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Uložit nastavení' }));
    await waitFor(() => expect(adapterMocks.storageSet).toHaveBeenCalledWith(BID_COMPARISON_AGENT_SETTINGS_KEY, expect.any(String)));
    expect(tokenInput.value).toBe('••••••••••••••••');
    expect(adapterMocks.saveAgentSecret).not.toHaveBeenCalled();
  });

  it('otestuje uložený token přes desktop API a zobrazí potvrzení HTTP 200', async () => {
    render(<BidComparisonAgentSettings />);
    await screen.findByText('Token je uložený');
    fireEvent.click(screen.getByRole('button', { name: 'Otestovat spojení' }));

    await waitFor(() => expect(adapterMocks.testAgent).toHaveBeenCalledWith(expect.objectContaining({
      enabled: true,
      baseUrl: 'https://agent.kalmatech.cz',
      bearerToken: '',
    })));
    expect(await screen.findByText('Hermes agent odpověděl HTTP 200.')).toBeInTheDocument();
  });
});
