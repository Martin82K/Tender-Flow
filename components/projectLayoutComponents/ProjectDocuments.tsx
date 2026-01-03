/**
 * ProjectDocuments Component
 * Manages document links, templates, DocHub integration for projects.
 * Extracted from ProjectLayout.tsx for better modularity.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ProjectDetails } from '../../types';
import { uploadDocument, formatFileSize } from '../../services/documentService';
import { TemplateManager } from '../TemplateManager';
import { getTemplateById } from '../../services/templateService';
import { useDocHubIntegration } from '../../hooks/useDocHubIntegration';
import { DocHubStatusCard } from './documents/dochub/DocHubStatusCard';
import { DocHubSetupWizard } from './documents/dochub/DocHubSetupWizard';
import { DocHubStructureEditor } from './documents/dochub/DocHubStructureEditor';
import { DocHubAutoCreateStatus } from './documents/dochub/DocHubAutoCreateStatus';
import { DocHubHistory } from './documents/dochub/DocHubHistory';
import { DocHubLinks } from './documents/dochub/DocHubLinks';
import { ConfirmationModal } from '../ConfirmationModal';
import { DocsLinkSection } from './documents/DocsLinkSection';
import { TemplatesSection } from './documents/TemplatesSection';
import { PriceListsSection } from './documents/PriceListsSection';

// --- Helper Functions ---
const parseMoney = (valueStr: string): number => {
    if (!valueStr || valueStr === '-' || valueStr === '?') return 0;
    const hasM = /M/i.test(valueStr);
    const hasK = /K/i.test(valueStr) && !/Kč/i.test(valueStr);
    const cleanStr = valueStr
        .replace(/\s/g, '')
        .replace(/[^0-9,.-]/g, '')
        .replace(',', '.');
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

export interface ProjectDocumentsProps {
    project: ProjectDetails;
    onUpdate: (updates: Partial<ProjectDetails>) => void;
}

const ProjectDocuments: React.FC<ProjectDocumentsProps> = ({ project, onUpdate }) => {
    type DocumentsSubTab = 'pd' | 'templates' | 'dochub' | 'ceniky';
    const [isEditingDocs, setIsEditingDocs] = useState(false);
    const [isEditingLetter, setIsEditingLetter] = useState(false);
    const [documentsSubTab, setDocumentsSubTab] = useState<DocumentsSubTab>('pd');
    const [docsLinkValue, setDocsLinkValue] = useState('');
    const [priceListLinkValue, setPriceListLinkValue] = useState('');
    const [letterLinkValue, setLetterLinkValue] = useState('');
    // DocHub Integration Hook
    const docHub = useDocHubIntegration(project, onUpdate);
    const { isConnected: isDocHubConnected, links: docHubProjectLinks, structureDraft: docHubStructure } = docHub.state;

    // UI state for logs (lifted up)
    const [showDocHubRunLog, setShowDocHubRunLog] = useState(false);
    const [showDocHubRunOverview, setShowDocHubRunOverview] = useState(false);
    const docHubRunLogRef = useRef<HTMLDivElement>(null);
    const docHubRunOverviewRef = useRef<HTMLDivElement>(null);

    const handleHistorySelect = (run: any, mode: 'log' | 'overview') => {
        docHub.setters.setAutoCreateResult({
            createdCount: null,
            runId: run.id,
            logs: run.logs,
            finishedAt: run.finished_at || run.started_at
        });
        if (mode === 'log') {
            setShowDocHubRunLog(true);
            setShowDocHubRunOverview(false);
            window.setTimeout(() => docHubRunLogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        } else {
            setShowDocHubRunOverview(true);
            setShowDocHubRunLog(false);
            window.setTimeout(() => docHubRunOverviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        }
    };
    const [selectedTemplateFile, setSelectedTemplateFile] = useState<File | null>(null);
    const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
    const [showTemplateManager, setShowTemplateManager] = useState(false);
    const [templateName, setTemplateName] = useState<string | null>(null);
    const [losersTemplateName, setLosersTemplateName] = useState<string | null>(null);
    const [templateManagerTarget, setTemplateManagerTarget] = useState<
        | { kind: 'inquiry' }
        | { kind: 'losers' }
        | null
    >(null);
    const [templateManagerInitialId, setTemplateManagerInitialId] = useState<string | null>(null);

    const extractTemplateId = (link: string | null | undefined) => {
        if (!link) return null;
        if (!link.startsWith('template:')) return null;
        return link.split(':')[1] || null;
    };

    const openTemplateManager = (opts: {
        target: { kind: 'inquiry' } | { kind: 'losers' } | null;
        initialLink?: string | null;
    }) => {
        setTemplateManagerTarget(opts.target);
        setTemplateManagerInitialId(extractTemplateId(opts.initialLink));
        setShowTemplateManager(true);
    };

    useEffect(() => {
        setDocsLinkValue(project.documentationLink || '');
    }, [project.documentationLink, isEditingDocs]);

    const [isEditingPriceList, setIsEditingPriceList] = useState(false);
    useEffect(() => {
        setPriceListLinkValue(project.priceListLink || '');
    }, [project.priceListLink, isEditingPriceList]);

    useEffect(() => {
        setLetterLinkValue(project.inquiryLetterLink || '');
    }, [project.inquiryLetterLink, isEditingLetter]);

    // Sync effect removed

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

    useEffect(() => {
        if (project.losersEmailTemplateLink?.startsWith('template:')) {
            const templateId = project.losersEmailTemplateLink.split(':')[1];
            getTemplateById(templateId).then(template => {
                setLosersTemplateName(template?.name || 'Neznámá šablona');
            });
        } else {
            setLosersTemplateName(null);
        }
    }, [project.losersEmailTemplateLink]);

    const handleSaveDocs = () => {
        onUpdate({ documentationLink: docsLinkValue });
        setIsEditingDocs(false);
    };

    const handleSavePriceList = () => {
        onUpdate({ priceListLink: priceListLinkValue });
        setIsEditingPriceList(false);
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
                showModal({ title: "Chyba", message: "Chyba při nahrávání šablony. Zkuste to prosím znovu.", variant: "danger" });
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

    const [uiModal, setUiModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        variant: 'danger' | 'info' | 'success';
    }>({ isOpen: false, title: '', message: '', variant: 'info' });

    const showModal = (args: { title: string; message: string; variant?: 'danger' | 'info' | 'success' }) => {
        setUiModal({
            isOpen: true,
            title: args.title,
            message: args.message,
            variant: args.variant ?? 'info',
        });
    };

    const hasDocsLink = project.documentationLink && project.documentationLink.trim() !== '';

    return (
        <div className="p-6 lg:p-10 flex flex-col gap-6 overflow-y-auto h-full bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen">
            <ConfirmationModal
                isOpen={uiModal.isOpen}
                title={uiModal.title}
                message={uiModal.message}
                variant={uiModal.variant}
                confirmLabel="OK"
                onConfirm={() => setUiModal((prev) => ({ ...prev, isOpen: false }))}
            />

            <div className="max-w-4xl mx-auto w-full">
                {/* Header Card */}
                <div className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl shadow-xl p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="size-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-emerald-400 text-2xl">folder_open</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Dokumenty</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">PD, šablony a DocHub složky projektu</p>
                        </div>
                    </div>

                    {/* Sub-navigation */}
                    <div className="flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-900/30 p-1 rounded-xl border border-slate-200 dark:border-slate-700/50 mb-6">
                        <button
                            type="button"
                            onClick={() => setDocumentsSubTab('pd')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${documentsSubTab === 'pd'
                                ? 'bg-primary text-white shadow-lg'
                                : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/50'
                                }`}
                        >
                            PD
                        </button>
                        <button
                            type="button"
                            onClick={() => setDocumentsSubTab('templates')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${documentsSubTab === 'templates'
                                ? 'bg-primary text-white shadow-lg'
                                : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/50'
                                }`}
                        >
                            Šablony
                        </button>
                        <button
                            type="button"
                            onClick={() => setDocumentsSubTab('dochub')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${documentsSubTab === 'dochub'
                                ? 'bg-primary text-white shadow-lg'
                                : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/50'
                                }`}
                        >
                            DocHub
                        </button>
                        <button
                            type="button"
                            onClick={() => setDocumentsSubTab('ceniky')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${documentsSubTab === 'ceniky'
                                ? 'bg-primary text-white shadow-lg'
                                : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/50'
                                }`}
                        >
                            Ceníky
                        </button>
                    </div>

                    {documentsSubTab === 'pd' && (
                        <DocsLinkSection
                            project={project}
                            hasDocsLink={hasDocsLink}
                            isEditing={isEditingDocs}
                            onEditToggle={setIsEditingDocs}
                            linkValue={docsLinkValue}
                            onLinkValueChange={(val) => setDocsLinkValue(val)}
                            onSave={handleSaveDocs}
                            isDocHubConnected={isDocHubConnected}
                            docHubPdLink={docHubProjectLinks?.pd || null}
                            docHubStructure={docHubStructure}
                            showModal={showModal}
                        />
                    )}

                    {documentsSubTab === 'templates' && (
                        <TemplatesSection
                            project={project}
                            templateName={templateName}
                            losersTemplateName={losersTemplateName}
                            openTemplateManager={openTemplateManager}
                        />
                    )}

                    {/* DocHub Section (Wizard) */}
                    {documentsSubTab === 'dochub' && (
                        <div className="space-y-6">
                            <DocHubStatusCard
                                state={docHub.state}
                                actions={docHub.actions}
                                setters={docHub.setters}
                                showModal={showModal}
                            />

                            <DocHubSetupWizard
                                state={docHub.state}
                                actions={docHub.actions}
                                setters={docHub.setters}
                                showModal={showModal}
                            />

                            {docHub.state.isConnected && !docHub.state.isEditingSetup && (
                                <>
                                    <DocHubStructureEditor
                                        state={docHub.state}
                                        actions={docHub.actions}
                                        setters={docHub.setters}
                                        showModal={showModal}
                                    />

                                    <DocHubLinks
                                        state={docHub.state}
                                        showModal={showModal}
                                    />

                                    <DocHubAutoCreateStatus
                                        state={docHub.state}
                                        setters={docHub.setters}
                                        showModal={showModal}
                                        showLog={showDocHubRunLog}
                                        setShowLog={setShowDocHubRunLog}
                                        showOverview={showDocHubRunOverview}
                                        setShowOverview={setShowDocHubRunOverview}
                                        logRef={docHubRunLogRef}
                                        overviewRef={docHubRunOverviewRef}
                                    />

                                    <DocHubHistory
                                        project={project}
                                        onSelectRun={handleHistorySelect}
                                    />
                                </>
                            )}
                        </div>
                    )}

                    {/* Price Lists Section */}
                    {documentsSubTab === 'ceniky' && (
                        <PriceListsSection
                            project={project}
                            isEditing={isEditingPriceList}
                            onEditToggle={setIsEditingPriceList}
                            linkValue={priceListLinkValue}
                            onLinkValueChange={(val) => setPriceListLinkValue(val)}
                            onSave={handleSavePriceList}
                            isDocHubConnected={isDocHubConnected}
                            docHubCenikyLink={docHubProjectLinks?.ceniky || null}
                            showModal={showModal}
                        />
                    )}

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
                            initialTemplateId={templateManagerInitialId}
                            onClose={() => {
                                setShowTemplateManager(false);
                                setTemplateManagerTarget(null);
                                setTemplateManagerInitialId(null);
                            }}
                            onSelectTemplate={
                                templateManagerTarget
                                    ? (template) => {
                                        if (templateManagerTarget.kind === 'inquiry') {
                                            onUpdate({ inquiryLetterLink: `template:${template.id}` });
                                        } else if (templateManagerTarget.kind === 'losers') {
                                            onUpdate({ losersEmailTemplateLink: `template:${template.id}` });
                                        }
                                        setShowTemplateManager(false);
                                        setTemplateManagerTarget(null);
                                        setTemplateManagerInitialId(null);
                                    }
                                    : undefined
                            }
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export { ProjectDocuments };
