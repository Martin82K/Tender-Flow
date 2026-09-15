import React, { useEffect, useRef, useState } from 'react';
import type { FeatureKey } from '@/config/features';
import type { Project, ProjectTab } from '@/types';
import { PROJECT_NAVIGATION } from '@features/projects/model/projectNavigation';

interface ProjectSidebarProps {
  projects: Project[];
  hasFeature: (feature: FeatureKey) => boolean;
  selectedProjectId: string;
  activeTab: string;
  onSelect: (id: string, tab?: string) => void;
}

export function ProjectSidebar({ projects, selectedProjectId, activeTab, onSelect, hasFeature }: ProjectSidebarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
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
      if (event.key === 'Escape' && open) { setOpen(false); trigger.current?.focus(); }
    }}>
      <button ref={trigger} type="button" className="tf-project-switcher w-full px-6 py-4 text-left"
        aria-label={`Změnit stavbu: ${project.name}`} aria-expanded={open} aria-controls="sidebar-project-picker"
        onClick={() => { setOpen(!open); setQuery(''); }}>
        <span className="flex items-center justify-between gap-2 font-semibold text-sm">
          <span className="min-w-0 break-words">{project.name}</span>
          <span aria-hidden="true" className="material-symbols-outlined text-lg">expand_more</span>
        </span>
        <span className="mt-1 block text-xs opacity-70">{project.status === 'archived' ? 'Archiv' : project.status === 'realization' ? 'V realizaci' : 'V soutěži'} · Změnit stavbu</span>
      </button>
      {open && <div id="sidebar-project-picker" className="border-y border-slate-300 dark:border-slate-700 p-3">
        <input autoFocus type="search" aria-label="Hledat stavbu" placeholder="Hledat stavbu…" value={query}
          onChange={event => setQuery(event.target.value)} className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent p-2 text-sm" />
        <div className="mt-2 max-h-60 overflow-y-auto">
          {choices.map(item => <button key={item.id} type="button" aria-label={item.name}
            aria-current={item.id === project.id ? 'true' : undefined}
            className="block w-full rounded-md px-2 py-2 text-left text-sm hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            onClick={() => { setOpen(false); onSelect(item.id, selectedTab); }}>
            {item.name}{item.id === project.id && <span aria-hidden="true"> ✓</span>}
          </button>)}
          {!choices.length && <p className="p-2 text-sm">Žádná odpovídající stavba.</p>}
        </div>
      </div>}
    </div>
    <nav aria-label="Sekce stavby" className="mt-3">
      {tabs.map(tab => <button key={tab.id} type="button" aria-label={tab.label}
        aria-current={tab.id === selectedTab ? 'page' : undefined} data-active={tab.id === selectedTab}
        data-help-id="project-sidebar-tab"
        className="tf-project-nav-row flex w-full items-center gap-2.5 border-l-2 border-transparent px-6 py-2.5 text-left text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        onClick={() => onSelect(project.id, tab.id)}>
        <span aria-hidden="true" data-help-id="project-sidebar-tab-icon" className="material-symbols-outlined text-lg">{tab.icon}</span>
        {tab.label}
      </button>)}
    </nav>
  </div>;
}
