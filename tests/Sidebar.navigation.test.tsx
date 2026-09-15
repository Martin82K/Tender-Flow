import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from '@/components/Sidebar';
import { FEATURES, type FeatureKey } from '@/config/features';
import type { User } from '@/types';

const user: User = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'user',
  subscriptionTier: 'pro',
};

const enabledFeatures: FeatureKey[] = [
  FEATURES.MODULE_PROJECTS,
  FEATURES.MODULE_CONTACTS,
  FEATURES.MODULE_TASKS,
  FEATURES.FEATURE_ADVANCED_REPORTING,
  FEATURES.CONTACTS_IMPORT,
  FEATURES.EXCEL_UNLOCKER,
  FEATURES.EXCEL_MERGER,
  FEATURES.EXCEL_INDEXER,
];

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user }),
}));

vi.mock('@/context/FeatureContext', () => ({
  useFeatures: () => ({
    hasFeature: (feature: FeatureKey) => enabledFeatures.includes(feature),
  }),
}));

vi.mock('@/shared/routing/router', () => ({
  useLocation: () => ({ search: '' }),
  navigate: vi.fn(),
}));

const renderSidebar = (
  onViewChange = vi.fn(),
  currentView: React.ComponentProps<typeof Sidebar>['currentView'] = 'todo',
) => {
  const result = render(
    <Sidebar
      currentView={currentView}
      onViewChange={onViewChange}
      selectedProjectId=""
      onProjectSelect={vi.fn()}
      projects={[]}
      isOpen
      onToggle={vi.fn()}
      skin="industrial"
    />,
  );

  return { ...result, onViewChange };
};

describe('Sidebar navigation', () => {
  it('používá na mobilu omezenou šířku off-canvas panelu', () => {
    const { container } = renderSidebar();
    const sidebar = container.querySelector('#app-sidebar');

    expect(sidebar).toHaveClass(
      'max-md:!w-[min(20rem,calc(100vw-3rem))]',
      'max-md:shadow-2xl',
    );
    expect(
      screen.getByRole('button', { name: 'Zavřít sidebar' }),
    ).toHaveAttribute('aria-controls', 'app-sidebar');
  });

  it('zobrazuje Dodavatele nahoře a TODO Osobní dole', () => {
    const { container } = renderSidebar();

    expect(screen.getByRole('button', { name: /TODO Osobní/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Command Center/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Správa staveb/i })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Pohledy staveb' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Přehledy/i })).toBeInTheDocument();

    const mainNavItems = Array.from(container.querySelectorAll('[data-help-id="sidebar-nav-item"]'));
    expect(within(screen.getByRole('navigation', { name: 'Oblasti aplikace' })).getByRole('button', { name: 'Dodavatelé' })).toBeInTheDocument();
    expect(mainNavItems.at(-1)).toHaveTextContent(/TODO Osobní/i);
  });

  it('opens contacts from the horizontal panel and hides unrelated portfolio views', () => {
    const { onViewChange } = renderSidebar(vi.fn(), 'contacts');
    const contacts = within(screen.getByRole('navigation', { name: 'Oblasti aplikace' })).getByRole('button', { name: 'Dodavatelé' });
    expect(contacts).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('navigation', { name: 'Pohledy staveb' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Dodavatelé' })).toHaveLength(1);
    fireEvent.click(contacts);
    expect(onViewChange).toHaveBeenCalledWith('contacts', undefined);
  });

  it('naviguje ze sidebaru na TODO Osobní, správu staveb a přehledy', () => {
    const onViewChange = vi.fn();
    renderSidebar(onViewChange);

    fireEvent.click(screen.getByRole('button', { name: /TODO Osobní/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Stavby', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Přehledy', exact: true }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Přehledy' })).getByRole('button', { name: /Přehledy/i }));

    expect(onViewChange).toHaveBeenNthCalledWith(1, 'todo', undefined);
    expect(onViewChange).toHaveBeenNthCalledWith(2, 'project-management', undefined);
    expect(onViewChange).toHaveBeenNthCalledWith(3, 'project-overview', undefined);
  });

  it('nabízí nástroje v hlavním sidebaru jako alternativu k profilovému menu', () => {
    const onViewChange = vi.fn();
    renderSidebar(onViewChange);

    fireEvent.click(screen.getByText('Nástroje'));

    expect(screen.queryByRole('button', { name: /Porovnání nabídek/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Excel – odemčení/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Excel Spojení listů/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Excel Indexace VŘ/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Excel – odemčení/i }));

    expect(onViewChange).toHaveBeenCalledWith('settings', {
      settingsTab: 'tools',
      settingsSubTab: 'excelUnlocker',
    });
  });

  it('označí aktivní položku pro nový industrial skin', () => {
    renderSidebar(vi.fn(), 'project-overview');

    const overviewButton = within(screen.getByRole('navigation', { name: 'Přehledy' })).getByRole('button', { name: /Přehledy/i });

    expect(overviewButton).toHaveAttribute('data-help-id', 'sidebar-nav-item');
    expect(overviewButton).toHaveAttribute('data-active', 'true');
    expect(overviewButton).toHaveAttribute('aria-current', 'page');
  });
});

it('otevře menu jediné stavby přímo a přepne projekt přes hledání', () => {
  const onProjectSelect = vi.fn();
  render(<Sidebar currentView="project" selectedProjectId="a" projects={[
    { id: 'a', name: 'Stavba Alfa', location: 'Praha', status: 'tender' },
    { id: 'b', name: 'Stavba Beta', location: 'Brno', status: 'realization' },
  ]} onViewChange={vi.fn()} onProjectSelect={onProjectSelect} isOpen onToggle={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Přehled' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('button', { name: 'Realizační tým' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Změnit stavbu/ }));
  fireEvent.change(screen.getByRole('searchbox', { name: 'Hledat stavbu' }), { target: { value: 'Beta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Stavba Beta' }));
  expect(onProjectSelect).toHaveBeenCalledWith('b', 'overview');
  expect(screen.queryByRole('searchbox', { name: 'Hledat stavbu' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Rozpočet' })).not.toBeInTheDocument();
});

it('otevře portfolio přes vodorovný přepínač Stavby', () => {
  const { onViewChange } = renderSidebar();
  fireEvent.click(screen.getByRole('button', { name: 'Stavby', exact: true }));
  expect(onViewChange).toHaveBeenCalledWith('project-management', undefined);
});

it('umístí sbalení vedle značky a ponechá mobilní zavření', () => {
  const onToggle = vi.fn();
  render(<Sidebar currentView="project-management" selectedProjectId="" projects={[]}
    onViewChange={vi.fn()} onProjectSelect={vi.fn()} isOpen onToggle={onToggle} />);
  const collapse = screen.getByRole('button', { name: 'Sbalit menu' });
  expect(collapse.closest('.tf-sidebar-brand')).not.toBeNull();
  expect(collapse).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(collapse);
  expect(onToggle).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Zavřít sidebar' })).toHaveClass('md:hidden');
});
