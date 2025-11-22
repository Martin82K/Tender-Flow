
import React from 'react';
import { View } from '../types';
import { MOCK_PROJECTS } from '../data';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  selectedProjectId: string;
  onProjectSelect: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, selectedProjectId, onProjectSelect }) => {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-background-dark/50 flex-shrink-0 z-20">
      <div className="flex h-full flex-col justify-between p-4">
        <div className="flex flex-col gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 p-2">
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary text-white">
              <span className="material-symbols-outlined">construction</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-slate-800 dark:text-slate-200 text-base font-bold leading-normal">Nexus CRM</h1>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-normal">Construction Division</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-2 mt-4">
            <button
              onClick={() => onViewChange('dashboard')}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                currentView === 'dashboard'
                  ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
            >
              <span className={`material-symbols-outlined ${currentView === 'dashboard' ? 'fill' : ''}`}>dashboard</span>
              <p className="text-sm font-medium leading-normal">Dashboard</p>
            </button>

            {/* Projects Accordion */}
            <details className="group" open={currentView === 'project' || currentView === 'dashboard'}>
              <summary className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer list-none ${
                currentView === 'project'
                  ? 'text-slate-800 dark:text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}>
                <div className="flex items-center gap-3">
                   <span className={`material-symbols-outlined ${currentView === 'project' ? 'fill text-primary' : ''}`}>foundation</span>
                   <p className="text-sm leading-normal">Stavby</p>
                </div>
                <span className="material-symbols-outlined text-[20px] transition-transform group-open:rotate-180">expand_more</span>
              </summary>
              
              <div className="flex flex-col mt-1 ml-9 border-l border-slate-200 dark:border-slate-700 pl-2 gap-1">
                  {MOCK_PROJECTS.map(project => (
                      <button
                        key={project.id}
                        onClick={() => {
                            onProjectSelect(project.id);
                        }}
                        className={`text-left text-sm px-2 py-1.5 rounded-md transition-colors truncate ${
                            currentView === 'project' && selectedProjectId === project.id
                            ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white font-medium'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                          {project.name}
                      </button>
                  ))}
              </div>
            </details>

            <button
              onClick={() => onViewChange('contacts')}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                currentView === 'contacts'
                  ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
            >
              <span className={`material-symbols-outlined ${currentView === 'contacts' ? 'fill' : ''}`}>groups</span>
              <p className="text-sm font-medium leading-normal">Subdodavatelé</p>
            </button>
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col gap-2">
             <button
              onClick={() => onViewChange('settings')}
              className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <span className="material-symbols-outlined">settings</span>
              <p className="text-sm font-medium leading-normal">Nastavení</p>
            </button>
            <div className="flex items-center gap-3 px-3 py-3 mt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="size-8 rounded-full bg-gradient-to-tr from-primary to-blue-400"></div>
                <div className="flex flex-col">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Jan Novák</p>
                    <p className="text-xs text-slate-500">Project Manager</p>
                </div>
            </div>
        </div>
      </div>
    </aside>
  );
};