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
  settingsTab?: 'user' | 'tools' | 'organization' | 'admin';
  settingsSubTab?: 'profile' | 'notifications' | 'backup' | 'contacts' | 'excelUnlocker' | 'excelMerger' | 'excelIndexer' | 'urlShortener' | 'registration' | 'users' | 'organizations' | 'subscriptions' | 'ai' | 'incidents' | 'compliance' | 'tools';
}

export const SIDEBAR_NAVIGATION: NavItemConfig[] = [
  {
    id: 'command-center',
    label: 'Command Center',
    icon: 'radar',
    view: 'command-center',
    feature: FEATURES.MODULE_COMMAND_CENTER,
  },
  {
    id: 'dashboard',
    label: 'Přehled',
    icon: 'dashboard',
    view: 'dashboard',
    feature: FEATURES.MODULE_DASHBOARD,
  },
  {
    id: 'contacts',
    label: 'Subdodavatelé',
    icon: 'handshake',
    view: 'contacts',
    feature: FEATURES.MODULE_CONTACTS,
  },
  {
    id: 'projects', // Special handling in Sidebar for accordion
    label: 'Stavby',
    icon: 'apartment',
    view: 'project',
    feature: FEATURES.MODULE_PROJECTS,
    type: 'group'
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
        id: 'settings-contacts-import',
        label: 'Import kontaktů',
        icon: 'upload_file',
        view: 'settings',
        feature: FEATURES.CONTACTS_IMPORT,
        settingsTab: 'tools',
        settingsSubTab: 'contacts',
      },
      {
        id: 'settings-excelunlocker-pro',
        label: 'Excel Unlocker PRO',
        icon: 'lock_open',
        view: 'settings',
        feature: FEATURES.EXCEL_UNLOCKER,
        settingsTab: 'tools',
        settingsSubTab: 'excelUnlocker',
      },
      {
        id: 'settings-excelmerger-pro',
        label: 'Excel Merger PRO',
        icon: 'table_view',
        view: 'settings',
        feature: FEATURES.EXCEL_MERGER,
        settingsTab: 'tools',
        settingsSubTab: 'excelMerger',
      },
      {
        id: 'settings-excel-indexer',
        label: 'Excel Indexer',
        icon: 'join_inner',
        view: 'settings',
        feature: FEATURES.EXCEL_INDEXER,
        settingsTab: 'tools',
        settingsSubTab: 'excelIndexer',
      },
      {
        id: 'settings-url-shortener',
        label: 'URL Zkracovač',
        icon: 'link',
        view: 'settings',
        feature: FEATURES.URL_SHORTENER,
        settingsTab: 'tools',
        settingsSubTab: 'urlShortener',
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
