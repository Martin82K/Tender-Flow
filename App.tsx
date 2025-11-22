import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ProjectLayout } from './components/ProjectLayout';
import { Contacts } from './components/Contacts';
import { View, ProjectTab } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('p1');
  
  // State for the internal project tabs (Overview, Pipeline, Docs)
  const [activeProjectTab, setActiveProjectTab] = useState<ProjectTab>('overview');

  const handleProjectSelect = (id: string) => {
    setSelectedProjectId(id);
    setCurrentView('project');
    setActiveProjectTab('overview'); // Default to overview when switching projects
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'project':
        return (
          <ProjectLayout 
            projectId={selectedProjectId} 
            activeTab={activeProjectTab}
            onTabChange={setActiveProjectTab}
          />
        );
      case 'contacts':
        return <Contacts />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="relative flex h-screen w-full flex-row overflow-hidden bg-background-light dark:bg-background-dark">
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView}
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