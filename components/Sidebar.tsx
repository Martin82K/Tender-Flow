
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { View, Project } from '../types';
import logo from '../assets/logo.png';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  selectedProjectId: string;
  onProjectSelect: (id: string) => void;
  projects: Project[];
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, selectedProjectId, onProjectSelect, projects }) => {
  const { user, logout } = useAuth();
  const [width, setWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const sidebarRef = useRef<HTMLElement>(null);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        const newWidth = mouseMoveEvent.clientX;
        // Min width 200px, Max width 480px
        if (newWidth >= 200 && newWidth <= 480) {
          setWidth(newWidth);
        }
      }
    },
    [isResizing]
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  // Load display name
  useEffect(() => {
    if (user?.id) {
      loadDisplayName();
    }
  }, [user?.id]);

  const loadDisplayName = async () => {
    try {
      const { supabase } = await import('../services/supabase');
      const { data, error } = await supabase
        .from('user_profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();

      if (data?.display_name) {
        setDisplayName(data.display_name);
      }
    } catch (error) {
      // Silently fail - display name is optional
    }
  };

  return (
    <aside
      ref={sidebarRef}
      style={{ width: `${width}px` }}
      className="relative flex h-full flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-r border-slate-700/50 flex-shrink-0 z-20 select-none group/sidebar"
    >
      {/* Resizer Handle */}
      <div
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-emerald-500 active:bg-emerald-500 transition-colors z-50 translate-x-[50%]"
        onMouseDown={startResizing}
      />

      <div className="flex h-full flex-col justify-between p-4 overflow-hidden">
        <div className="flex flex-col gap-4 flex-1">
          {/* Logo */}
          <div className="flex items-center gap-3 p-2 min-w-0">
            <img
              src={logo}
              alt="Construction CRM Logo"
              className="size-10 min-w-10 object-contain drop-shadow-md"
            />
            <div className="flex flex-col overflow-hidden">
              <h1 className="text-white text-base font-bold leading-normal truncate">Construction CRM</h1>
              <p className="text-slate-500 text-xs font-normal truncate">Stavební divize</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-2 mt-4">
            <button
              onClick={() => onViewChange('dashboard')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all overflow-hidden ${currentView === 'dashboard'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}
            >
              <span className={`material-symbols-outlined ${currentView === 'dashboard' ? 'fill' : ''}`}>dashboard</span>
              <p className="text-sm font-medium leading-normal truncate">Dashboard</p>
            </button>

            {/* Projects Accordion */}
            <details className="group" open={currentView === 'project' || currentView === 'dashboard' || currentView === 'settings'}>
              <summary className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer list-none overflow-hidden ${currentView === 'project'
                ? 'text-white font-semibold'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}>
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className={`material-symbols-outlined ${currentView === 'project' ? 'fill text-emerald-400' : ''}`}>foundation</span>
                  <p className="text-sm leading-normal truncate">Stavby</p>
                </div>
                <span className="material-symbols-outlined text-[20px] transition-transform group-open:rotate-180 shrink-0">expand_more</span>
              </summary>

              <div className="flex flex-col mt-1 ml-2 gap-1">
                {projects.length === 0 && <div className="px-4 py-2 text-xs text-slate-500 italic">Žádné aktivní stavby</div>}
                {projects.map(project => (
                  <button
                    key={project.id}
                    onClick={() => {
                      onProjectSelect(project.id);
                    }}
                    className={`flex items-center gap-2 text-left text-sm px-3 py-2 rounded-lg transition-all truncate ${currentView === 'project' && selectedProjectId === project.id
                      ? 'bg-slate-800/80 text-white font-medium border border-slate-700/50'
                      : 'text-slate-500 hover:text-white hover:bg-slate-800/50'
                      }`}
                    title={project.name}
                  >
                    <span className={`material-symbols-outlined text-[16px] ${project.status === 'realization' ? 'text-amber-500' : 'text-blue-400'
                      }`}>
                      {project.status === 'realization' ? 'engineering' : 'edit_document'}
                    </span>
                    <span className="truncate">{project.name}</span>
                  </button>
                ))}
              </div>
            </details>

            <button
              onClick={() => onViewChange('contacts')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all overflow-hidden ${currentView === 'contacts'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}
            >
              <span className={`material-symbols-outlined ${currentView === 'contacts' ? 'fill' : ''}`}>groups</span>
              <p className="text-sm font-medium leading-normal truncate">Subdodavatelé</p>
            </button>
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col gap-2 overflow-hidden mt-auto pt-4 border-t border-slate-700/50">
          <button
            onClick={() => onViewChange('project-management')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all overflow-hidden ${currentView === 'project-management'
              ? 'bg-slate-800/80 text-white border border-slate-700/50'
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
              }`}
          >
            <span className="material-symbols-outlined">domain_add</span>
            <p className="text-sm font-medium leading-normal truncate">Správa staveb</p>
          </button>

          <button
            onClick={() => onViewChange('settings')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all overflow-hidden ${currentView === 'settings'
              ? 'bg-slate-800/80 text-white border border-slate-700/50'
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
              }`}
          >
            <span className="material-symbols-outlined">settings</span>
            <p className="text-sm font-medium leading-normal truncate">Nastavení</p>
          </button>

          <div className="flex items-center gap-3 px-3 py-3 mt-1 overflow-hidden bg-slate-800/30 rounded-xl border border-slate-700/30">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="size-8 min-w-8 rounded-full" />
            ) : (
              <div className="size-8 min-w-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400"></div>
            )}
            <div className="flex flex-col overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{displayName || user?.email?.split('@')[0] || 'User'}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{user?.role || 'User'}</p>
            </div>
            <button
              onClick={logout}
              className="ml-auto p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Odhlásit se"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          </div>

          {/* Footer Credit */}
          <div className="px-3 pb-1">
            <div className="h-px bg-slate-700/50 w-full my-2"></div>
            <p className="text-[10px] text-slate-600 text-center leading-tight">
              Created by Kalmatech,<br />Martin Kalkuš
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};