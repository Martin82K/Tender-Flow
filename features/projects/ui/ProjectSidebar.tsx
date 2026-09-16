import React, { useEffect, useRef, useState } from 'react';
import { FEATURES, type FeatureKey } from '@/config/features';
import type { Project, ProjectTab } from '@/types';
import { PROJECT_NAVIGATION } from '@features/projects/model/projectNavigation';

interface ProjectSidebarProps {
  compact?: boolean;
  onExpand?: () => void;
  projects: Project[];
  hasFeature: (feature: FeatureKey) => boolean;
  selectedProjectId: string;
  activeTab: string;
  activeSettingsTab?: string;
  onSelect: (id: string, tab?: string, settingsTab?: 'pd' | 'templates' | 'dochub') => void;
}

export function ProjectSidebar({ projects, selectedProjectId, activeTab, activeSettingsTab = 'pd', onSelect, hasFeature, compact = false, onExpand }: ProjectSidebarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [contractsOpen, setContractsOpen] = useState(activeTab === 'contracts' || activeTab === 'contracts-client');
  useEffect(() => {
    if (activeTab === 'contracts' || activeTab === 'contracts-client') setContractsOpen(true);
  }, [activeTab, selectedProjectId]);
  const [settingsOpen, setSettingsOpen] = useState(activeTab === 'project-settings');
  useEffect(() => {
    if (activeTab === 'project-settings') setSettingsOpen(true);
  }, [activeTab, activeSettingsTab, selectedProjectId]);
  const settingsTabs = [
    { id: 'pd' as const, label: 'Odkazy PD', icon: 'folder_open', visible: true },
    { id: 'templates' as const, label: 'Šablony', icon: 'history_edu', visible: hasFeature(FEATURES.DYNAMIC_TEMPLATES) || hasFeature(FEATURES.DEMAND_GENERATION) || hasFeature(FEATURES.LOSER_EMAIL) },
    { id: 'dochub' as const, label: 'Složkomat', icon: 'cloud_sync', visible: hasFeature(FEATURES.DOC_HUB) },
  ].filter(item => item.visible);
  const selectedSettingsTab = settingsTabs.find(item => item.id === activeSettingsTab)?.id ?? 'pd';
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const project = projects.find(item => item.id === selectedProjectId);
  const tabs = PROJECT_NAVIGATION.filter(tab => !tab.feature || hasFeature(tab.feature));
  const selectedTab: ProjectTab = tabs.find(tab => tab.id === activeTab)?.id ?? 'overview';
  useEffect(() => { setOpen(false); setQuery(''); }, [selectedProjectId]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  if (!project) return <p className="px-6 py-3 text-xs text-slate-500">Vyberte stavbu ve Správě staveb.</p>;
  const choices = projects.filter(item => item.status !== 'archived' || item.id === selectedProjectId)
    .filter(item => `${item.name} ${item.location}`.toLocaleLowerCase('cs').includes(query.toLocaleLowerCase('cs')));
  return <div className="tf-project-context">
    <div ref={container} onKeyDown={event => {
      if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    }}>
      <button ref={trigger} type="button" className="tf-project-switcher w-full px-6 py-4 text-left"
        aria-label={`Změnit stavbu: ${project.name}`} aria-expanded={open} aria-controls="sidebar-project-picker"
        onClick={() => { if (compact) onExpand?.(); setOpen(!open); setQuery(''); }}>
        {compact && <span aria-hidden="true" className="material-symbols-outlined">domain</span>}
        <span className="tf-sidebar-label flex items-center justify-between gap-2 font-semibold text-sm">
          <span className="min-w-0 break-words">{project.name}</span>
          <span aria-hidden="true" className="material-symbols-outlined text-lg">expand_more</span>
        </span>
        <span className="tf-sidebar-label mt-1 block text-xs opacity-70">{project.status === 'archived' ? 'Archiv' : project.status === 'realization' ? 'V realizaci' : 'V soutěži'}</span>
      </button>
      {open && <div id="sidebar-project-picker" className="border-y border-slate-300 dark:border-slate-700 p-3">
        <input autoFocus type="search" aria-label="Hledat stavbu" placeholder="Hledat stavbu…" value={query}
          onChange={event => setQuery(event.target.value)} className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent p-2 text-sm" />
        <div className="mt-2 max-h-60 overflow-y-auto">
          {choices.map(item => <button key={item.id} type="button" aria-label={`${item.name} · ${item.location || 'Bez lokace'} · ${item.status === 'realization' ? 'V realizaci' : item.status === 'archived' ? 'Archiv' : 'V soutěži'}`}
            aria-current={item.id === project.id ? 'true' : undefined}
            className="block w-full rounded-md px-2 py-2 text-left text-sm hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            onClick={() => { setOpen(false); if (selectedTab === 'project-settings') onSelect(item.id, selectedTab, selectedSettingsTab); else onSelect(item.id, selectedTab); }}>
            {item.name}{item.id === project.id && <span aria-hidden="true"> ✓</span>}
            <span className="block text-xs text-slate-500">{item.location || 'Bez lokace'} · {item.status === 'realization' ? 'V realizaci' : item.status === 'archived' ? 'Archiv' : 'V soutěži'}</span>
          </button>)}
          {!choices.length && <p className="p-2 text-sm">Žádná odpovídající stavba.</p>}
        </div>
      </div>}
    </div>
    <nav aria-label="Sekce stavby" className="mt-3">
      {tabs.map(tab => <React.Fragment key={tab.id}>
        {tab.id === 'contracts-client' && <button type="button" aria-label="Smlouvy"
          aria-expanded={contractsOpen} aria-controls="sidebar-contract-parties"
          className="tf-project-nav-row flex w-full items-center gap-2.5 border-l-2 border-transparent px-6 py-2.5 text-left text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          onClick={() => setContractsOpen(!contractsOpen)}>
          <span aria-hidden="true" className="material-symbols-outlined text-lg">description</span>
          <span className="tf-sidebar-label">Smlouvy</span>
          <span aria-hidden="true" className="tf-sidebar-label material-symbols-outlined ml-auto text-lg">{contractsOpen ? 'expand_less' : 'expand_more'}</span>
        </button>}
        {tab.id === 'contracts-client' && contractsOpen && <div id="sidebar-contract-parties" role="group" aria-label="Smluvní strany">
          {tabs.filter(item => item.id === 'contracts' || item.id === 'contracts-client').map(item => <button key={item.id} type="button" aria-label={item.label}
            aria-current={item.id === selectedTab ? 'page' : undefined} data-active={item.id === selectedTab}
            className="tf-project-nav-row flex w-full items-center gap-2.5 border-l-2 border-transparent pl-11 pr-6 py-2.5 text-left text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            onClick={() => onSelect(project.id, item.id)}>
            <span aria-hidden="true" className="material-symbols-outlined text-lg">{item.icon}</span><span className="tf-sidebar-label">{item.label}</span>
          </button>)}
        </div>}
        {tab.id === 'project-settings' && <>
          <button type="button" aria-label="Nastavení stavby" aria-expanded={settingsOpen} aria-controls="sidebar-project-settings"
            className="tf-project-nav-row flex w-full items-center gap-2.5 border-l-2 border-transparent px-6 py-2.5 text-left text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            onClick={() => setSettingsOpen(!settingsOpen)}>
            <span aria-hidden="true" className="material-symbols-outlined text-lg">settings</span>
            <span className="tf-sidebar-label">Nastavení stavby</span>
            <span aria-hidden="true" className="tf-sidebar-label material-symbols-outlined ml-auto text-lg">{settingsOpen ? 'expand_less' : 'expand_more'}</span>
          </button>
          {settingsOpen && <div id="sidebar-project-settings" role="group" aria-label="Nastavení stavby">
            {settingsTabs.map(item => <button key={item.id} type="button" aria-label={item.label}
              aria-current={selectedTab === 'project-settings' && selectedSettingsTab === item.id ? 'page' : undefined}
              data-active={selectedTab === 'project-settings' && selectedSettingsTab === item.id}
              className="tf-project-nav-row flex w-full items-center gap-2.5 border-l-2 border-transparent pl-11 pr-6 py-2.5 text-left text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              onClick={() => onSelect(project.id, 'project-settings', item.id)}>
              <span aria-hidden="true" className="material-symbols-outlined text-lg">{item.icon}</span><span className="tf-sidebar-label">{item.label}</span>
            </button>)}
          </div>}
        </>}
        {tab.id !== 'contracts' && tab.id !== 'contracts-client' && tab.id !== 'project-settings' && <button type="button" aria-label={tab.label}
        aria-current={tab.id === selectedTab ? 'page' : undefined} data-active={tab.id === selectedTab}
        data-help-id="project-sidebar-tab"
        className="tf-project-nav-row flex w-full items-center gap-2.5 border-l-2 border-transparent px-6 py-2.5 text-left text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        onClick={() => onSelect(project.id, tab.id)}>
        <span aria-hidden="true" data-help-id="project-sidebar-tab-icon" className="material-symbols-outlined text-lg">{tab.icon}</span>
        <span className="tf-sidebar-label">{tab.label}</span>
      </button>}
      </React.Fragment>)}
    </nav>
  </div>;
}
