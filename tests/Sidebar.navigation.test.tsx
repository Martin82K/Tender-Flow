import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
  FEATURES.MODULE_COMMAND_CENTER,
  FEATURES.MODULE_TASKS,
  FEATURES.FEATURE_ADVANCED_REPORTING,
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
  it('zobrazuje TODO Osobní jako první hlavní položku sidebaru', () => {
    const { container } = renderSidebar();

    expect(screen.getByRole('button', { name: /TODO Osobní/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Správa staveb/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Přehledy/i })).toBeInTheDocument();

    const mainNavItems = Array.from(container.querySelectorAll('[data-help-id="sidebar-nav-item"]'));
    expect(mainNavItems[0]).toHaveTextContent(/TODO Osobní/i);
  });

  it('naviguje ze sidebaru na TODO Osobní, správu staveb a přehledy', () => {
    const onViewChange = vi.fn();
    renderSidebar(onViewChange);

    fireEvent.click(screen.getByRole('button', { name: /TODO Osobní/i }));
    fireEvent.click(screen.getByRole('button', { name: /Správa staveb/i }));
    fireEvent.click(screen.getByRole('button', { name: /Přehledy/i }));

    expect(onViewChange).toHaveBeenNthCalledWith(1, 'todo', undefined);
    expect(onViewChange).toHaveBeenNthCalledWith(2, 'project-management', undefined);
    expect(onViewChange).toHaveBeenNthCalledWith(3, 'project-overview', undefined);
  });

  it('označí aktivní položku pro nový industrial skin', () => {
    renderSidebar(vi.fn(), 'project-overview');

    const overviewButton = screen.getByRole('button', { name: /Přehledy/i });

    expect(overviewButton).toHaveAttribute('data-help-id', 'sidebar-nav-item');
    expect(overviewButton).toHaveAttribute('data-active', 'true');
    expect(overviewButton).toHaveAttribute('aria-current', 'page');
  });
});
