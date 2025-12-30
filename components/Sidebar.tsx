
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { View, Project } from '../types';
import logo from '../assets/logo.png';
import { SIDEBAR_NAVIGATION, BOTTOM_NAVIGATION } from '../config/navigation';
import { useFeatures } from '../context/FeatureContext';

// Admin role configuration (must match App.tsx)
const SUPERADMIN_EMAILS = ["martinkalkus82@gmail.com"];
const ADMIN_EMAILS = ["kalkus@baustav.cz"];

// Helper function to get display role
const getUserRole = (email: string | undefined, defaultRole?: string): string => {
  if (!email) return defaultRole || 'User';
  if (SUPERADMIN_EMAILS.includes(email)) return 'Superadmin';
  if (ADMIN_EMAILS.includes(email)) return 'Admin';
  return defaultRole || 'User';
};

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  selectedProjectId: string;
  onProjectSelect: (id: string) => void;
  projects: Project[];
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, selectedProjectId, onProjectSelect, projects, isOpen, onToggle }) => {
  const { user, logout } = useAuth();
  const { hasFeature } = useFeatures(); // Use feature context
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

  // Drag & Drop State for Projects
  const [projectOrder, setProjectOrder] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Load order from localStorage on mount
  useEffect(() => {
    const savedOrder = localStorage.getItem('projectOrder');
    if (savedOrder) {
      try {
        setProjectOrder(JSON.parse(savedOrder));
      } catch {
        setProjectOrder([]);
      }
    }
  }, []);

  // Get ordered projects (only non-archived)
  const activeProjects = projects.filter(p => p.status !== 'archived');
  const orderedProjects = [...activeProjects].sort((a, b) => {
    const aIndex = projectOrder.indexOf(a.id);
    const bIndex = projectOrder.indexOf(b.id);
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  // Drag handlers
  const handleProjectDragStart = (e: React.DragEvent, projectId: string) => {
    setDraggedId(projectId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleProjectDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleProjectDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const currentOrder = orderedProjects.map(p => p.id);
    const draggedIndex = currentOrder.indexOf(draggedId);
    const targetIndex = currentOrder.indexOf(targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null);
      return;
    }

    currentOrder.splice(draggedIndex, 1);
    currentOrder.splice(targetIndex, 0, draggedId);

    setProjectOrder(currentOrder);
    localStorage.setItem('projectOrder', JSON.stringify(currentOrder));
    setDraggedId(null);
  };

  const handleProjectDragEnd = () => {
    setDraggedId(null);
  };

  // Helper to render nav items
  const renderNavItem = (item: any) => {
    // Check feature flag
    if (item.feature && !hasFeature(item.feature)) {
      return null;
    }

    // Special case for projects group which acts as accordion
    if (item.id === 'projects') {
      return (
        <details key={item.id} className="group" open>
          <summary className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer list-none ${currentView === 'project'
            ? 'text-white font-semibold'
             : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
             }`}>
            <div className="flex items-center gap-3 min-w-0">
              <span className={`material-symbols-outlined shrink-0 ${currentView === 'project' ? 'fill text-emerald-400' : ''}`}>{item.icon}</span>
              <p className="text-sm leading-normal break-words">{item.label}</p>
            </div>
            <span className="material-symbols-outlined text-[20px] transition-transform group-open:rotate-180 shrink-0">expand_more</span>
          </summary>

          <div className="flex flex-col mt-1 ml-2 gap-1">
            {orderedProjects.length === 0 && <div className="px-4 py-2 text-xs text-slate-500 italic">Žádné aktivní stavby</div>}
            {orderedProjects.map(project => (
              <div
                key={project.id}
                draggable
                onDragStart={(e) => handleProjectDragStart(e, project.id)}
                onDragOver={handleProjectDragOver}
                onDrop={(e) => handleProjectDrop(e, project.id)}
                onDragEnd={handleProjectDragEnd}
                onClick={() => onProjectSelect(project.id)}
                className={`flex items-center gap-2 text-left text-sm px-3 py-2 rounded-lg transition-all relative overflow-hidden cursor-move ${currentView === 'project' && selectedProjectId === project.id
                  ? 'text-slate-900 dark:text-white font-medium'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
                  } ${draggedId === project.id ? 'opacity-50' : ''}`}
                title={project.name}
              >
                {/* Gradient highlight for selected project */}
                {currentView === 'project' && selectedProjectId === project.id && (
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/30 via-primary/10 to-transparent rounded-lg border-l-2 border-primary" />
                )}
                <span className="material-symbols-outlined text-slate-600 text-[16px] cursor-grab active:cursor-grabbing relative z-10 shrink-0">
                  drag_indicator
                </span>
                <span className={`relative z-10 flex items-center justify-center size-5 rounded text-[11px] font-bold shrink-0 ${project.status === 'realization' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                  {project.status === 'realization' ? 'R' : 'S'}
                </span>
                <span className="relative z-10 break-words">{project.name}</span>
              </div>
            ))}
          </div>
        </details>
      );
    }

    if (item.type === 'external') {
      return (
        <a
          key={item.id}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
          title={item.label}
        >
          <span className="material-symbols-outlined shrink-0">{item.icon}</span>
          <span className="text-sm font-medium break-words">{item.label}</span>
          <span className="material-symbols-outlined ml-auto text-[18px] text-slate-500">open_in_new</span>
        </a>
      );
    }

    return (
      <button
        key={item.id}
        onClick={() => onViewChange(item.view)}
        className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all ${currentView === item.view
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
          }`}
      >
        <span className={`material-symbols-outlined shrink-0 ${currentView === item.view ? 'fill' : ''}`}>{item.icon}</span>
        <p className="text-sm font-medium leading-normal break-words">{item.label}</p>
      </button>
    );
  };

  return (
    <aside
      ref={sidebarRef}
      style={{ width: isOpen ? `${width}px` : '0px' }}
      className={`relative flex h-full flex-col bg-white dark:bg-gradient-to-b dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 border-r border-slate-200 dark:border-slate-700/50 flex-shrink-0 z-20 select-none group/sidebar transition-all duration-300 ease-in-out ${!isOpen ? 'overflow-hidden border-none' : ''}`}
    >
      {/* Mobile Overlay */}
      {!isOpen && (
        <style>{`
          @media (max-width: 767px) {
            .sidebar-overlay { display: none; }
          }
        `}</style>
      )}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-10 md:hidden sidebar-overlay"
          onClick={onToggle}
        />
      )}

      {/* Sidebar Content is moved into a wrapper to avoid layout jump during transition */}
      <div className={`flex flex-col h-full w-full min-w-[200px] ${!isOpen ? 'opacity-0 invisible' : 'opacity-100 visible'} transition-opacity duration-200`}>
        {/* Resizer Handle - only on desktop */}
        <div
          className="hidden md:block absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-emerald-500 active:bg-emerald-500 transition-colors z-50 translate-x-[50%]"
          onMouseDown={startResizing}
        />

        <div className="flex h-full flex-col justify-between p-4 overflow-hidden">
          <div className="flex flex-col gap-4 flex-1">
            {/* Logo */}
            <div className="flex items-center gap-3 p-2 min-w-0">
              <img
                src={logo}
                alt="Tender Flow Logo"
                className="size-14 min-w-14 object-contain drop-shadow-md shrink-0"
              />
              <div className="flex flex-1 flex-col min-w-0">
                <h1 className="text-slate-900 dark:text-white text-xl font-bold leading-tight whitespace-nowrap truncate">Tender Flow</h1>
                <p className="text-slate-500 text-[8px] font-normal leading-tight whitespace-nowrap truncate">Tender Management System</p>
              </div>
              {/* Close Toggle for Mobile */}
              <button
                onClick={onToggle}
                className="ml-auto p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors md:hidden flex items-center justify-center"
                title="Zavřít"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-2 mt-4">
              {SIDEBAR_NAVIGATION.map(renderNavItem)}
            </nav>
          </div>

          {/* Bottom Section */}
          <div className="mt-auto p-3 space-y-2 border-t border-slate-200 dark:border-slate-700/50">
            {/* Sidebar Toggle */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-700/50">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Skrýt panel</span>
              <button
                onClick={onToggle}
                className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center justify-center"
                title="Skrýt panel"
                aria-label="Skrýt panel"
              >
                <span className="material-symbols-outlined text-[22px]">toggle_on</span>
              </button>
            </div>

            {BOTTOM_NAVIGATION.map(renderNavItem)}

            <a
              href="/user-manual/index.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
              title="Otevře uživatelskou příručku v nové záložce"
            >
              <span className="material-symbols-outlined shrink-0">menu_book</span>
              <span className="text-sm font-medium break-words">Uživatelská příručka</span>
              <span className="material-symbols-outlined ml-auto text-[18px] text-slate-500">open_in_new</span>
            </a>

            <div className="flex items-center gap-3 px-3 py-3 mt-1 overflow-hidden bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-200 dark:border-slate-700/40">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="size-8 min-w-8 rounded-full" />
              ) : (
                <div className="size-8 min-w-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400"></div>
              )}
              <div className="flex flex-col overflow-hidden">
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{displayName || user?.email?.split('@')[0] || 'User'}</p>
                <p className="text-xs text-slate-500 truncate capitalize">{getUserRole(user?.email, user?.role)}</p>
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
              <p className="text-[13px] text-white/50 text-center leading-relaxed font-medium tracking-wide">
                Martin Kalkuš 2025
              </p>
              <p className="text-[10px] text-slate-600 text-center mt-1 font-mono hover:text-slate-500 transition-colors cursor-default">
                v0.9.3-251230
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
