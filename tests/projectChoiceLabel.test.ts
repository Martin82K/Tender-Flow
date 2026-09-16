import { expect, it } from 'vitest';
import { projectChoiceLabel } from '@features/projects/model/projectOverviewModel';
import type { Project } from '@/types';

it('distinguishes same-name same-phase projects by location', () => {
  const projects: Project[] = [
    { id: 'a', name: 'Škola', location: 'Praha', status: 'tender' },
    { id: 'b', name: 'Škola', location: 'Brno', status: 'tender' },
  ];
  expect(projectChoiceLabel(projects[0], projects)).toContain('Praha');
  expect(projectChoiceLabel(projects[1], projects)).toContain('Brno');
});
it('uses identity to distinguish even identical location and phase', () => {
  const projects: Project[] = [
    { id: 'a', name: 'Škola', location: '', status: 'tender' },
    { id: 'b', name: 'Škola', location: '', status: 'tender' },
  ];
  expect(projectChoiceLabel(projects[0], projects)).not.toEqual(projectChoiceLabel(projects[1], projects));
});
