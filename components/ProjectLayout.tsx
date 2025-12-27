
import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { Pipeline } from './Pipeline';
import { TenderPlan } from './TenderPlan';
import { ProjectTab, ProjectDetails, ContractDetails, InvestorFinancials, DemandCategory, Bid, Subcontractor, StatusConfig, Template } from '../types';
import { uploadDocument, formatFileSize } from '../services/documentService';
import { TemplateManager } from './TemplateManager';
import { getTemplateById } from '../services/templateService';
import { ProjectOverviewNew } from './ProjectOverviewNew';

// --- Helper Functions ---
const parseMoney = (valueStr: string): number => {
    if (!valueStr || valueStr === '-' || valueStr === '?') return 0;

    // Check for M (millions) or K (thousands) suffix first
    const hasM = /M/i.test(valueStr);
    const hasK = /K/i.test(valueStr) && !/Kč/i.test(valueStr); // K but not Kč

    // Remove all non-numeric characters except comma and dot
    // Czech format uses spaces for thousands and comma for decimals
    const cleanStr = valueStr
        .replace(/\s/g, '')     // Remove all whitespace/spaces
        .replace(/[^0-9,.-]/g, '') // Keep only digits, comma, dot, minus
        .replace(',', '.');     // Replace comma with dot for parseFloat

    let val = parseFloat(cleanStr);

    if (hasM) val *= 1000000;
    else if (hasK) val *= 1000;

    return isNaN(val) ? 0 : val;
};

const formatMoney = (val: number): string => {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M Kč';
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(val);
};

const formatMoneyFull = (val: number): string => {
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(val);
};

// --- Sub-Components ---

interface ProjectDocumentsProps {
    project: ProjectDetails;
    onUpdate: (updates: Partial<ProjectDetails>) => void;
}

