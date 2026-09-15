import { FEATURES, type FeatureKey } from '@/config/features';
import type { ProjectTab } from '@/types';

export const PROJECT_NAVIGATION: ReadonlyArray<{
  id: ProjectTab;
  label: string;
  icon: string;
  feature?: FeatureKey;
}> = [
  { id: 'overview', label: 'Přehled', icon: 'dashboard' },
  { id: 'documents', label: 'Dokumenty', icon: 'folder' },
  { id: 'tender-plan', label: 'Plán VŘ', icon: 'assignment' },
  { id: 'pipeline', label: 'Výběrová řízení', icon: 'view_kanban', feature: FEATURES.MODULE_PIPELINE },
  { id: 'contracts-client', label: 'Objednatel', icon: 'account_balance', feature: FEATURES.MODULE_CONTRACTS },
  { id: 'contracts', label: 'Subdodavatel', icon: 'description', feature: FEATURES.MODULE_CONTRACTS },
  { id: 'schedule', label: 'Harmonogram', icon: 'calendar_month', feature: FEATURES.PROJECT_SCHEDULE },
  { id: 'map', label: 'Mapa', icon: 'map', feature: FEATURES.MODULE_MAPS },
  // Legacy URL key retained for existing links; this section manages the project team.
  { id: 'settings', label: 'Realizační tým', icon: 'groups' },
  { id: 'project-settings', label: 'Nastavení stavby', icon: 'settings' },
];
