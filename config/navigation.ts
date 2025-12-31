import { FeatureKey, FEATURES } from '../config/features';
import { View } from '../types';

export interface NavItemConfig {
  id: string;
  label: string;
  icon: string;
  view: View; // The view ID used in App.tsx
  feature?: FeatureKey;
  type?: 'link' | 'group' | 'external';
  children?: NavItemConfig[];
  href?: string; // For external links
  // Optional deep-linking into Settings
  settingsTab?: 'user' | 'admin';
  settingsSubTab?: 'profile' | 'contacts' | 'tools';
}

export const SIDEBAR_NAVIGATION: NavItemConfig[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    view: 'dashboard',
    feature: FEATURES.MODULE_DASHBOARD,
  },
  {
    id: 'projects', // Special handling in Sidebar for accordion
    label: 'Stavby',
    icon: 'apartment',
    view: 'project',
    feature: FEATURES.MODULE_PROJECTS,
    type: 'group'
  },
  {
    id: 'contacts',
    label: 'Subdodavatelé',
    icon: 'handshake',
    view: 'contacts',
    feature: FEATURES.MODULE_CONTACTS,
  },
    // Pipeline is now part of Project tabs mostly, but if we had a global pipeline:
    // {
    //   id: 'pipeline',
    //   label: 'Pipeline',
    //   icon: 'view_kanban',
    //   view: 'pipeline',
    //   feature: FEATURES.MODULE_PIPELINE,
    // },
];

export const BOTTOM_NAVIGATION: NavItemConfig[] = [
  {
    id: 'tools',
    label: 'Nástroje',
    icon: 'build',
    view: 'settings',
    type: 'group',
    children: [
      {
        id: 'project-management',
        label: 'Správa staveb',
        icon: 'domain_add',
        view: 'project-management',
        feature: FEATURES.MODULE_PROJECTS,
      },
      {
        id: 'project-overview',
        label: 'Přehled staveb',
        icon: 'analytics',
        view: 'project-overview',
        feature: FEATURES.FEATURE_ADVANCED_REPORTING,
      },
      {
        id: 'settings-contacts-import',
        label: 'Import kontaktů',
        icon: 'upload_file',
        view: 'settings',
        settingsTab: 'user',
        settingsSubTab: 'contacts',
      },
      {
        id: 'settings-excelunlocker-pro',
        label: 'ExcelUnlocker Pro',
        icon: 'grid_on',
        view: 'settings',
        settingsTab: 'user',
        settingsSubTab: 'tools',
      },
    ],
  },
  {
    id: 'settings',
    label: 'Nastavení',
    icon: 'settings',
    view: 'settings',
    // Settings usually available to everyone, maybe sub-sections are gated
  },
];