const ProjectDocuments: React.FC<ProjectDocumentsProps> = ({ project, onUpdate }) => {
    const [isEditingDocs, setIsEditingDocs] = useState(false);
    const [isEditingLetter, setIsEditingLetter] = useState(false);
    const [docsLinkValue, setDocsLinkValue] = useState('');
    const [letterLinkValue, setLetterLinkValue] = useState('');
    const [selectedTemplateFile, setSelectedTemplateFile] = useState<File | null>(null);
    const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
    const [showTemplateManager, setShowTemplateManager] = useState(false);
    const [templateName, setTemplateName] = useState<string | null>(null);

    useEffect(() => {
        setDocsLinkValue(project.documentationLink || '');
    }, [project.documentationLink, isEditingDocs]);

    useEffect(() => {
        setLetterLinkValue(project.inquiryLetterLink || '');
    }, [project.inquiryLetterLink, isEditingLetter]);

    // Load template name asynchronously
    useEffect(() => {
        if (project.inquiryLetterLink?.startsWith('template:')) {
            const templateId = project.inquiryLetterLink.split(':')[1];
            getTemplateById(templateId).then(template => {
                setTemplateName(template?.name || 'Neznámá šablona');
            });
        } else {
            setTemplateName(null);
        }
    }, [project.inquiryLetterLink]);

    const handleSaveDocs = () => {
        onUpdate({ documentationLink: docsLinkValue });
        setIsEditingDocs(false);
    };

    const handleSaveLetter = async () => {
        if (selectedTemplateFile) {
            // Upload file to storage
            setIsUploadingTemplate(true);
            try {
                const doc = await uploadDocument(selectedTemplateFile, `template_${project.id || 'default'}`);
                onUpdate({ inquiryLetterLink: doc.url });
                setSelectedTemplateFile(null);
            } catch (error) {
                console.error('Error uploading template:', error);
                alert('Chyba při nahrávání šablony. Zkuste to prosím znovu.');
                setIsUploadingTemplate(false);
                return;
            }
            setIsUploadingTemplate(false);
        } else {
            // Save URL
            onUpdate({ inquiryLetterLink: letterLinkValue });
        }
        setIsEditingLetter(false);
    };

    const hasDocsLink = project.documentationLink && project.documentationLink.trim() !== '';
    const hasLetterLink = project.inquiryLetterLink && project.inquiryLetterLink.trim() !== '';

    return (
        <div className="p-6 lg:p-10 flex flex-col gap-6 overflow-y-auto h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-screen">
            <div className="max-w-4xl mx-auto w-full">
                {/* Header Card */}
                <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="size-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-emerald-400 text-2xl">folder_open</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Projektová dokumentace</h2>
                            <p className="text-sm text-slate-400">Odkaz na sdílenou dokumentaci stavby</p>
                        </div>
                    </div>

                    <div className={`rounded-xl p-6 border transition-colors ${hasDocsLink ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/30 border-slate-700/50'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-400">link</span>
                                <h3 className="font-semibold text-white">Odkaz na dokumentaci</h3>
                                {hasDocsLink && (
                                    <span className="ml-2 px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase rounded-lg border border-emerald-500/30">
                                        Nastaveno
                                    </span>
                                )}
                            </div>
                            {!isEditingDocs ? (
                                <button
                                    onClick={() => setIsEditingDocs(true)}
                                    className="p-2 hover:bg-slate-700/50 rounded-lg transition-all"
                                >
                                    <span className="material-symbols-outlined text-slate-400 text-[20px]">edit</span>
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSaveDocs}
                                        className="text-green-500 hover:text-green-600"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">check</span>
                                    </button>
                                    <button
                                        onClick={() => setIsEditingDocs(false)}
                                        className="text-red-500 hover:text-red-600"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">close</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {!isEditingDocs ? (
                            <div>
                                {hasDocsLink ? (
                                    <div className="space-y-3">
                                        <a
                                            href={project.documentationLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-emerald-500/30 hover:bg-slate-700/50 transition-all group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <span className="material-symbols-outlined text-emerald-400">description</span>
                                                    <span className="text-sm font-medium text-white truncate">
                                                        {project.documentationLink}
                                                    </span>
                                                </div>
                                                <span className="material-symbols-outlined text-slate-500 group-hover:text-emerald-400 transition-colors">open_in_new</span>
                                            </div>
                                        </a>
                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">info</span>
                                            Klikněte pro otevření v novém okně
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <span className="material-symbols-outlined text-slate-600 text-5xl mb-3 block">link_off</span>
                                        <p className="text-slate-400 text-sm">Žádný odkaz není nastaven</p>
                                        <p className="text-slate-500 text-xs mt-1">Klikněte na ikonu úprav pro přidání odkazu</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <input
                                    type="url"
                                    value={docsLinkValue}
                                    onChange={(e) => setDocsLinkValue(e.target.value)}
                                    placeholder="https://example.com/project-docs"
                                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                                />
                                <p className="text-xs text-slate-500">
                                    Zadejte URL odkaz na sdílenou složku (např. Google Drive, Dropbox, SharePoint)
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Inquiry Letter Section */}
                    {/* Inquiry Letter Section */}
                    <div className={`rounded-xl p-6 border mt-6 transition-colors ${hasLetterLink ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/30 border-slate-700/50'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-400">mail</span>
                                <h3 className="font-semibold text-white">Poptávkový dopis (šablona)</h3>
                                {hasLetterLink && (
                                    <span className="ml-2 px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase rounded-lg border border-emerald-500/30">
                                        Nastaveno
                                    </span>
                                )}
                            </div>

                            <button
                                onClick={() => setShowTemplateManager(true)}
                                className="px-3 py-1.5 text-sm font-medium text-emerald-400 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:bg-slate-700/50 hover:border-emerald-500/30 transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[18px]">{hasLetterLink ? 'change_circle' : 'add_circle'}</span>
                                {hasLetterLink ? 'Změnit šablonu' : 'Vybrat šablonu'}
                            </button>
                        </div>

                        <div>
                            {hasLetterLink ? (
                                <div className="space-y-3">
                                    <div
                                        className="block p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 transition-all group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <span className="material-symbols-outlined text-emerald-400">
                                                    {project.inquiryLetterLink?.startsWith('template:') ? 'wysiwyg' : 'link'}
                                                </span>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-white truncate">
                                                        {project.inquiryLetterLink?.startsWith('template:')
                                                            ? (templateName || 'Načítání...')
                                                            : (project.inquiryLetterLink?.startsWith('http') ? 'Externí odkaz / Soubor' : project.inquiryLetterLink)
                                                        }
                                                    </span>
                                                    {project.inquiryLetterLink?.startsWith('template:') && (
                                                        <span className="text-xs text-slate-500">HTML Šablona připravená k odeslání</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setShowTemplateManager(true)}
                                                    className="p-2 text-slate-500 hover:text-emerald-400 transition-colors"
                                                    title="Upravit / Zobrazit"
                                                >
                                                    <span className="material-symbols-outlined">visibility</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    {project.inquiryLetterLink?.startsWith('template:') ? (
                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">info</span>
                                            Tato šablona bude použita pro generování emailů subdodavatelům.
                                        </p>
                                    ) : (
                                        <p className="text-xs text-amber-400 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">warning</span>
                                            Používáte starý formát odkazu. Doporučujeme přejít na systémovou šablonu.
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8 border-2 border-dashed border-slate-700/50 rounded-xl">
                                    <span className="material-symbols-outlined text-slate-600 text-5xl mb-3 block">mail_outline</span>
                                    <p className="text-slate-400 text-sm font-medium">Žádná šablona není vybrána</p>
                                    <p className="text-slate-500 text-xs mt-1 mb-4">Vyberte šablonu pro komunikaci se subdodavateli</p>
                                    <button
                                        onClick={() => setShowTemplateManager(true)}
                                        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl transition-all inline-flex items-center gap-2 text-sm font-medium shadow-lg"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">add_circle</span>
                                        Vytvořit nebo vybrat šablonu
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>


                    {/* Tips Section */}
                    <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-blue-400 text-[20px]">lightbulb</span>
                            <div>
                                <h4 className="font-semibold text-blue-300 text-sm mb-1">Tipy pro dokumentaci</h4>
                                <ul className="text-xs text-blue-400/80 space-y-1">
                                    <li>• Použijte sdílené cloudové úložiště pro snadný přístup celého týmu</li>
                                    <li>• Ujistěte se, že všichni relevantní členové mají přístupová práva</li>
                                    <li>• Udržujte dokumentaci aktuální a dobře organizovanou</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            {/* Template Manager Overlay */}
            {showTemplateManager && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-6xl h-[85vh] shadow-2xl">
                        <TemplateManager
                            project={project}
                            onClose={() => setShowTemplateManager(false)}
                            onSelectTemplate={(template) => {
                                onUpdate({ inquiryLetterLink: `template:${template.id}` });
                                setShowTemplateManager(false);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

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
        <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark">
            <Header 
                title={project.title} 
                subtitle="Detail stavby"
                onSearchChange={setSearchQuery}
                searchPlaceholder="Hledat v projektu..."
            >
                <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
                    <button
                        onClick={() => onTabChange('overview')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
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
                {activeTab === 'documents' && <ProjectDocuments project={project} onUpdate={onUpdateDetails} />}
            </div>
        </div>
    );
};
