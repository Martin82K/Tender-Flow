
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './components/LandingPage';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ProjectLayout } from './components/ProjectLayout';
import { Contacts } from './components/Contacts';
import { Settings } from './components/Settings';
import { View, ProjectTab, Project, ProjectStatus, DemandCategory, ProjectDetails, Subcontractor, StatusConfig } from './types';
import { supabase } from './services/supabase';
import { mergeContacts, syncContactsFromUrl } from './services/contactsImportService';

// Default statuses (keep these as they're configuration)
const DEFAULT_STATUSES: StatusConfig[] = [
  { id: 'available', label: 'K dispozici', color: 'green' },
  { id: 'busy', label: 'Zaneprázdněn', color: 'red' },
  { id: 'waiting', label: 'Čeká', color: 'yellow' }
];

// Helper to convert Hex to RGB for Tailwind
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
    : '96 122 251'; // Default Fallback
};

const AppContent: React.FC = () => {
  const { isAuthenticated, login, register, updatePreferences, user, isLoading: authLoading } = useAuth();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  
  // Data States
  const [projects, setProjects] = useState<Project[]>([]);
  const [allProjectDetails, setAllProjectDetails] = useState<Record<string, ProjectDetails>>({});
  const [contacts, setContacts] = useState<Subcontractor[]>([]);
  const [contactStatuses, setContactStatuses] = useState<StatusConfig[]>(DEFAULT_STATUSES);
  
  // UI States
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [activeProjectTab, setActiveProjectTab] = useState<ProjectTab>('overview');
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Dark Mode Management
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Theme Color Management
  const [primaryColor, setPrimaryColor] = useState('#607AFB');
  const [backgroundColor, setBackgroundColor] = useState('#f5f6f8');

  // Sync preferences from user profile
  useEffect(() => {
    if (user?.preferences) {
      setDarkMode(user.preferences.darkMode);
      setPrimaryColor(user.preferences.primaryColor);
      setBackgroundColor(user.preferences.backgroundColor);
    }
  }, [user]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Update CSS Variable when color changes
  useEffect(() => {
    document.documentElement.style.setProperty('--color-primary', hexToRgb(primaryColor));
  }, [primaryColor]);

  // Update Background CSS Variable
  useEffect(() => {
    document.documentElement.style.setProperty('--color-background', backgroundColor);
  }, [backgroundColor]);

  // Load data from Supabase on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadInitialData();
    }
  }, [isAuthenticated]);

  const loadInitialData = async () => {
    setIsDataLoading(true);
    try {
      // Load projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      const loadedProjects: Project[] = (projectsData || []).map(p => ({
        id: p.id,
        name: p.name,
        location: p.location || '',
        status: p.status || 'realization'
      }));

      setProjects(loadedProjects);

      // Set first project as selected if available
      if (loadedProjects.length > 0 && !selectedProjectId) {
        setSelectedProjectId(loadedProjects[0].id);
      }

      // Load project details for all projects
      const detailsMap: Record<string, ProjectDetails> = {};
      
      for (const project of projectsData || []) {
        // Load categories for this project
        const { data: categoriesData } = await supabase
          .from('demand_categories')
          .select('*')
          .eq('project_id', project.id);

        const categories: DemandCategory[] = (categoriesData || []).map(c => ({
          id: c.id,
          title: c.title,
          budget: c.budget_display || '',
          sodBudget: c.sod_budget || 0,
          planBudget: c.plan_budget || 0,
          status: c.status || 'open',
          subcontractorCount: 0,
          description: c.description || ''
        }));

        // Load contract details
        const { data: contractData } = await supabase
          .from('project_contracts')
          .select('*')
          .eq('project_id', project.id)
          .single();

        // Load investor financials
        const { data: financialsData } = await supabase
          .from('project_investor_financials')
          .select('*')
          .eq('project_id', project.id)
          .single();

        // Load amendments
        const { data: amendmentsData } = await supabase
          .from('project_amendments')
          .select('*')
          .eq('project_id', project.id);

        detailsMap[project.id] = {
          title: project.name,
          investor: project.investor || '',
          technicalSupervisor: project.technical_supervisor || '',
          location: project.location || '',
          finishDate: project.finish_date || '',
          siteManager: project.site_manager || '',
          constructionManager: project.construction_manager || '',
          constructionTechnician: project.construction_technician || '',
          plannedCost: project.planned_cost || 0,
          documentationLink: project.documentation_link,
          inquiryLetterLink: project.inquiry_letter_link,
          categories,
          contract: contractData ? {
            maturity: contractData.maturity_days || 30,
            warranty: contractData.warranty_months || 60,
            retention: contractData.retention_terms || '',
            siteFacilities: contractData.site_facilities_percent || 0,
            insurance: contractData.insurance_percent || 0
          } : undefined,
          investorFinancials: financialsData ? {
            sodPrice: financialsData.sod_price || 0,
            amendments: (amendmentsData || []).map(a => ({
              id: a.id,
              label: a.label,
              price: a.price || 0
            }))
          } : undefined
        };
      }

      setAllProjectDetails(detailsMap);

      // Load all subcontractors
      const { data: subcontractorsData, error: subcontractorsError } = await supabase
        .from('subcontractors')
        .select('*')
        .order('company_name');

      if (subcontractorsError) throw subcontractorsError;

      const loadedContacts: Subcontractor[] = (subcontractorsData || []).map(s => ({
        id: s.id,
        company: s.company_name,
        name: s.contact_person_name || '-',
        specialization: s.specialization || 'Ostatní',
        phone: s.phone || '-',
        email: s.email || '-',
        ico: s.ico || '-',
        region: s.region || '-',
        status: s.status_id || 'available'
      }));

      setContacts(loadedContacts);

    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsDataLoading(false);
    }
  };

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
  };

  const handleArchiveProject = (id: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status: 'archived' } : p));
  };

  const handleUpdateProjectDetails = async (id: string, updates: Partial<ProjectDetails>) => {
    // Optimistic update
    setAllProjectDetails(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));

    // Persist to Supabase
    try {
      // Update main project fields
      const projectUpdates: any = {};
      if (updates.investor !== undefined) projectUpdates.investor = updates.investor;
      if (updates.technicalSupervisor !== undefined) projectUpdates.technical_supervisor = updates.technicalSupervisor;
      if (updates.siteManager !== undefined) projectUpdates.site_manager = updates.siteManager;
      if (updates.constructionManager !== undefined) projectUpdates.construction_manager = updates.constructionManager;
      if (updates.constructionTechnician !== undefined) projectUpdates.construction_technician = updates.constructionTechnician;
      if (updates.location !== undefined) projectUpdates.location = updates.location;
      if (updates.finishDate !== undefined) projectUpdates.finish_date = updates.finishDate;
      if (updates.plannedCost !== undefined) projectUpdates.planned_cost = updates.plannedCost;
      if (updates.documentationLink !== undefined) projectUpdates.documentation_link = updates.documentationLink;
      if (updates.inquiryLetterLink !== undefined) projectUpdates.inquiry_letter_link = updates.inquiryLetterLink;

      if (Object.keys(projectUpdates).length > 0) {
        const { error } = await supabase
          .from('projects')
          .update(projectUpdates)
          .eq('id', id);

        if (error) console.error('Error updating project:', error);
      }

      // Update contract if provided
      if (updates.contract) {
        const { error: contractError } = await supabase
          .from('project_contracts')
          .upsert({
            project_id: id,
            maturity_days: updates.contract.maturity,
            warranty_months: updates.contract.warranty,
            retention_terms: updates.contract.retention,
            site_facilities_percent: updates.contract.siteFacilities,
            insurance_percent: updates.contract.insurance
          });

        if (contractError) console.error('Error updating contract:', contractError);
      }

      // Update investor financials if provided
      if (updates.investorFinancials) {
        const { error: financialsError } = await supabase
          .from('project_investor_financials')
          .upsert({
            project_id: id,
            sod_price: updates.investorFinancials.sodPrice
          });

        if (financialsError) console.error('Error updating financials:', financialsError);

        // Handle amendments (delete and re-insert for simplicity)
        if (updates.investorFinancials.amendments) {
          await supabase
            .from('project_amendments')
            .delete()
            .eq('project_id', id);

          if (updates.investorFinancials.amendments.length > 0) {
            const { error: amendmentsError } = await supabase
              .from('project_amendments')
              .insert(
                updates.investorFinancials.amendments.map(a => ({
                  id: a.id,
                  project_id: id,
                  label: a.label,
                  price: a.price
                }))
              );

            if (amendmentsError) console.error('Error updating amendments:', amendmentsError);
          }
        }
      }
    } catch (error) {
      console.error('Unexpected error updating project details:', error);
    }
  };

  const handleAddCategory = async (projectId: string, newCategory: DemandCategory) => {
  // Optimistic update to local state
  setAllProjectDetails(prev => ({
    ...prev,
    [projectId]: {
      ...prev[projectId],
      categories: [...prev[projectId].categories, newCategory]
    }
  }));

  // Persist to Supabase
  try {
    const { error } = await supabase.from('demand_categories').insert({
      id: newCategory.id,
      project_id: projectId,
      title: newCategory.title,
      budget_display: newCategory.budget,
      sod_budget: newCategory.sodBudget,
      plan_budget: newCategory.planBudget,
      status: newCategory.status,
      description: newCategory.description
    });

    if (error) {
      console.error('Error saving category to Supabase:', error);
      // Optionally revert local state on error
    }
  } catch (err) {
    console.error('Unexpected error saving category:', err);
  }
};

  const handleImportContacts = async (newContacts: Subcontractor[]) => {
    // Use the merge logic from service
    const { mergedContacts, added, updated, addedCount, updatedCount } = mergeContacts(contacts, newContacts);

    // Optimistic update
    setContacts(mergedContacts);

    // Persist to Supabase
    try {
      // 1. Insert new contacts
      if (added.length > 0) {
        const { error: insertError } = await supabase
          .from('subcontractors')
          .insert(added.map(c => ({
            id: c.id,
            company_name: c.company,
            contact_person_name: c.name,
            specialization: c.specialization,
            phone: c.phone,
            email: c.email,
            ico: c.ico,
            region: c.region,
            status_id: c.status
          })));
        
        if (insertError) console.error('Error inserting contacts:', insertError);
      }

      // 2. Update existing contacts (one by one for now, or use upsert if we had clean IDs)
      // Since we matched by name, IDs might match or not. 
      // Actually, mergeContacts preserves IDs for existing contacts.
      if (updated.length > 0) {
        for (const contact of updated) {
          const { error: updateError } = await supabase
            .from('subcontractors')
            .update({
              company_name: contact.company,
              contact_person_name: contact.name,
              specialization: contact.specialization,
              phone: contact.phone,
              email: contact.email,
              ico: contact.ico,
              region: contact.region,
              // status_id: contact.status // Status is preserved in merge, but we can update it if needed. Merge logic says preserve.
            })
            .eq('id', contact.id);
            
          if (updateError) console.error(`Error updating contact ${contact.company}:`, updateError);
        }
      }

      alert(`Synchronizace dokončena:\n- Přidáno nových: ${addedCount}\n- Aktualizováno: ${updatedCount}`);

    } catch (error) {
      console.error('Error persisting contacts:', error);
      alert('Chyba při ukládání kontaktů do databáze.');
    }
  };

  const handleDeleteContacts = async (idsToDelete: string[]) => {
    if (idsToDelete.length === 0) return;

    // Optimistic update
    setContacts(prev => prev.filter(c => !idsToDelete.includes(c.id)));

    try {
      const { error } = await supabase
        .from('subcontractors')
        .delete()
        .in('id', idsToDelete);

      if (error) {
        console.error('Error deleting contacts:', error);
        alert('Chyba při mazání kontaktů z databáze.');
        // Revert optimistic update if needed (complex, maybe just reload)
        loadInitialData();
      }
    } catch (error) {
      console.error('Unexpected error deleting contacts:', error);
    }
  };

  const handleSyncContacts = async (url: string) => {
    setIsDataLoading(true);
    try {
      const result = await syncContactsFromUrl(url);
      if (result.success) {
        await handleImportContacts(result.contacts);
      } else {
        alert(`Chyba synchronizace: ${result.error}`);
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert('Nepodařilo se synchronizovat kontakty.');
    } finally {
      setIsDataLoading(false);
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard projects={projects} projectDetails={allProjectDetails} />;
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
        return (
          <Contacts 
            statuses={contactStatuses} 
            contacts={contacts} 
            onContactsChange={setContacts}
            onDeleteContacts={handleDeleteContacts}
          />
        );
      case 'settings':
        return (
          <Settings 
            darkMode={darkMode} 
            onToggleDarkMode={() => {
              const newMode = !darkMode;
              setDarkMode(newMode);
              if (user) updatePreferences({ darkMode: newMode });
            }}
            primaryColor={primaryColor}
            onSetPrimaryColor={(color) => {
              setPrimaryColor(color);
              if (user) updatePreferences({ primaryColor: color });
            }}
            backgroundColor={backgroundColor}
            onSetBackgroundColor={(color) => {
              setBackgroundColor(color);
              if (user) updatePreferences({ backgroundColor: color });
            }}
            projects={projects}
            onAddProject={handleAddProject}
            onDeleteProject={handleDeleteProject}
            onArchiveProject={handleArchiveProject}
            contactStatuses={contactStatuses}
            onUpdateStatuses={setContactStatuses}
            onImportContacts={handleImportContacts}
            onSyncContacts={handleSyncContacts}
            onDeleteContacts={handleDeleteContacts}
            contacts={contacts}
          />
        );
      default:
        return <Dashboard />;
    }
  };

  if (authLoading || isDataLoading) {
    return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <LandingPage onLogin={login} onRegister={register} />;
  }

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



const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
