import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectSidebar } from '@features/projects/ui/ProjectSidebar';
import { FEATURES } from '@/config/features';
import type { Project } from '@/types';

const projects: Project[] = [
  { id: 'a', name: 'Alfa', location: 'Praha', status: 'tender' },
  { id: 'b', name: 'Beta', location: 'Brno', status: 'realization' },
  { id: 'c', name: 'Archiv', location: '', status: 'archived' },
];
function setup(activeTab = 'contracts', selectedProjectId = 'a') {
  const onSelect = vi.fn();
  render(<ProjectSidebar hasFeature={feature => feature !== FEATURES.MODULE_MAPS} projects={projects} selectedProjectId={selectedProjectId} activeTab={activeTab} onSelect={onSelect} />);
  return onSelect;
}
describe('Project workspace sidebar', () => {
  it('closes the picker on collapse and reopens search with one compact click', () => {
    const props = { hasFeature: () => true, projects, selectedProjectId: 'a', activeTab: 'overview', onSelect: vi.fn(), onExpand: vi.fn() };
    const { rerender } = render(<ProjectSidebar {...props} compact={false} />);
    const trigger = screen.getByRole('button', { name: /Změnit stavbu/ });
    fireEvent.click(trigger);
    const search = screen.getByRole('searchbox', { name: 'Hledat stavbu' });
    fireEvent.change(search, { target: { value: 'Beta' } });
    search.focus();
    rerender(<ProjectSidebar {...props} compact />);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    expect(props.onExpand).toHaveBeenCalledOnce();
    rerender(<ProjectSidebar {...props} compact={false} />);
    expect(screen.getByRole('searchbox', { name: 'Hledat stavbu' })).toHaveValue('');
    expect(screen.getByRole('searchbox', { name: 'Hledat stavbu' })).toHaveFocus();
  });

  it('distinguishes equally named projects by location when switching sections', () => {
    const onSelect = vi.fn();
    render(<ProjectSidebar hasFeature={() => true} projects={[
      { id: 'a', name: 'Škola', location: 'Praha', status: 'tender' },
      { id: 'b', name: 'Škola', location: 'Brno', status: 'realization' },
    ]} selectedProjectId="a" activeTab="contracts" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Změnit stavbu/ }));
    expect(screen.getByRole('button', { name: /Škola.*Praha/ })).toHaveTextContent('Praha');
    fireEvent.click(screen.getByRole('button', { name: /Škola.*Brno/ }));
    expect(onSelect).toHaveBeenCalledWith('b', 'contracts');
  });
  it('opens settings children and selects their route', () => {
    const onSelect = setup('project-settings');
    expect(screen.getByRole('button', { name: 'Nastavení stavby', exact: true })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Odkazy PD', exact: true })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: 'Šablony', exact: true }));
    expect(onSelect).toHaveBeenCalledWith('a', 'project-settings', 'templates');
  });
  it('hides unavailable settings features', () => {
    render(<ProjectSidebar hasFeature={() => false} projects={projects} selectedProjectId="a" activeTab="project-settings" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Odkazy PD', exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Šablony', exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Složkomat', exact: true })).not.toBeInTheDocument();
  });
  it('hides both contract parties when the contracts module is unavailable', () => {
    render(<ProjectSidebar hasFeature={feature => feature !== FEATURES.MODULE_CONTRACTS} projects={projects} selectedProjectId="a" activeTab="contracts-client" onSelect={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Smlouvy', exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Objednatel', exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Subdodavatel', exact: true })).not.toBeInTheDocument();
  });
  it('expands contracts into client and supplier and selects the client route', () => {
    const onSelect = setup('contracts-client');
    expect(screen.getByRole('button', { name: 'Smlouvy', exact: true })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Objednatel', exact: true })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: 'Subdodavatel', exact: true }));
    expect(onSelect).toHaveBeenCalledWith('a', 'contracts');
    fireEvent.click(screen.getByRole('button', { name: 'Objednatel', exact: true }));
    expect(onSelect).toHaveBeenLastCalledWith('a', 'contracts-client');
    fireEvent.click(screen.getByRole('button', { name: 'Smlouvy', exact: true }));
    expect(screen.queryByRole('button', { name: 'Objednatel', exact: true })).not.toBeInTheDocument();
  });
  it('keeps the available section when switching project and omits archived choices', () => {
    const onSelect = setup();
    fireEvent.click(screen.getByRole('button', { name: /Změnit stavbu/ }));
    expect(screen.queryByRole('button', { name: 'Archiv' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Beta · Brno/ }));
    expect(onSelect).toHaveBeenCalledWith('b', 'contracts');
  });
  it('falls back to overview when the requested feature is unavailable', () => {
    const onSelect = setup('map');
    expect(screen.queryByRole('button', { name: 'Mapa' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Změnit stavbu/ }));
    fireEvent.click(screen.getByRole('button', { name: /Beta · Brno/ }));
    expect(onSelect).toHaveBeenCalledWith('b', 'overview');
  });
  it('closes the picker with Escape and restores keyboard focus', () => {
    setup();
    const trigger = screen.getByRole('button', { name: /Změnit stavbu/ });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
  it('does not expose a workspace for an inaccessible project', () => {
    setup('overview', 'not-in-accessible-list');
    expect(screen.queryByRole('navigation', { name: 'Sekce stavby' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Změnit stavbu/ })).not.toBeInTheDocument();
  });
  it('retains navigation for an archived project opened by deep link', () => {
    setup('documents', 'c');
    expect(screen.getByRole('button', { name: 'Dokumenty' })).toHaveAttribute('aria-current', 'page');
  });
});
