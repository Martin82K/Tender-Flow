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
  it('keeps the available section when switching project and omits archived choices', () => {
    const onSelect = setup();
    fireEvent.click(screen.getByRole('button', { name: /Změnit stavbu/ }));
    expect(screen.queryByRole('button', { name: 'Archiv' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));
    expect(onSelect).toHaveBeenCalledWith('b', 'contracts');
  });
  it('falls back to overview when the requested feature is unavailable', () => {
    const onSelect = setup('map');
    expect(screen.queryByRole('button', { name: 'Mapa' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Změnit stavbu/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));
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
