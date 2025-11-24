
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ProjectLayout } from './components/ProjectLayout';
import { Contacts } from './components/Contacts';
import { Settings } from './components/Settings';
import { View, ProjectTab, Project, ProjectDetails, StatusConfig, DemandCategory } from './types';
import { MOCK_PROJECTS, PROJECTS_DB } from './data';

const DEFAULT_STATUSES: StatusConfig[] = [
  { id: 'available', label: 'K dispozici', color: 'green' },
  { id: 'busy', label: 'Zaneprázdněn', color: 'red' },
  { id: 'waiting', label: 'Čeká', color: 'yellow' }
];

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  
  // State for detailed project data to allow editing
  const [allProjectDetails, setAllProjectDetails] = useState<Record<string, ProjectDetails>>(PROJECTS_DB);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('p1');
  
  // State for the internal project tabs (Overview, Pipeline, Docs)
  const [activeProjectTab, setActiveProjectTab] = useState<ProjectTab>('overview');

  // Contact Statuses State
  const [contactStatuses, setContactStatuses] = useState<StatusConfig[]>(DEFAULT_STATUSES);

  // Dark Mode Management
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
        return document.documentElement.classList.contains('dark') || 
               window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleProjectSelect = (id: string) => {
    setSelectedProjectId(id);
    setCurrentView('project');
    setActiveProjectTab('overview');
  };

  const handleAddProject = (newProject: Project) => {
      setProjects(prev => [...prev, newProject]);
      // Also initialize details for the new project
      setAllProjectDetails(prev => ({
          ...prev,
          [newProject.id]: {
              title: newProject.name,
              investor: '',
              technicalSupervisor: '',
              location: newProject.location,
              finishDate: 'TBD',
              siteManager: 'TBD',
              constructionManager: '',
              constructionTechnician: '',
              plannedCost: 0,
              categories: [],
              contract: {
                  maturity: 30,
                  warranty: 60,
                  retention: '0 %',
                  siteFacilities: 0,
                  insurance: 0
              },
              investorFinancials: {
                  sodPrice: 0,
                  amendments: []
              }
          }
      }));
  };

  const handleDeleteProject = (id: string) => {
      setProjects(prev => prev.filter(p => p.id !== id));
      if (selectedProjectId === id) {
          setCurrentView('dashboard');
      }
      // Optional: Clean up details from allProjectDetails
  };

  const handleArchiveProject = (id: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status: 'archived' } : p));
  };

  const handleUpdateProjectDetails = (id: string, updates: Partial<ProjectDetails>) => {
      setAllProjectDetails(prev => ({
          ...prev,
          [id]: { ...prev[id], ...updates }
      }));
  };

  const handleAddCategory = (projectId: string, newCategory: DemandCategory) => {
    setAllProjectDetails(prev => ({
        ...prev,
        [projectId]: {
            ...prev[projectId],
            categories: [...prev[projectId].categories, newCategory]
        }
    }));
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'project':
        return (
          <ProjectLayout 
            projectId={selectedProjectId} 
            projectDetails={allProjectDetails[selectedProjectId]}
            onUpdateDetails={(updates) => handleUpdateProjectDetails(selectedProjectId, updates)}
            onAddCategory={(category) => handleAddCategory(selectedProjectId, category)}
            activeTab={activeProjectTab}
            onTabChange={setActiveProjectTab}
          />
        );
      case 'contacts':
        return <Contacts statuses={contactStatuses} />;
      case 'settings':
        return (
            <Settings 
                darkMode={darkMode} 
                onToggleDarkMode={() => setDarkMode(!darkMode)}
                projects={projects}
                onAddProject={handleAddProject}
                onDeleteProject={handleDeleteProject}
                onArchiveProject={handleArchiveProject}
                contactStatuses={contactStatuses}
                onUpdateStatuses={setContactStatuses}
            />
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="relative flex h-screen w-full flex-row overflow-hidden bg-background-light dark:bg-background-dark">
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView}
        projects={projects.filter(p => p.status !== 'archived')}
        selectedProjectId={selectedProjectId}
        onProjectSelect={handleProjectSelect}
      />
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {renderView()}
      </main>
    </div>
  );
};

export default App;
