import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from '@/components/Sidebar';
import { FEATURES } from '@/config/features';
import { navigate } from '@/shared/routing/router';

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u', organizationId: 'o' } }) }));
vi.mock('@/context/FeatureContext', () => ({
  useFeatures: () => ({ hasFeature: (feature: string) => feature !== FEATURES.EXCEL_UNLOCKER }),
}));
vi.mock('@/shared/routing/router', () => ({ useLocation: () => ({ search: '' }), navigate: vi.fn() }));
vi.mock('@features/desktop-updater/ui/SidebarUpdateStatus', () => ({ SidebarUpdateStatus: () => null }));

function setup(overrides: Partial<React.ComponentProps<typeof Sidebar>> = {}) {
  const props = { currentView: 'project-management' as const, projects: [], selectedProjectId: '',
    onProjectSelect: vi.fn(), onViewChange: vi.fn(), isOpen: false, onToggle: vi.fn(), ...overrides };
  return { ...render(<Sidebar {...props} />), props };
}

describe('Sidebar responsive navigation', () => {
  it('preserves the selected section when collapsing and expanding the sidebar', () => {
    const { props, rerender } = setup({ isOpen: true });
    fireEvent.click(screen.getByRole('button', { name: 'Nástroje', exact: true }));
    for (const isOpen of [false, true]) {
      rerender(<Sidebar {...props} isOpen={isOpen} />);
      expect(screen.getByRole('button', { name: 'Nástroje', exact: true })).toHaveAttribute('aria-pressed', 'true');
      expect(within(screen.getByRole('navigation', { name: 'Nástroje' })).getByRole('button', { name: 'Excel Spojení listů' })).toBeInTheDocument();
      expect(props.onViewChange).not.toHaveBeenCalled();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Excel Spojení listů' }));
    expect(props.onViewChange).toHaveBeenCalledWith('settings', { settingsTab: 'tools', settingsSubTab: 'excelMerger' });
  });

  it.each(['classic', 'industrial', 'space'] as const)('keeps a working icon rail when collapsed in %s', skin => {
    const { container, props } = setup({ skin });
    expect(container.querySelector('#app-sidebar')).toHaveStyle({ width: '72px' });
    const contacts = screen.getByRole('button', { name: 'Dodavatelé' });
    fireEvent.click(contacts);
    expect(props.onViewChange).toHaveBeenCalledWith('contacts', undefined);
    expect(props.onToggle).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Rozbalit hlavní menu' }));
    expect(props.onToggle).toHaveBeenCalledOnce();
  });

  it('shows icon labels on keyboard focus and hover, and dismisses them on Escape', () => {
    setup();
    const contacts = screen.getByRole('button', { name: 'Dodavatelé' });
    fireEvent.focus(contacts);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Dodavatelé');
    fireEvent.keyDown(contacts, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseOver(contacts);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Dodavatelé');
    fireEvent.mouseLeave(contacts.closest('aside')!);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keeps portfolio deep links and feature guards in the mini menu', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Archiv', exact: true }));
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('status=archived'));
    fireEvent.click(screen.getByRole('button', { name: 'Nástroje', exact: true }));
    expect(screen.queryByRole('button', { name: 'Excel – odemčení' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Nástroje' })).getByRole('button', { name: 'Excel Spojení listů' })).toBeInTheDocument();
  });

  it('keeps project groups usable and expands before searching for another project', () => {
    const { props } = setup({ currentView: 'project', selectedProjectId: 'a',
      projects: [{ id: 'a', name: 'Alfa', location: 'Praha', status: 'tender' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Smlouvy', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Objednatel', exact: true }));
    expect(props.onProjectSelect).toHaveBeenCalledWith('a', 'contracts-client');
    fireEvent.click(screen.getByRole('button', { name: 'Změnit stavbu: Alfa' }));
    expect(props.onToggle).toHaveBeenCalledOnce();
  });

  it('treats the open mobile menu as a dialog and restores focus after closing', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const { props, rerender } = setup({ isMobile: true, isOpen: true });
    const dialog = screen.getByRole('dialog', { name: 'Hlavní navigace' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const close = screen.getByRole('button', { name: 'Zavřít sidebar' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'TODO Osobní' })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(props.onToggle).toHaveBeenCalledOnce();
    rerender(<Sidebar {...props} isOpen={false} />);
    expect(opener).toHaveFocus();
    expect(dialog).toHaveAttribute('inert');
    opener.remove();
  });

  it.each([
    { key: 'k', ctrlKey: true }, { key: 'k', metaKey: true },
    { key: 'k', ctrlKey: true, shiftKey: true }, { key: 'k', metaKey: true, shiftKey: true },
    { key: 'F1' },
  ])('blocks global modal shortcut %j only while the mobile dialog is open', shortcut => {
    const globalSearch = vi.fn();
    window.addEventListener('keydown', globalSearch);
    try {
      const { props, rerender } = setup({ isMobile: true, isOpen: true });
      fireEvent.keyDown(screen.getByRole('button', { name: 'Zavřít sidebar' }), shortcut);
      expect(globalSearch).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Zavřít sidebar' })).toHaveFocus();
      rerender(<Sidebar {...props} isOpen={false} />);
      fireEvent.keyDown(window, shortcut);
      expect(globalSearch).toHaveBeenCalledOnce();
    } finally { window.removeEventListener('keydown', globalSearch); }
  });

  it('closes mobile navigation after choosing a destination', () => {
    const { props } = setup({ isMobile: true, isOpen: true });
    fireEvent.click(screen.getByRole('button', { name: 'Dodavatelé' }));
    expect(props.onToggle).toHaveBeenCalledOnce();
  });

  it('closes the project picker with Escape before closing the mobile menu', () => {
    const { props } = setup({ isMobile: true, isOpen: true, currentView: 'project', selectedProjectId: 'a',
      projects: [{ id: 'a', name: 'Alfa', location: 'Praha', status: 'tender' }] });
    const picker = screen.getByRole('button', { name: 'Změnit stavbu: Alfa' });
    fireEvent.click(picker);
    fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Hledat stavbu' }), { key: 'Escape' });
    expect(props.onToggle).not.toHaveBeenCalled();
    expect(picker).toHaveFocus();
    fireEvent.keyDown(picker, { key: 'Escape' });
    expect(props.onToggle).toHaveBeenCalledOnce();
  });
});
