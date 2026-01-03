
import React, { useState } from 'react';
import { Header } from './Header';
import { Pipeline } from './Pipeline';
import { TenderPlan } from './TenderPlan';
import { ProjectSchedule } from './ProjectSchedule';
import { ProjectTab, ProjectDetails, DemandCategory, Bid, Subcontractor, StatusConfig } from '../types';
import { ProjectOverviewNew } from './ProjectOverviewNew';
import { ProjectDocuments } from './projectLayoutComponents';
// --- Main Layout Component ---

interface ProjectLayoutProps {
    projectId: string;
    projectDetails?: ProjectDetails;
    onUpdateDetails: (updates: Partial<ProjectDetails>) => void;
    onAddCategory: (category: DemandCategory) => void;
    onEditCategory?: (category: DemandCategory) => void;
    onDeleteCategory?: (categoryId: string) => void;
    onBidsChange?: (projectId: string, bids: Record<string, Bid[]>) => void;
    activeTab: ProjectTab;
    onTabChange: (tab: ProjectTab) => void;
    contacts: Subcontractor[];
    statuses?: StatusConfig[];
    initialPipelineCategoryId?: string;
    onNavigateToPipeline?: (categoryId: string) => void;
}

export const ProjectLayout: React.FC<ProjectLayoutProps> = ({ projectId, projectDetails, onUpdateDetails, onAddCategory, onEditCategory, onDeleteCategory, onBidsChange, activeTab, onTabChange, contacts, statuses, initialPipelineCategoryId, onNavigateToPipeline }) => {
    const project = projectDetails;
    const [searchQuery, setSearchQuery] = useState('');

    const handleLocalNavigateToPipeline = (categoryId: string) => {
        onTabChange('pipeline');
        onNavigateToPipeline?.(categoryId);
    };

    if (!project) return <div>Project not found</div>;

    return (
        <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950">
            <Header
                title={project.title}
                subtitle="Detail stavby"
                onSearchChange={setSearchQuery}
                searchPlaceholder="Hledat v projektu..."
            >
                <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-300 dark:border-slate-700/50">
                    <button
                        onClick={() => onTabChange('overview')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-primary text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-700/50'}`}
                    >
                        Přehled
                    </button>
                    <button
                        onClick={() => onTabChange('tender-plan')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'tender-plan' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                    >
                        Plán VŘ
                    </button>
                    <button
                        onClick={() => onTabChange('pipeline')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'pipeline' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                    >
                        Výběrová řízení
                    </button>
                    <button
                        onClick={() => onTabChange('schedule')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'schedule' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                    >
                        Harmonogram
                    </button>
                    <button
                        onClick={() => onTabChange('documents')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'documents' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                    >
                        Dokumenty
                    </button>
                </div>
            </Header>

            <div className="flex-1 overflow-auto flex flex-col">
                {activeTab === 'overview' && <ProjectOverviewNew project={project} onUpdate={onUpdateDetails} variant="compact" searchQuery={searchQuery} onNavigateToPipeline={handleLocalNavigateToPipeline} />}
                {activeTab === 'tender-plan' && (
                    <TenderPlan
                        projectId={projectId}
                        categories={project.categories || []}
                        onCreateCategory={(name, dateFrom, dateTo) => {
                            // Switch to pipeline tab and open add category modal
                            onTabChange('pipeline');
                            // The Pipeline component will need to handle this - for now just switch tabs
                            // A more complete solution would pass the pre-filled data
                            const newCategory: DemandCategory = {
                                id: `cat_${Date.now()}`,
                                title: name,
                                budget: '0 Kč',
                                sodBudget: 0,
                                planBudget: 0,
                                status: 'open',
                                subcontractorCount: 0,
                                description: '',
                                deadline: dateTo || '',
                            };
                            onAddCategory(newCategory);
                        }}
                    />
                )}
                {activeTab === 'pipeline' && <Pipeline projectId={projectId} projectDetails={project} bids={project.bids || {}} contacts={contacts} statuses={statuses} onAddCategory={onAddCategory} onEditCategory={onEditCategory} onDeleteCategory={onDeleteCategory} onBidsChange={(bids) => onBidsChange?.(projectId, bids)} searchQuery={searchQuery} initialOpenCategoryId={initialPipelineCategoryId} />}
                {activeTab === 'schedule' && (
                    <div className="flex-1 min-h-0">
                        <ProjectSchedule projectId={projectId} projectTitle={project.title} categories={project.categories || []} />
                    </div>
                )}
                {activeTab === 'documents' && <ProjectDocuments project={project} onUpdate={onUpdateDetails} />}
            </div>
        </div>
    );
};
