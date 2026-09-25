import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ProjectDetails, ProjectTab } from '@/types';

const budget = vi.hoisted(() => ({ loaded: false, mounts: vi.fn() }));
vi.mock('@features/projects/budget/ui/ConstructionBudget', () => {
  budget.loaded = true;
  return { ConstructionBudget: () => { budget.mounts(); return <div>Obsah rozpočtu</div>; } };
});
vi.mock('@/shared/ui/Header', () => ({ Header: () => <h1>Stavba</h1> }));
vi.mock('@/features/projects/ui/ProjectOverviewNew', () => ({ ProjectOverviewNew: () => <div>Přehled stavby</div> }));
vi.mock('@features/projects/contracts/hooks/useContractsWithDetails', () => ({ useContractsWithDetails: () => ({ contracts: [], loading: false }) }));
vi.mock('@/services/projectService', () => ({ projectService: { getMyProjectAccess: async () => ({}) } }));
vi.mock('@/context/FeatureContext', () => ({ useFeatures: () => ({ hasFeature: () => true }) }));

import { ProjectLayout } from '@features/projects/ProjectLayout';

afterEach(cleanup);

it('loads the budget module only when opened and reuses it after leaving and returning', async () => {
  const project = { id: 'p', title: 'Stavba', categories: [] } as unknown as ProjectDetails;
  const view = (activeTab: ProjectTab) => <ProjectLayout projectId="p" projectDetails={project} activeTab={activeTab}
    onTabChange={vi.fn()} onUpdateDetails={vi.fn()} onAddCategory={vi.fn()} contacts={[]}
    onAddContact={vi.fn()} onUpdateContact={vi.fn()}/>;
  const { rerender } = render(view('overview'));
  expect(screen.getByText('Přehled stavby')).toBeVisible();
  expect(budget.loaded).toBe(false);
  expect(budget.mounts).not.toHaveBeenCalled();
  rerender(view('budget'));
  expect(await screen.findByText('Obsah rozpočtu')).toBeVisible();
  expect(budget.loaded).toBe(true);
  rerender(view('overview'));
  expect(screen.queryByText('Obsah rozpočtu')).not.toBeInTheDocument();
  rerender(view('budget'));
  expect(await screen.findByText('Obsah rozpočtu')).toBeVisible();
});
