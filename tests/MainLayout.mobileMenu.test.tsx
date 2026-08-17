import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MainLayout } from '@/components/layouts/MainLayout';
import type { Project, User, View } from '@/types';
import type { ThemeSkin } from '@/shared/types/theme';

vi.mock('@/components/Sidebar', () => ({
  Sidebar: () => <aside data-testid="sidebar" />,
}));

vi.mock('@shared/ui/ConfirmationModal', () => ({
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

vi.mock('@infra/platform/platformAdapter', () => ({
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
  setIsSidebarOpen = vi.fn(),
  skin: ThemeSkin = 'industrial',
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
      setIsSidebarOpen={setIsSidebarOpen}
      currentView={currentView}
      projects={projects}
      selectedProjectId="project-1"
      onProjectSelect={vi.fn()}
      user={user}
      theme="system"
      skin={skin}
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
  it.each([
    ['classic', 'bg-white/95'],
    ['industrial', 'bg-[var(--tf-skin-surface-deep)]'],
    ['space', 'bg-[#080b14]/95'],
  ] as const)('zobrazí viditelný desktopový rail pro skin %s', (skin, skinClass) => {
    const setIsSidebarOpen = vi.fn();
    renderMainLayout(false, 'project', 1, setIsSidebarOpen, skin);

    const rail = screen.getByTestId('sidebar-reveal-rail');
    const button = screen.getByRole('button', { name: 'Rozbalit hlavní menu' });
    const label = screen.getByText('Rozbalit menu');

    expect(button).toBe(rail);
    expect(rail).toHaveClass('hidden', 'h-full', 'w-12', 'flex-none', 'justify-center', 'md:flex', skinClass);
    expect(rail).not.toHaveClass('rounded-lg');
    expect(label).toHaveClass('[writing-mode:vertical-rl]', 'rotate-180');
    expect(button).toHaveAttribute('aria-controls', 'app-sidebar');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);
    expect(setIsSidebarOpen).toHaveBeenCalledWith(true);
  });

  it('vykreslí stabilní mobilní toggle mimo obsah hlavičky', () => {
    const setIsSidebarOpen = vi.fn();
    renderMainLayout(false, 'project', 1, setIsSidebarOpen);

    const button = screen.getByRole('button', { name: 'Zobrazit sidebar' });

    expect(button).toHaveClass('left-2', 'top-2', 'z-40', 'h-11', 'w-11');
    expect(button).toHaveAttribute('aria-controls', 'app-sidebar');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);
    expect(setIsSidebarOpen).toHaveBeenCalledWith(true);
  });

  it('při otevřeném sidebaru nabídne stmavené pozadí pro zavření', () => {
    const setIsSidebarOpen = vi.fn();
    renderMainLayout(true, 'project', 1, setIsSidebarOpen);

    expect(
      screen.queryByRole('button', { name: 'Zobrazit sidebar' }),
    ).not.toBeInTheDocument();

    const backdrop = screen.getByRole('button', {
      name: 'Zavřít navigační panel kliknutím mimo něj',
    });
    expect(backdrop).toHaveClass(
      'left-[min(20rem,calc(100vw-3rem))]',
      'z-40',
      'max-md:block',
    );

    fireEvent.click(backdrop);
    expect(setIsSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('při zmenšení UI použije ostré layoutové škálování bez transformace celého plátna', () => {
    const { container } = renderMainLayout(false, 'project', 0.8);

    const viewport = container.querySelector('.tf-app-viewport');
    const shell = container.querySelector('.tf-app-shell') as HTMLElement;

    expect(viewport).toHaveClass('fixed', 'inset-0', 'overflow-hidden');
    expect(shell.style.zoom).toBe('0.8');
    expect(shell.style.transform).toBe('');
    expect(shell.style.width).toBe('125vw');
    expect(shell.style.height).toBe('125dvh');
  });
});
