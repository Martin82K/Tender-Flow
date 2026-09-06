import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminSettings } from '@/features/settings/AdminSettings';

const mocks = vi.hoisted(() => ({
  features: vi.fn(),
  flags: vi.fn(),
  write: vi.fn(),
  navigate: vi.fn(),
  registration: vi.fn(),
}));
vi.mock('@/features/subscription/api', () => ({
  listSubscriptionFeatures: mocks.features,
  listSubscriptionTierFlags: mocks.flags,
}));
vi.mock('@/features/settings/SubscriptionFeaturesManagement', () => ({
  SubscriptionFeaturesManagement: ({ onBusyChange }: { onBusyChange?: (busy: boolean) => void }) => (
    <>
      <button onClick={() => { mocks.write(); onBusyChange?.(true); }}>Testovací změna tarifu</button>
      <button onClick={() => onBusyChange?.(false)}>Dokončit uložení</button>
    </>
  ),
}));
vi.mock('@/features/settings/UserManagement', () => ({ UserManagement: () => null }));
vi.mock('@/features/settings/EmailWhitelistManagement', () => ({ EmailWhitelistManagement: () => null }));
vi.mock('@/features/settings/AIApiTest', () => ({ AIApiTest: () => null }));
vi.mock('@/features/settings/EmailTestPanel', () => ({ EmailTestPanel: () => null }));
vi.mock('@features/auth/api', () => ({ authService: { getAppSettings: mocks.registration } }));
vi.mock('@/context/UIContext', () => ({ useUI: () => ({ showAlert: vi.fn() }) }));
vi.mock('@/shared/routing/router', () => ({ navigate: mocks.navigate }));

const renderAdmin = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <AdminSettings isAdmin section="subscriptions" />
  </QueryClientProvider>,
);

describe('administrace balíčků', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.features.mockResolvedValue([
      { key: 'module_projects', name: 'Projekty' },
      { key: 'export_pdf', name: 'Export PDF' },
    ]);
    mocks.flags.mockResolvedValue([
      { tier: 'free', featureKey: 'module_projects', enabled: true },
      { tier: 'free', featureKey: 'export_pdf', enabled: false },
      { tier: 'pro', featureKey: 'export_pdf', enabled: true },
      { tier: 'pro', featureKey: 'unknown', enabled: true },
    ]);
  });

  it('zobrazuje balíčky pouze pro čtení a nenačítá registrační nastavení', async () => {
    renderAdmin();
    const free = await screen.findByRole('region', { name: 'Free' });
    expect(within(free).getByText('Projekty')).toBeInTheDocument();
    expect(within(free).queryByText('Export PDF')).not.toBeInTheDocument();
    const pro = screen.getByRole('region', { name: 'Pro' });
    expect(within(pro).getByText('Export PDF')).toBeInTheDocument();
    expect(within(pro).queryByText('unknown')).not.toBeInTheDocument();
    expect(screen.queryByText('module_projects')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Testovací změna tarifu' })).not.toBeInTheDocument();
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.registration).not.toHaveBeenCalled();
  });

  it('otevírá správu firem přes existující URL', async () => {
    renderAdmin();
    fireEvent.click(await screen.findByRole('button', { name: 'Spravovat firmy' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/app/settings?tab=admin&subTab=organizations');
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it('otevírá matici jen na požádání a při návratu obnoví přehled', async () => {
    renderAdmin();
    await screen.findByRole('region', { name: 'Free' });
    const open = screen.getByRole('button', { name: 'Otevřít pokročilou správu' });
    expect(open).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(open);
    expect(screen.getByText(/Změny se ukládají okamžitě/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Testovací změna tarifu' }));
    expect(mocks.write).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Zavřít pokročilou správu' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Dokončit uložení' }));
    mocks.flags.mockResolvedValue([{ tier: 'free', featureKey: 'export_pdf', enabled: true }]);
    fireEvent.click(screen.getByRole('button', { name: 'Zavřít pokročilou správu' }));
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Free' })).getByText('Export PDF')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Testovací změna tarifu' })).not.toBeInTheDocument();
  });

  it('při chybě neprezentuje prázdné tarify jako platná data a umožní opakování', async () => {
    mocks.flags.mockRejectedValueOnce(new Error('sensitive backend details'));
    renderAdmin();
    expect(await screen.findByRole('alert')).toHaveTextContent('Přehled balíčků se nepodařilo načíst');
    expect(screen.queryByRole('region', { name: 'Free' })).not.toBeInTheDocument();
    expect(screen.queryByText('sensitive backend details')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByRole('region', { name: 'Free' })).toBeInTheDocument();
  });

  it('rozlišuje prázdný katalog od načítání', async () => {
    mocks.features.mockResolvedValue([]);
    renderAdmin();
    expect(await screen.findByText('Katalog funkcí je prázdný.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Free' })).not.toBeInTheDocument();
  });

  it('bez oprávnění administrátora nic nenačítá ani nezobrazuje', () => {
    const { container } = render(<AdminSettings isAdmin={false} section="subscriptions" />);
    expect(container).toBeEmptyDOMElement();
    expect(mocks.features).not.toHaveBeenCalled();
    expect(mocks.flags).not.toHaveBeenCalled();
  });
});
