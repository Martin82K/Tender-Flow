
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
              className="size-14 min-w-14 object-contain drop-shadow-md shrink-0"
            />
            <div className="flex flex-col min-w-0">
              <h1 className="text-white text-base font-bold leading-normal break-words">Construction CRM</h1>
              <p className="text-slate-500 text-xs font-normal break-words">Stavební divize</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-2 mt-4">
            <button
              onClick={() => onViewChange('dashboard')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${currentView === 'dashboard'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}
            >
              <span className={`material-symbols-outlined shrink-0 ${currentView === 'dashboard' ? 'fill' : ''}`}>dashboard</span>
              <p className="text-sm font-medium leading-normal break-words">Dashboard</p>
            </button>

            {/* Projects Accordion */}
            <details className="group" open>
              <summary className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer list-none ${currentView === 'project'
                ? 'text-white font-semibold'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`material-symbols-outlined shrink-0 ${currentView === 'project' ? 'fill text-emerald-400' : ''}`}>apartment</span>
                  <p className="text-sm leading-normal break-words">Stavby</p>
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
                    className={`flex items-center gap-2 text-left text-sm px-3 py-2 rounded-lg transition-all relative overflow-hidden ${currentView === 'project' && selectedProjectId === project.id
                      ? 'text-white font-medium'
                      : 'text-slate-500 hover:text-white hover:bg-slate-800/50'
                      }`}
                    title={project.name}
                  >
                    {/* Gradient highlight for selected project */}
                    {currentView === 'project' && selectedProjectId === project.id && (
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/30 via-primary/10 to-transparent rounded-lg border-l-2 border-primary" />
                    )}
                    <span className={`relative z-10 flex items-center justify-center size-5 rounded text-[11px] font-bold shrink-0 ${project.status === 'realization' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                      {project.status === 'realization' ? 'R' : 'S'}
                    </span>
                    <span className="relative z-10 break-words">{project.name}</span>
                  </button>
                ))}
              </div>
            </details>

            <button
              onClick={() => onViewChange('contacts')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${currentView === 'contacts'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}
            >
              <span className={`material-symbols-outlined shrink-0 ${currentView === 'contacts' ? 'fill' : ''}`}>handshake</span>
              <p className="text-sm font-medium leading-normal break-words">Subdodavatelé</p>
            </button>
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="mt-auto p-3 space-y-2 border-t border-slate-700/50">
          <button
            onClick={() => onViewChange('project-management')}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all ${currentView === 'project-management'
              ? 'bg-slate-800/80 text-white border border-slate-700/50'
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
              }`}
          >
            <span className="material-symbols-outlined shrink-0">domain_add</span>
            <span className="text-sm font-medium break-words">Správa staveb</span>
          </button>
          <button
            onClick={() => onViewChange('settings')}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all ${currentView === 'settings'
              ? 'bg-slate-800/80 text-white border border-slate-700/50'
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
              }`}
          >
            <span className="material-symbols-outlined shrink-0">settings</span>
            <span className="text-sm font-medium break-words">Nastavení</span>
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
          <div className="px-3 pb-2">
            <div className="h-px bg-slate-700/50 w-full my-3"></div>
            <p className="text-[11px] text-white/50 text-center leading-relaxed font-medium tracking-wide">
              Created by Kalmatech,<br />Martin Kalkuš
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};