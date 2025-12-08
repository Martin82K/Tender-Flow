
import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { Pipeline } from './Pipeline';
import { ProjectTab, ProjectDetails, ContractDetails, InvestorFinancials, DemandCategory, Bid, Subcontractor, StatusConfig, Template } from '../types';
import { uploadDocument, formatFileSize } from '../services/documentService';
import { TemplateManager } from './TemplateManager';
import { getTemplateById } from '../services/templateService';

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

                    {/* Dynamic Placeholders Tips */}
                    <div className="mt-6 p-4 bg-violet-500/10 border border-violet-500/30 rounded-xl">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-violet-400 text-[20px]">code</span>
                            <div className="flex-1">
                                <h4 className="font-semibold text-violet-300 text-sm mb-2">Dynamické proměnné pro šablonu</h4>
                                <p className="text-xs text-violet-400/80 mb-3">V šabloně poptávkového dopisu můžete použít tyto proměnné:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                    <div className="bg-slate-800/50 p-2 rounded-lg">
                                        <code className="text-violet-300 font-mono">{'{NAZEV_STAVBY}'}</code>
                                        <span className="text-slate-400 ml-2">- Název projektu</span>
                                    </div>
                                    <div className="bg-slate-800/50 p-2 rounded-lg">
                                        <code className="text-violet-300 font-mono">{'{INVESTOR}'}</code>
                                        <span className="text-slate-400 ml-2">- Investor</span>
                                    </div>
                                    <div className="bg-slate-800/50 p-2 rounded-lg">
                                        <code className="text-violet-300 font-mono">{'{LOKACE}'}</code>
                                        <span className="text-slate-400 ml-2">- Lokace stavby</span>
                                    </div>
                                    <div className="bg-slate-800/50 p-2 rounded-lg">
                                        <code className="text-violet-300 font-mono">{'{TERMIN_DOKONCENI}'}</code>
                                        <span className="text-slate-400 ml-2">- Termín dokončení</span>
                                    </div>
                                    <div className="bg-slate-800/50 p-2 rounded-lg">
                                        <code className="text-violet-300 font-mono">{'{STAVBYVEDOUCI}'}</code>
                                        <span className="text-slate-400 ml-2">- Stavbyvedoucí</span>
                                    </div>
                                    <div className="bg-slate-800/50 p-2 rounded-lg">
                                        <code className="text-violet-300 font-mono">{'{SOD_CENA}'}</code>
                                        <span className="text-slate-400 ml-2">- Cena SOD smlouvy</span>
                                    </div>
                                    <div className="bg-slate-800/50 p-2 rounded-lg">
                                        <code className="text-violet-300 font-mono">{'{SPLATNOST}'}</code>
                                        <span className="text-slate-400 ml-2">- Splatnost faktury</span>
                                    </div>
                                    <div className="bg-slate-800/50 p-2 rounded-lg">
                                        <code className="text-violet-300 font-mono">{'{ZARUKA}'}</code>
                                        <span className="text-slate-400 ml-2">- Záruční doba</span>
                                    </div>
                                    <div className="bg-slate-800/50 p-2 rounded-lg">
                                        <code className="text-violet-300 font-mono">{'{POZASTAVKA}'}</code>
                                        <span className="text-slate-400 ml-2">- Pozastávka</span>
                                    </div>
                                    <div className="bg-slate-800/50 p-2 rounded-lg">
                                        <code className="text-violet-300 font-mono">{'{TECHNICKY_DOZOR}'}</code>
                                        <span className="text-slate-400 ml-2">- TDI</span>
                                    </div>

                                    <div className="bg-slate-800/50 p-2 rounded-lg">
                                        <code className="text-violet-300 font-mono">{'{ODKAZ_DOKUMENTACE}'}</code>
                                        <span className="text-slate-400 ml-2">- Odkaz na dokumentaci</span>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-3 italic">
                                    💡 Použijte mail merge funkci ve Wordu nebo skript v Google Docs pro automatické nahrazení proměnných skutečnými hodnotami.
                                </p>
                            </div>
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

interface FinancialAnalysisTableProps {
    categories: DemandCategory[];
    bids?: Record<string, Bid[]>;
}

