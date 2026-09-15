import { FEATURES, type FeatureKey } from '@/config/features';
import type { ProjectTab } from '@/types';

export const PROJECT_NAVIGATION: ReadonlyArray<{
  id: ProjectTab;
  label: string;
  icon: string;
  feature?: FeatureKey;
}> = [
  { id: 'overview', label: 'Přehled', icon: 'dashboard' },
  { id: 'tender-plan', label: 'Plán VŘ', icon: 'assignment' },
  { id: 'pipeline', label: 'Výběrová řízení', icon: 'view_kanban', feature: FEATURES.MODULE_PIPELINE },
  { id: 'contracts', label: 'Smlouvy', icon: 'description', feature: FEATURES.MODULE_CONTRACTS },
  { id: 'schedule', label: 'Harmonogram', icon: 'calendar_month', feature: FEATURES.PROJECT_SCHEDULE },
  { id: 'documents', label: 'Dokumenty', icon: 'folder' },
  { id: 'map', label: 'Mapa', icon: 'map', feature: FEATURES.MODULE_MAPS },
  { id: 'settings', label: 'Nastavení stavby', icon: 'settings' },
];
