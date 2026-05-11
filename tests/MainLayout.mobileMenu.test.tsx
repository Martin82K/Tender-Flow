import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MainLayout } from '@/components/layouts/MainLayout';
import type { Project, User, View } from '@/types';

vi.mock('@/components/Sidebar', () => ({
  Sidebar: () => <aside data-testid="sidebar" />,
}));

vi.mock('@/components/ConfirmationModal', () => ({
  ConfirmationModal: () => null,
}));

vi.mock('@/shared/ui/UserAccountMenu', () => ({
  UserAccountMenu: () => <button type="button">Uživatel</button>,
}));

vi.mock('@/shared/routing/router', () => ({
  navigate: vi.fn(),
}));

vi.mock('@/shared/routing/routeUtils', () => ({
  buildAppUrl: vi.fn(() => '/mock-path'),
}));

vi.mock('@/services/platformAdapter', () => ({
  default: {
    isDesktop: false,
    mcp: {
      setCurrentProject: vi.fn(),
    },
  },
}));

const user: User = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'user',
};

const projects: Project[] = [
  {
    id: 'project-1',
    name: 'Krajská nemocnice',
    location: 'Brno',
    status: 'tender',
  },
];

const renderMainLayout = (
  isSidebarOpen = false,
  currentView: View = 'project',
  uiScale = 1,
) =>
  render(
    <MainLayout
      uiModal={{
        isOpen: false,
        title: '',
        message: '',
        variant: 'info',
      }}
      closeUiModal={vi.fn()}
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={vi.fn()}
      currentView={currentView}
      projects={projects}
      selectedProjectId="project-1"
      onProjectSelect={vi.fn()}
      user={user}
      theme="system"
      skin="industrial"
      onSetTheme={vi.fn()}
      onSetSkin={vi.fn()}
      uiScale={uiScale}
      onSetUiScale={vi.fn()}
      onResetUiScale={vi.fn()}
      onLogout={vi.fn()}
      isBackgroundLoading={false}
      backgroundWarning={null}
      onReloadData={vi.fn()}
      onHideBackgroundWarning={vi.fn()}
    >
      <div>Obsah</div>
    </MainLayout>,
  );

describe('MainLayout mobile menu', () => {
  it('drží mobilní toggle nad sticky hlavičkami', () => {
    renderMainLayout(false);

    const button = screen.getByRole('button', { name: 'Zobrazit sidebar' });

    expect(button).toHaveClass('z-40');
    expect(button).not.toHaveClass('pointer-events-none');
  });

  it('při otevřeném sidebaru toggle skryje a vypne interakci', () => {
    renderMainLayout(true);

    const button = screen.getByRole('button', { name: 'Schovat sidebar' });

    expect(button).toHaveClass('opacity-0');
    expect(button).toHaveClass('pointer-events-none');
  });

  it('při zmenšení UI zachová viewport a zvětší interní layoutovou plochu', () => {
    const { container } = renderMainLayout(false, 'project', 0.8);

    const viewport = container.querySelector('.tf-app-viewport');
    const shell = container.querySelector('.tf-app-shell') as HTMLElement;

    expect(viewport).toHaveClass('fixed', 'inset-0', 'overflow-hidden');
    expect(shell.style.transform).toBe('scale(0.8)');
    expect(shell.style.width).toBe('125vw');
    expect(shell.style.height).toBe('125dvh');
  });
});