const FinancialAnalysisTable: React.FC<FinancialAnalysisTableProps> = ({ categories, bids = {} }) => {
    // Pre-calculate totals
    let totalSod = 0;
    let totalPlan = 0;
    let totalSub = 0;
    let totalDiffSod = 0;
    let totalDiffPlan = 0;

    const rows = categories.map(cat => {
        const catBids = bids[cat.id] || [];
        // Get ALL winning bids (status === 'sod'), not just the first one
        const winningBids = catBids.filter(b => b.status === 'sod');
        // Sum all winning prices
        const subPrice = winningBids.reduce((sum, bid) => sum + parseMoney(bid.price || '0'), 0);
        const hasWinner = winningBids.length > 0;

        const diffSod = cat.sodBudget - subPrice;
        const diffPlan = cat.planBudget - subPrice;

        // Add to totals
        totalSod += cat.sodBudget;
        totalPlan += cat.planBudget;
        if (hasWinner) {
            totalSub += subPrice;
            totalDiffSod += diffSod;
            totalDiffPlan += diffPlan;
        }

        return {
            ...cat,
            winningBidder: winningBids.length > 0
                ? winningBids.map(b => b.companyName).join(', ')
                : '-',
            winnerCount: winningBids.length,
            subPrice,
            diffSod,
            diffPlan,
            hasWinner
        };
    });

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mt-6 mb-10">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">table_chart</span>
                    Detailní finanční přehled
                </h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-600 dark:text-slate-400">
                    <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-100 dark:bg-slate-800 border-b dark:border-slate-700">
                        <tr>
                            <th className="px-6 py-3 font-bold">Poptávka / Sekce</th>
                            <th className="px-6 py-3 font-bold">Subdodavatel</th>
                            <th className="px-6 py-3 font-bold text-right bg-blue-50/50 dark:bg-blue-900/10">Cena SOD</th>
                            <th className="px-6 py-3 font-bold text-right bg-blue-50/30 dark:bg-blue-900/5">Cena Plán</th>
                            <th className="px-6 py-3 font-bold text-right bg-purple-50/30 dark:bg-purple-900/5">Cena SUB</th>
                            <th className="px-6 py-3 font-bold text-right">Bilance (SOD)</th>
                            <th className="px-6 py-3 font-bold text-right">Bilance (Plán)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {rows.map((row) => (
                            <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-3 font-medium text-slate-900 dark:text-white whitespace-nowrap border-r border-slate-100 dark:border-slate-800">
                                    {row.title}
                                </td>
                                <td className="px-6 py-3 border-r border-slate-100 dark:border-slate-800">
                                    {row.winningBidder}
                                </td>
                                <td className="px-6 py-3 text-right font-mono bg-blue-50/50 dark:bg-blue-900/10">
                                    {formatMoneyFull(row.sodBudget)}
                                </td>
                                <td className="px-6 py-3 text-right font-mono text-slate-500 dark:text-slate-400 bg-blue-50/30 dark:bg-blue-900/5">
                                    {formatMoneyFull(row.planBudget)}
                                </td>
                                <td className="px-6 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200 bg-purple-50/30 dark:bg-purple-900/5 border-r border-slate-100 dark:border-slate-800">
                                    {row.hasWinner ? formatMoneyFull(row.subPrice) : '-'}
                                </td>
                                <td className={`px-6 py-3 text-right font-mono font-bold ${!row.hasWinner ? 'text-slate-300' : row.diffSod >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {row.hasWinner ? formatMoneyFull(row.diffSod) : '-'}
                                </td>
                                <td className={`px-6 py-3 text-right font-mono font-bold ${!row.hasWinner ? 'text-slate-300' : row.diffPlan >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {row.hasWinner ? formatMoneyFull(row.diffPlan) : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                        <tr>
                            <td className="px-6 py-4 text-right border-r border-slate-200 dark:border-slate-700" colSpan={2}>CELKEM</td>
                            <td className="px-6 py-4 text-right bg-blue-100/50 dark:bg-blue-900/20">{formatMoneyFull(totalSod)}</td>
                            <td className="px-6 py-4 text-right bg-blue-50/50 dark:bg-blue-900/10">{formatMoneyFull(totalPlan)}</td>
                            <td className="px-6 py-4 text-right bg-purple-50/50 dark:bg-purple-900/10 border-r border-slate-200 dark:border-slate-700">{formatMoneyFull(totalSub)}</td>
                            <td className={`px-6 py-4 text-right ${totalDiffSod >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {formatMoneyFull(totalDiffSod)}
                            </td>
                            <td className={`px-6 py-4 text-right ${totalDiffPlan >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {formatMoneyFull(totalDiffPlan)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

interface ProjectOverviewProps {
    project: ProjectDetails;
    onUpdate: (updates: Partial<ProjectDetails>) => void;
}

const ProjectOverview: React.FC<ProjectOverviewProps> = ({ project, onUpdate }) => {
    const contract = project.contract;
    const investor = project.investorFinancials || { sodPrice: 0, amendments: [] };
    const plannedCost = project.plannedCost || 0;

    // Edit States
    const [editingInfo, setEditingInfo] = useState(false);
    const [editingContract, setEditingContract] = useState(false);
    const [editingInvestor, setEditingInvestor] = useState(false);
    const [editingInternal, setEditingInternal] = useState(false);

    // Form States
    const [infoForm, setInfoForm] = useState({
        investor: '',
        technicalSupervisor: '',
        location: '',
        finishDate: '',
        siteManager: '',
        constructionManager: '',
        constructionTechnician: ''
    });

    const [contractForm, setContractForm] = useState<ContractDetails>({
        maturity: 30,
        warranty: 0,
        retention: '',
        siteFacilities: 0,
        insurance: 0
    });

    const [investorForm, setInvestorForm] = useState<InvestorFinancials>({
        sodPrice: 0,
        amendments: []
    });

    const [internalForm, setInternalForm] = useState({
        plannedCost: 0
    });

    // Initialize forms when project changes or edit starts
    useEffect(() => {
        setInfoForm({
            investor: project.investor || '',
            technicalSupervisor: project.technicalSupervisor || '',
            location: project.location || '',
            finishDate: project.finishDate || '',
            siteManager: project.siteManager || '',
            constructionManager: project.constructionManager || '',
            constructionTechnician: project.constructionTechnician || ''
        });
        if (project.contract) {
            setContractForm(project.contract);
        }
        if (project.investorFinancials) {
            setInvestorForm(project.investorFinancials);
        } else {
            setInvestorForm({ sodPrice: 0, amendments: [] });
        }
        setInternalForm({
            plannedCost: project.plannedCost || 0
        });
    }, [project, editingInfo, editingContract, editingInvestor, editingInternal]);

    const handleSaveInfo = () => {
        onUpdate({
            investor: infoForm.investor,
            technicalSupervisor: infoForm.technicalSupervisor,
            location: infoForm.location,
            finishDate: infoForm.finishDate,
            siteManager: infoForm.siteManager,
            constructionManager: infoForm.constructionManager,
            constructionTechnician: infoForm.constructionTechnician
        });
        setEditingInfo(false);
    };

    const handleSaveContract = () => {
        onUpdate({
            contract: contractForm
        });
        setEditingContract(false);
    };

    const handleSaveInvestor = () => {
        onUpdate({
            investorFinancials: investorForm
        });
        setEditingInvestor(false);
    };

    const handleSaveInternal = () => {
        onUpdate({
            plannedCost: internalForm.plannedCost
        });
        setEditingInternal(false);
    };

    // Calculate stats

    // 1. Calculate Total Revenue (Budget) from Investor Contract
    const investorSod = investor.sodPrice || 0;
    const investorAmendmentsTotal = investor.amendments.reduce((sum, a) => sum + (a.price || 0), 0);
    const totalBudget = investorSod + investorAmendmentsTotal;

    // 2. Calculate Total Cost (Contracted Subcontractors)
    let totalContractedCost = 0;
    let completedTasks = 0;

    project.categories.forEach(cat => {
        const catBids = project.bids?.[cat.id] || [];
        const winningBid = catBids.find(b => b.status === 'sod');
        if (winningBid) {
            totalContractedCost += parseMoney(winningBid.price || '0');
            completedTasks++;
        }
    });

    const balance = totalBudget - totalContractedCost;
    const plannedBalance = plannedCost > 0 ? plannedCost - totalContractedCost : 0;
    const progress = project.categories.length > 0 ? (completedTasks / project.categories.length) * 100 : 0;

    // Handlers for Investor Form
    const addAmendment = () => {
        setInvestorForm(prev => ({
            ...prev,
            amendments: [...prev.amendments, { id: `a${Date.now()}`, label: `Dodatek č.${prev.amendments.length + 1}`, price: 0 }]
        }));
    };

    const updateAmendment = (index: number, field: 'label' | 'price', value: string | number) => {
        const newAmendments = [...investorForm.amendments];
        newAmendments[index] = { ...newAmendments[index], [field]: value };
        setInvestorForm({ ...investorForm, amendments: newAmendments });
    };

    const removeAmendment = (index: number) => {
        const newAmendments = investorForm.amendments.filter((_, i) => i !== index);
        setInvestorForm({ ...investorForm, amendments: newAmendments });
    };

    return (
        <div className="p-6 lg:p-10 flex flex-col gap-6 overflow-y-auto h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Top Stats - Premium Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {/* Card 1: Revenue */}
                <div className="group relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/50 transition-all overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl border border-blue-500/20 shadow-lg shadow-blue-500/10">
                                <span className="material-symbols-outlined text-blue-400">payments</span>
                            </div>
                            <span className="material-symbols-outlined text-emerald-400 text-[20px]">trending_up</span>
                        </div>
                        <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Rozpočet (Investor)</div>
                        <div className="text-3xl font-bold text-white mb-1">{formatMoneyFull(totalBudget)}</div>
                        <div className="text-xs text-slate-500">Příjem (SOD + Dodatky)</div>
                        <div className="mt-4 h-1 bg-slate-700/50 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full" style={{ width: '100%' }}></div>
                        </div>
                    </div>
                </div>

                {/* Card 2: Planned (Internal) */}
                <div className="group relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/50 transition-all overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
                                <span className="material-symbols-outlined text-indigo-400">bar_chart</span>
                            </div>
                            <span className="material-symbols-outlined text-emerald-400 text-[20px]">trending_up</span>
                        </div>
                        <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Plánovaný náklad</div>
                        <div className="text-3xl font-bold text-white mb-1">
                            {plannedCost > 0 ? formatMoneyFull(plannedCost) : '-'}
                        </div>
                        <div className="text-xs text-slate-500">Interní cíl nákladů</div>
                        <div className="mt-4 h-1 bg-slate-700/50 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full" style={{ width: totalBudget > 0 ? `${(plannedCost / totalBudget) * 100}%` : '0%' }}></div>
                        </div>
                    </div>
                </div>

                {/* Card 3: Contracted (Real) */}
                <div className="group relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/50 transition-all overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-xl border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                                <span className="material-symbols-outlined text-emerald-400">trending_up</span>
                            </div>
                            <span className="material-symbols-outlined text-emerald-400 text-[20px]">trending_up</span>
                        </div>
                        <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Zasmluvněno (Realita)</div>
                        <div className="text-3xl font-bold text-emerald-400 mb-1">{formatMoneyFull(totalContractedCost)}</div>
                        <div className={`text-xs ${plannedBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            Zbývá zadat: {plannedBalance >= 0 ? '+' : ''}{formatMoneyFull(plannedBalance)}
                        </div>
                        <div className="mt-4 h-1 bg-slate-700/50 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${plannedCost > 0 && totalContractedCost > plannedCost ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-emerald-500 to-emerald-400'}`} style={{ width: `${plannedCost > 0 ? Math.min((totalContractedCost / plannedCost) * 100, 100) : 0}%` }}></div>
                        </div>
                    </div>
                </div>

                {/* Card 4: Progress */}
                <div className="group relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/50 transition-all overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-xl border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                                <span className="material-symbols-outlined text-emerald-400">auto_awesome</span>
                            </div>
                        </div>
                        <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Postup Zadávání</div>
                        <div className="text-3xl font-bold text-white mb-1">{completedTasks} / {project.categories.length}</div>
                        <div className="text-xs text-slate-500">Hotové subdodávky</div>
                        <div className="mt-4 h-1 bg-slate-700/50 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Demand Categories Overview Cards */}
            {project.categories.length > 0 && (
                <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/20 rounded-lg">
                                <span className="material-symbols-outlined text-emerald-400">category</span>
                            </div>
                            <h2 className="text-2xl font-bold text-white">Přehled Poptávek ({project.categories.length})</h2>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {project.categories.map(cat => {
                            const catBids = project.bids?.[cat.id] || [];
                            // Get ALL winning bids, not just first one
                            const winningBids = catBids.filter(b => b.status === 'sod');
                            // Sum all winning prices
                            const subPrice = winningBids.reduce((sum, bid) => sum + parseMoney(bid.price || '0'), 0);
                            const diffSod = cat.sodBudget - subPrice;
                            const diffPlan = cat.planBudget - subPrice;
                            const hasWinner = winningBids.length > 0;

                            // Status badge styling - dark theme
                            const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
                                'open': { label: 'OTEVŘENÁ', color: 'bg-blue-500/20 border border-blue-500/30 text-blue-400', icon: 'hourglass_empty' },
                                'negotiating': { label: 'JEDNÁNÍ', color: 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-400', icon: 'handshake' },
                                'closed': { label: 'UZAVŘENÁ', color: 'bg-slate-500/20 border border-slate-500/30 text-slate-400', icon: 'done' },
                                'sod': { label: 'SOD', color: 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400', icon: 'verified' }
                            };
                            const status = statusConfig[cat.status] || statusConfig['open'];

                            return (
                                <div key={cat.id} className="group bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-xl p-6 hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/5 transition-all">
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-4">
                                        <h3 className="font-semibold text-white text-lg">{cat.title}</h3>
                                        <span className={`shrink-0 ml-2 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${status.color}`}>
                                            {status.label}
                                        </span>
                                    </div>

                                    {/* Budget Info */}
                                    <div className="space-y-3 mb-4">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Cena SOD:</span>
                                            <span className="font-semibold text-white">{formatMoneyFull(cat.sodBudget)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Interní plán:</span>
                                            <span className="font-semibold text-white">{formatMoneyFull(cat.planBudget)}</span>
                                        </div>
                                        {hasWinner && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-400">Vysoutěženo:</span>
                                                <span className="font-semibold text-emerald-400">{formatMoneyFull(subPrice)}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Subcontractor or Bid Count */}
                                    <div className="pt-4 border-t border-slate-700/50">
                                        {hasWinner ? (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between text-sm mb-2">
                                                    <span className="text-emerald-400">
                                                        ✓ {winningBids.length === 1
                                                            ? winningBids[0].companyName
                                                            : `${winningBids.length} vítězů`}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-500">Bilance SOD:</span>
                                                    <span className={`font-semibold ${diffSod >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {diffSod >= 0 ? '+' : ''}{formatMoney(diffSod)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-500">Bilance Plán:</span>
                                                    <span className={`font-semibold ${diffPlan >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {diffPlan >= 0 ? '+' : ''}{formatMoney(diffPlan)}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                                <span className="material-symbols-outlined text-[16px]">groups</span>
                                                <span>{catBids.length} {catBids.length === 1 ? 'nabídka' : catBids.length >= 2 && catBids.length <= 4 ? 'nabídky' : 'nabídek'}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Info Cards */}
                <div className="flex flex-col gap-6">
                    {/* Project Info Card */}
                    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white">Informace o stavbě</h3>
                            {!editingInfo ? (
                                <button onClick={() => setEditingInfo(true)} className="p-2 hover:bg-slate-700/50 rounded-lg transition-all">
                                    <span className="material-symbols-outlined text-slate-400 text-[20px]">edit</span>
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button onClick={handleSaveInfo} className="text-green-500 hover:text-green-600">
                                        <span className="material-symbols-outlined text-[20px]">check</span>
                                    </button>
                                    <button onClick={() => setEditingInfo(false)} className="text-red-500 hover:text-red-600">
                                        <span className="material-symbols-outlined text-[20px]">close</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {!editingInfo ? (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                                    <span className="material-symbols-outlined text-blue-400 mt-0.5">corporate_fare</span>
                                    <div className="flex-1">
                                        <div className="text-xs text-slate-400 mb-1">Investor</div>
                                        <div className="font-medium text-white">{project.investor || '—'}</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                                    <span className="material-symbols-outlined text-violet-400 mt-0.5">visibility</span>
                                    <div className="flex-1">
                                        <div className="text-xs text-slate-400 mb-1">Technický dozor</div>
                                        <div className="font-medium text-white">{project.technicalSupervisor || '—'}</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                                    <span className="material-symbols-outlined text-emerald-400 mt-0.5">location_on</span>
                                    <div className="flex-1">
                                        <div className="text-xs text-slate-400 mb-1">Lokace</div>
                                        <div className="font-medium text-white">{project.location || '—'}</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                                    <span className="material-symbols-outlined text-orange-400 mt-0.5">calendar_today</span>
                                    <div className="flex-1">
                                        <div className="text-xs text-slate-400 mb-1">Termín dokončení</div>
                                        <div className="font-medium text-white">{project.finishDate || '—'}</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                                    <span className="material-symbols-outlined text-cyan-400 mt-0.5">person</span>
                                    <div className="flex-1">
                                        <div className="text-xs text-slate-400 mb-1">Hlavní stavbyvedoucí</div>
                                        <div className="font-medium text-white">{project.siteManager || '—'}</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                                    <span className="material-symbols-outlined text-violet-400 mt-0.5">engineering</span>
                                    <div className="flex-1">
                                        <div className="text-xs text-slate-400 mb-1">Stavbyvedoucí</div>
                                        <div className="font-medium text-white">{project.constructionManager || '—'}</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                                    <span className="material-symbols-outlined text-rose-400 mt-0.5">handyman</span>
                                    <div className="flex-1">
                                        <div className="text-xs text-slate-400 mb-1">Stavební technik</div>
                                        <div className="font-medium text-white">{project.constructionTechnician || '—'}</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Investor</label>
                                    <input
                                        type="text"
                                        value={infoForm.investor}
                                        onChange={e => setInfoForm({ ...infoForm, investor: e.target.value })}
                                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500/50 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Technický dozor</label>
                                    <input
                                        type="text"
                                        value={infoForm.technicalSupervisor}
                                        onChange={e => setInfoForm({ ...infoForm, technicalSupervisor: e.target.value })}
                                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500/50 focus:outline-none"
                                    />
                                </div>
                                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Lokace</label>
                                    <input
                                        type="text"
                                        value={infoForm.location}
                                        onChange={e => setInfoForm({ ...infoForm, location: e.target.value })}
                                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500/50 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Termín dokončení</label>
                                    <input
                                        type="text"
                                        value={infoForm.finishDate}
                                        onChange={e => setInfoForm({ ...infoForm, finishDate: e.target.value })}
                                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500/50 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Hlavní stavbyvedoucí</label>
                                    <input
                                        type="text"
                                        value={infoForm.siteManager}
                                        onChange={e => setInfoForm({ ...infoForm, siteManager: e.target.value })}
                                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500/50 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Stavbyvedoucí</label>
                                    <input
                                        type="text"
                                        value={infoForm.constructionManager}
                                        onChange={e => setInfoForm({ ...infoForm, constructionManager: e.target.value })}
                                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500/50 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Stavební technik</label>
                                    <input
                                        type="text"
                                        value={infoForm.constructionTechnician}
                                        onChange={e => setInfoForm({ ...infoForm, constructionTechnician: e.target.value })}
                                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500/50 focus:outline-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Middle Column: Financial Cards */}
                <div className="flex flex-col gap-6">
                    {/* Investor Financials Card */}
                    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-emerald-400">account_balance_wallet</span>
                                Smlouva s investorem
                            </h3>
                            {!editingInvestor ? (
                                <button onClick={() => setEditingInvestor(true)} className="p-2 hover:bg-slate-700/50 rounded-lg transition-all">
                                    <span className="material-symbols-outlined text-slate-400 text-[20px]">edit</span>
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button onClick={handleSaveInvestor} className="text-green-500 hover:text-green-600">
                                        <span className="material-symbols-outlined text-[20px]">check</span>
                                    </button>
                                    <button onClick={() => setEditingInvestor(false)} className="text-red-500 hover:text-red-600">
                                        <span className="material-symbols-outlined text-[20px]">close</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {!editingInvestor ? (
                            <div className="flex flex-col gap-4">
                                <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                                    <span className="text-slate-400 text-sm">Základní SOD</span>
                                    <span className="font-semibold text-white">{formatMoneyFull(investor.sodPrice)}</span>
                                </div>

                                {investor.amendments.map((amendment, idx) => (
                                    <div key={amendment.id} className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                                        <span className="text-slate-400 text-sm">{amendment.label}</span>
                                        <span className="font-semibold text-white">{formatMoneyFull(amendment.price)}</span>
                                    </div>
                                ))}

                                <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg border-t-2 border-slate-700">
                                    <span className="text-slate-400 text-sm font-bold uppercase">Celkem bez DPH</span>
                                    <span className="text-lg font-bold text-emerald-400">{formatMoneyFull(totalBudget)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Základní cena SOD</label>
                                    <input
                                        type="number"
                                        value={investorForm.sodPrice}
                                        onChange={e => setInvestorForm({ ...investorForm, sodPrice: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-2 text-sm text-slate-900 dark:text-white font-semibold text-right"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs text-slate-500 mb-1 block">Dodatky</label>
                                    {investorForm.amendments.map((amendment, idx) => (
                                        <div key={amendment.id} className="flex gap-2 items-center">
                                            <input
                                                type="text"
                                                value={amendment.label}
                                                onChange={e => updateAmendment(idx, 'label', e.target.value)}
                                                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-white"
                                                placeholder="Název dodatku"
                                            />
                                            <input
                                                type="number"
                                                value={amendment.price}
                                                onChange={e => updateAmendment(idx, 'price', parseFloat(e.target.value) || 0)}
                                                className="w-28 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                                                placeholder="Cena"
                                            />
                                            <button onClick={() => removeAmendment(idx)} className="text-red-400 hover:text-red-600">
                                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={addAmendment}
                                        className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 mt-2 font-medium"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">add</span>
                                        Přidat dodatek
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Internal Budget Card */}
                    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-400">savings</span>
                                Interní Rozpočet
                            </h3>
                            {!editingInternal ? (
                                <button onClick={() => setEditingInternal(true)} className="p-2 hover:bg-slate-700/50 rounded-lg transition-all">
                                    <span className="material-symbols-outlined text-slate-400 text-[20px]">edit</span>
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button onClick={handleSaveInternal} className="text-green-500 hover:text-green-600">
                                        <span className="material-symbols-outlined text-[20px]">check</span>
                                    </button>
                                    <button onClick={() => setEditingInternal(false)} className="text-red-500 hover:text-red-600">
                                        <span className="material-symbols-outlined text-[20px]">close</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {!editingInternal ? (
                            <div className="flex flex-col gap-4">
                                <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                                    <span className="text-slate-400 text-sm">Plánovaný náklad</span>
                                    <span className="font-semibold text-white">
                                        {plannedCost > 0 ? formatMoneyFull(plannedCost) : 'Nezadáno'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                                    <span className="text-slate-400 text-sm">Zasmluvněno</span>
                                    <span className="font-semibold text-white">{formatMoneyFull(totalContractedCost)}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg border-t-2 border-slate-700">
                                    <span className="text-slate-400 text-sm font-medium">Aktuální rezerva</span>
                                    <span className={`text-lg font-bold ${plannedBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {plannedBalance >= 0 ? '+' : ''}{formatMoneyFull(plannedBalance)}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Plánovaný náklad (Cíl)</label>
                                    <input
                                        type="number"
                                        value={internalForm.plannedCost}
                                        onChange={e => setInternalForm({ ...internalForm, plannedCost: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white font-semibold text-right focus:border-orange-500/50 focus:outline-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Contracts & Activity */}
                <div className="flex flex-col gap-6">
                    {/* Contract Info Card */}
                    {contract && (
                        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-amber-400">gavel</span>
                                    Parametry smlouvy
                                </h3>
                                {!editingContract ? (
                                    <button onClick={() => setEditingContract(true)} className="p-2 hover:bg-slate-700/50 rounded-lg transition-all">
                                        <span className="material-symbols-outlined text-slate-400 text-[20px]">edit</span>
                                    </button>
                                ) : (
                                    <div className="flex gap-2">
                                        <button onClick={handleSaveContract} className="text-green-500 hover:text-green-600">
                                            <span className="material-symbols-outlined text-[20px]">check</span>
                                        </button>
                                        <button onClick={() => setEditingContract(false)} className="text-red-500 hover:text-red-600">
                                            <span className="material-symbols-outlined text-[20px]">close</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {!editingContract ? (
                                <div className="flex flex-col gap-4">
                                    <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                                        <span className="text-slate-400 text-sm">Splatnost</span>
                                        <span className="font-semibold text-white">{contract.maturity} dní</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                                        <span className="text-slate-400 text-sm">Záruka</span>
                                        <span className="font-semibold text-white">{contract.warranty} měsíců</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                                        <span className="text-slate-400 text-sm">Pozastávka</span>
                                        <span className="font-semibold text-white">{contract.retention}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                                        <span className="text-slate-400 text-sm">Zařízení staveniště</span>
                                        <span className="font-semibold text-white">{contract.siteFacilities} %</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                                        <span className="text-slate-400 text-sm">Podíl na pojištění</span>
                                        <span className="font-semibold text-white">{contract.insurance} %</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="text-xs text-slate-500">Splatnost (dní)</label>
                                        <input
                                            type="number"
                                            value={contractForm.maturity}
                                            onChange={e => setContractForm({ ...contractForm, maturity: parseInt(e.target.value) || 0 })}
                                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="text-xs text-slate-500">Záruka (měsíců)</label>
                                        <input
                                            type="number"
                                            value={contractForm.warranty}
                                            onChange={e => setContractForm({ ...contractForm, warranty: parseInt(e.target.value) || 0 })}
                                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="text-xs text-slate-500">Pozastávka</label>
                                        <input
                                            type="text"
                                            value={contractForm.retention}
                                            onChange={e => setContractForm({ ...contractForm, retention: e.target.value })}
                                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="text-xs text-slate-500">Zař. staveniště (%)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={contractForm.siteFacilities}
                                            onChange={e => setContractForm({ ...contractForm, siteFacilities: parseFloat(e.target.value) || 0 })}
                                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="text-xs text-slate-500">Pojištění (%)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={contractForm.insurance}
                                            onChange={e => setContractForm({ ...contractForm, insurance: parseFloat(e.target.value) || 0 })}
                                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Detailed Financial Analysis Table */}
            <FinancialAnalysisTable categories={project.categories} bids={project.bids} />
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
}

export const ProjectLayout: React.FC<ProjectLayoutProps> = ({ projectId, projectDetails, onUpdateDetails, onAddCategory, onEditCategory, onDeleteCategory, onBidsChange, activeTab, onTabChange, contacts, statuses }) => {
    const project = projectDetails;

    if (!project) return <div>Project not found</div>;

    return (
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
            <Header title={project.title} subtitle="Detail stavby">
                <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
                    <button
                        onClick={() => onTabChange('overview')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                    >
                        Přehled
                    </button>
                    <button
                        onClick={() => onTabChange('pipeline')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'pipeline' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                    >
                        Pipelines
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
                {activeTab === 'overview' && <ProjectOverview project={project} onUpdate={onUpdateDetails} />}
                {activeTab === 'pipeline' && <Pipeline projectId={projectId} projectDetails={project} bids={project.bids || {}} contacts={contacts} statuses={statuses} onAddCategory={onAddCategory} onEditCategory={onEditCategory} onDeleteCategory={onDeleteCategory} onBidsChange={(bids) => onBidsChange?.(projectId, bids)} />}
                {activeTab === 'documents' && <ProjectDocuments project={project} onUpdate={onUpdateDetails} />}
            </div>
        </div>
    );
};
