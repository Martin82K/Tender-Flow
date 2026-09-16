import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MainLayout } from '@/components/layouts/MainLayout';
import type { Project, User, View } from '@/types';
import type { ThemeSkin } from '@/shared/types/theme';

let mobile = false;
const mediaListeners = new Set<() => void>();
vi.mock('@/components/Sidebar', () => ({
  Sidebar: ({ isOpen, isMobile, onToggle, desktopWidth, onDesktopWidthChange }: { isOpen: boolean; isMobile: boolean; onToggle: () => void; desktopWidth?: number; onDesktopWidthChange?: (width: number) => void }) =>
    <aside data-testid="sidebar" data-open={isOpen} data-mobile={isMobile} data-width={desktopWidth}>
      <button onClick={() => onDesktopWidthChange?.(360)}>Změnit šířku</button>
      {isOpen && isMobile && <button onClick={onToggle}>Zavřít menu</button>}
    </aside>,
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
  beforeEach(() => {
    mobile = false;
    vi.stubGlobal('matchMedia', () => ({ matches: mobile,
      addEventListener: (_event: string, listener: () => void) => mediaListeners.add(listener),
      removeEventListener: (_event: string, listener: () => void) => mediaListeners.delete(listener),
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); mediaListeners.clear(); });

  it.each(['classic', 'industrial', 'space'] as const)('delegates desktop mini navigation to Sidebar in %s', skin => {
    renderMainLayout(false, 'project', 1, vi.fn(), skin);
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'false');
    expect(screen.queryByTestId('sidebar-reveal-rail')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zobrazit sidebar' })).not.toBeInTheDocument();
  });

  it('opens the mobile menu independently of the desktop preference and isolates the background', () => {
    mobile = true;
    const setIsSidebarOpen = vi.fn();
    const { container } = renderMainLayout(true, 'project', 0.8, setIsSidebarOpen);
    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar).toHaveAttribute('data-open', 'false');
    expect(sidebar.closest('.tf-app-shell')).toBeNull();
    const button = screen.getByRole('button', { name: 'Zobrazit sidebar' });
    fireEvent.click(button);
    expect(sidebar).toHaveAttribute('data-open', 'true');
    expect(container.querySelector('.tf-app-shell')).toHaveAttribute('inert');
    expect(container.querySelector('#main-scroll-container')).toHaveClass('overflow-y-hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Zavřít menu' }));
    expect(sidebar).toHaveAttribute('data-open', 'false');
    expect(container.querySelector('.tf-app-shell')).not.toHaveAttribute('inert');
    expect(setIsSidebarOpen).not.toHaveBeenCalled();
  });

  it('preserves the desktop collapsed preference when switching to mobile and back', () => {
    const setIsSidebarOpen = vi.fn();
    renderMainLayout(false, 'project', 1, setIsSidebarOpen);
    const resize = (value: boolean) => act(() => { mobile = value; mediaListeners.forEach(listener => listener()); });
    resize(true);
    fireEvent.click(screen.getByRole('button', { name: 'Zobrazit sidebar' }));
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'true');
    resize(false);
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'false');
    resize(true);
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'false');
    expect(setIsSidebarOpen).not.toHaveBeenCalled();
  });

  it('preserves a resized desktop width across mobile breakpoints', () => {
    renderMainLayout(true);
    fireEvent.click(screen.getByRole('button', { name: 'Změnit šířku' }));
    act(() => { mobile = true; mediaListeners.forEach(listener => listener()); });
    act(() => { mobile = false; mediaListeners.forEach(listener => listener()); });
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-width', '360');
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
