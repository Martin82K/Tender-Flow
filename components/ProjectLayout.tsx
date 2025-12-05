
import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { Pipeline } from './Pipeline';
import { ProjectTab, ProjectDetails, ContractDetails, InvestorFinancials, DemandCategory, Bid, Subcontractor, StatusConfig } from '../types';
import { uploadDocument, formatFileSize } from '../services/documentService';

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

    useEffect(() => {
        setDocsLinkValue(project.documentationLink || '');
    }, [project.documentationLink, isEditingDocs]);

    useEffect(() => {
        setLetterLinkValue(project.inquiryLetterLink || '');
    }, [project.inquiryLetterLink, isEditingLetter]);

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
        <div className="p-6 lg:p-10 flex flex-col gap-6 overflow-y-auto h-full">
            <div className="max-w-4xl mx-auto w-full">
                {/* Header Card */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary text-2xl">folder_open</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Projektová dokumentace</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Odkaz na sdílenou dokumentaci stavby</p>
                        </div>
                    </div>

                    <div className={`rounded-lg p-6 border transition-colors ${hasDocsLink ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-400">link</span>
                                <h3 className="font-semibold text-slate-900 dark:text-white">Odkaz na dokumentaci</h3>
                                {hasDocsLink && (
                                    <span className="ml-2 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-[10px] font-bold uppercase rounded-full border border-green-200 dark:border-green-800">
                                        Nastaveno
                                    </span>
                                )}
                            </div>
                            {!isEditingDocs ? (
                                <button 
                                    onClick={() => setIsEditingDocs(true)} 
                                    className="text-slate-400 hover:text-primary transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[20px]">edit</span>
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
                                            className="block p-4 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-600 transition-all group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <span className="material-symbols-outlined text-primary">description</span>
                                                    <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                                        {project.documentationLink}
                                                    </span>
                                                </div>
                                                <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">open_in_new</span>
                                            </div>
                                        </a>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">info</span>
                                            Klikněte pro otevření v novém okně
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-5xl mb-3 block">link_off</span>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">Žádný odkaz není nastaven</p>
                                        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Klikněte na ikonu úprav pro přidání odkazu</p>
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
                                    className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
                                />
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Zadejte URL odkaz na sdílenou složku (např. Google Drive, Dropbox, SharePoint)
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Inquiry Letter Section */}
                    <div className={`rounded-lg p-6 border mt-6 transition-colors ${hasLetterLink ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-400">mail</span>
                                <h3 className="font-semibold text-slate-900 dark:text-white">Poptávkový dopis (šablona)</h3>
                                {hasLetterLink && (
                                    <span className="ml-2 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-[10px] font-bold uppercase rounded-full border border-green-200 dark:border-green-800">
                                        Nastaveno
                                    </span>
                                )}
                            </div>
                            {!isEditingLetter ? (
                                <button 
                                    onClick={() => setIsEditingLetter(true)} 
                                    className="text-slate-400 hover:text-primary transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleSaveLetter}
                                        disabled={isUploadingTemplate}
                                        className={`transition-colors ${isUploadingTemplate ? 'text-slate-400 cursor-not-allowed' : 'text-green-500 hover:text-green-600'}`}
                                    >
                                        {isUploadingTemplate ? (
                                            <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                                        ) : (
                                            <span className="material-symbols-outlined text-[20px]">check</span>
                                        )}
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setIsEditingLetter(false);
                                            setSelectedTemplateFile(null);
                                        }}
                                        disabled={isUploadingTemplate}
                                        className={`transition-colors ${isUploadingTemplate ? 'text-slate-400 cursor-not-allowed' : 'text-red-500 hover:text-red-600'}`}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">close</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {!isEditingLetter ? (
                            <div>
                                {hasLetterLink ? (
                                    <div className="space-y-3">
                                        <a 
                                            href={project.inquiryLetterLink} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="block p-4 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-600 transition-all group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <span className="material-symbols-outlined text-primary">article</span>
                                                    <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                                        {project.inquiryLetterLink}
                                                    </span>
                                                </div>
                                                <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">open_in_new</span>
                                            </div>
                                        </a>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">info</span>
                                            Klikněte pro otevření šablony
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-5xl mb-3 block">mail_outline</span>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">Žádná šablona není nastavena</p>
                                        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Klikněte na ikonu úprav pro přidání odkazu</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Tab Selection */}
                                <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTemplateFile(null)}
                                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                                            !selectedTemplateFile
                                                ? 'text-primary border-b-2 border-primary'
                                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[18px]">link</span>
                                            URL odkaz
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setLetterLinkValue('');
                                            const input = document.getElementById('template-file-input') as HTMLInputElement;
                                            input?.click();
                                        }}
                                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                                            selectedTemplateFile
                                                ? 'text-primary border-b-2 border-primary'
                                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[18px]">upload_file</span>
                                            Nahrát soubor
                                        </span>
                                    </button>
                                </div>

                                {/* Content based on selection */}
                                {!selectedTemplateFile ? (
                                    <div className="space-y-3">
                                        <input 
                                            type="url"
                                            value={letterLinkValue}
                                            onChange={(e) => setLetterLinkValue(e.target.value)}
                                            placeholder="https://docs.google.com/document/..."
                                            className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
                                        />
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Zadejte URL odkaz na šablonu poptávkového dopisu (např. Google Docs, Word Online)
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-4">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <span className="material-symbols-outlined text-primary text-[24px]">description</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{selectedTemplateFile.name}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatFileSize(selectedTemplateFile.size)}</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedTemplateFile(null)}
                                                className="text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[20px]">close</span>
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Soubor bude nahrán do úložiště při uložení
                                        </p>
                                    </div>
                                )}

                                {/* Hidden file input */}
                                <input
                                    id="template-file-input"
                                    type="file"
                                    accept=".doc,.docx,.pdf,.odt"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            const file = e.target.files[0];
                                            if (file.size > 10 * 1024 * 1024) {
                                                alert('Soubor je příliš velký. Maximum je 10MB.');
                                                return;
                                            }
                                            setSelectedTemplateFile(file);
                                            setLetterLinkValue('');
                                        }
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Dynamic Placeholders Tips */}
                    <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-lg">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 text-[20px]">code</span>
                            <div className="flex-1">
                                <h4 className="font-semibold text-purple-900 dark:text-purple-100 text-sm mb-2">Dynamické proměnné pro šablonu</h4>
                                <p className="text-xs text-purple-700 dark:text-purple-300 mb-3">V šabloně poptávkového dopisu můžete použít tyto proměnné:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                    <div className="bg-white/50 dark:bg-purple-900/20 p-2 rounded">
                                        <code className="text-purple-800 dark:text-purple-200 font-mono">{'{NAZEV_STAVBY}'}</code>
                                        <span className="text-purple-600 dark:text-purple-400 ml-2">- Název projektu</span>
                                    </div>
                                    <div className="bg-white/50 dark:bg-purple-900/20 p-2 rounded">
                                        <code className="text-purple-800 dark:text-purple-200 font-mono">{'{INVESTOR}'}</code>
                                        <span className="text-purple-600 dark:text-purple-400 ml-2">- Investor</span>
                                    </div>
                                    <div className="bg-white/50 dark:bg-purple-900/20 p-2 rounded">
                                        <code className="text-purple-800 dark:text-purple-200 font-mono">{'{LOKACE}'}</code>
                                        <span className="text-purple-600 dark:text-purple-400 ml-2">- Lokace stavby</span>
                                    </div>
                                    <div className="bg-white/50 dark:bg-purple-900/20 p-2 rounded">
                                        <code className="text-purple-800 dark:text-purple-200 font-mono">{'{TERMIN_DOKONCENI}'}</code>
                                        <span className="text-purple-600 dark:text-purple-400 ml-2">- Termín dokončení</span>
                                    </div>
                                    <div className="bg-white/50 dark:bg-purple-900/20 p-2 rounded">
                                        <code className="text-purple-800 dark:text-purple-200 font-mono">{'{STAVBYVEDOUCI}'}</code>
                                        <span className="text-purple-600 dark:text-purple-400 ml-2">- Stavbyvedoucí</span>
                                    </div>
                                    <div className="bg-white/50 dark:bg-purple-900/20 p-2 rounded">
                                        <code className="text-purple-800 dark:text-purple-200 font-mono">{'{SOD_CENA}'}</code>
                                        <span className="text-purple-600 dark:text-purple-400 ml-2">- Cena SOD smlouvy</span>
                                    </div>
                                    <div className="bg-white/50 dark:bg-purple-900/20 p-2 rounded">
                                        <code className="text-purple-800 dark:text-purple-200 font-mono">{'{SPLATNOST}'}</code>
                                        <span className="text-purple-600 dark:text-purple-400 ml-2">- Splatnost faktury</span>
                                    </div>
                                    <div className="bg-white/50 dark:bg-purple-900/20 p-2 rounded">
                                        <code className="text-purple-800 dark:text-purple-200 font-mono">{'{ZARUKA}'}</code>
                                        <span className="text-purple-600 dark:text-purple-400 ml-2">- Záruční doba</span>
                                    </div>
                                    <div className="bg-white/50 dark:bg-purple-900/20 p-2 rounded">
                                        <code className="text-purple-800 dark:text-purple-200 font-mono">{'{POZASTAVKA}'}</code>
                                        <span className="text-purple-600 dark:text-purple-400 ml-2">- Pozastávka</span>
                                    </div>
                                    <div className="bg-white/50 dark:bg-purple-900/20 p-2 rounded">
                                        <code className="text-purple-800 dark:text-purple-200 font-mono">{'{TECHNICKY_DOZOR}'}</code>
                                        <span className="text-purple-600 dark:text-purple-400 ml-2">- TDI</span>
                                    </div>

                                    <div className="bg-white/50 dark:bg-purple-900/20 p-2 rounded">
                                        <code className="text-purple-800 dark:text-purple-200 font-mono">{'{ODKAZ_DOKUMENTACE}'}</code>
                                        <span className="text-purple-600 dark:text-purple-400 ml-2">- Odkaz na dokumentaci</span>
                                    </div>
                                </div>
                                <p className="text-xs text-purple-600 dark:text-purple-400 mt-3 italic">
                                    💡 Použijte mail merge funkci ve Wordu nebo skript v Google Docs pro automatické nahrazení proměnných skutečnými hodnotami.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Tips Section */}
                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[20px]">lightbulb</span>
                            <div>
                                <h4 className="font-semibold text-blue-900 dark:text-blue-100 text-sm mb-1">Tipy pro dokumentaci</h4>
                                <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                                    <li>• Použijte sdílené cloudové úložiště pro snadný přístup celého týmu</li>
                                    <li>• Ujistěte se, že všichni relevantní členové mají přístupová práva</li>
                                    <li>• Udržujte dokumentaci aktuální a dobře organizovanou</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
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
        const winningBid = catBids.find(b => b.status === 'sod');
        const subPrice = winningBid ? parseMoney(winningBid.price || '0') : 0;
        
        const diffSod = cat.sodBudget - subPrice;
        const diffPlan = cat.planBudget - subPrice;

        // Add to totals
        totalSod += cat.sodBudget;
        totalPlan += cat.planBudget;
        if (winningBid) {
            totalSub += subPrice;
            totalDiffSod += diffSod;
            totalDiffPlan += diffPlan;
        }

        return {
            ...cat,
            winningBidder: winningBid?.companyName || '-',
            subPrice,
            diffSod,
            diffPlan,
            hasWinner: !!winningBid
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
        <div className="p-6 lg:p-10 flex flex-col gap-6 overflow-y-auto h-full">
            {/* Top Stats - Updated to include Planned Cost */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                 {/* Card 1: Revenue */}
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Rozpočet (Investor)</p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{formatMoneyFull(totalBudget)}</h3>
                    <p className="text-xs text-slate-400 mt-1">Příjem (SOD + Dodatky)</p>
                    <div className="mt-4 w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-slate-500 h-full" style={{width: '100%'}}></div>
                    </div>
                 </div>

                 {/* Card 2: Planned (Internal) */}
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Plánovaný náklad</p>
                    <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                        {plannedCost > 0 ? formatMoneyFull(plannedCost) : '-'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Interní cíl nákladů</p>
                    <div className="mt-4 w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                         <div className="bg-blue-500 h-full" style={{width: '100%'}}></div>
                    </div>
                 </div>

                 {/* Card 3: Contracted (Real) */}
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Zasmluvněno (Realita)</p>
                    <h3 className="text-2xl font-bold text-primary mt-2">{formatMoneyFull(totalContractedCost)}</h3>
                    <p className="text-xs text-slate-400 mt-1">
                        Zbývá zadat: <span className={plannedBalance >= 0 ? 'text-green-500 font-bold' : 'text-red-500 font-bold'}>
                            {plannedBalance >= 0 ? '+' : ''}{formatMoneyFull(plannedBalance)}
                        </span>
                    </p>
                     <div className="mt-4 w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div 
                            className={`h-full transition-all ${plannedCost > 0 && totalContractedCost > plannedCost ? 'bg-red-500' : 'bg-primary'}`} 
                            style={{width: `${plannedCost > 0 ? (totalContractedCost/plannedCost)*100 : 0}%`}}
                        ></div>
                    </div>
                 </div>

                 {/* Card 4: Progress */}
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Postup Zadávání</p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{completedTasks} / {project.categories.length} <span className="text-sm font-normal text-slate-500">sekcí</span></h3>
                    <p className="text-xs text-slate-400 mt-1">Hotové subdodávky</p>
                    <div className="mt-4 w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-green-500 h-full" style={{width: `${progress}%`}}></div>
                    </div>
                 </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Info Cards */}
                <div className="flex flex-col gap-6">
                    {/* Project Info Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Informace o stavbě</h3>
                            {!editingInfo ? (
                                <button onClick={() => setEditingInfo(true)} className="text-slate-400 hover:text-primary transition-colors">
                                    <span className="material-symbols-outlined text-[20px]">edit</span>
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
                                <div className="flex items-start gap-3">
                                    <span className="material-symbols-outlined text-slate-400">corporate_fare</span>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Investor</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{project.investor || '-'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="material-symbols-outlined text-slate-400">visibility</span>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Technický dozor</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{project.technicalSupervisor || '-'}</p>
                                    </div>
                                </div>
                                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
                                <div className="flex items-start gap-3">
                                    <span className="material-symbols-outlined text-slate-400">location_on</span>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Lokace</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{project.location}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="material-symbols-outlined text-slate-400">calendar_today</span>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Termín dokončení</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{project.finishDate}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="material-symbols-outlined text-slate-400">person</span>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Hlavní stavbyvedoucí</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{project.siteManager}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="material-symbols-outlined text-slate-400">engineering</span>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Stavbyvedoucí</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{project.constructionManager || '-'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="material-symbols-outlined text-slate-400">handyman</span>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Stavební technik</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{project.constructionTechnician || '-'}</p>
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
                                        onChange={e => setInfoForm({...infoForm, investor: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Technický dozor</label>
                                    <input 
                                        type="text" 
                                        value={infoForm.technicalSupervisor}
                                        onChange={e => setInfoForm({...infoForm, technicalSupervisor: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Lokace</label>
                                    <input 
                                        type="text" 
                                        value={infoForm.location}
                                        onChange={e => setInfoForm({...infoForm, location: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Termín dokončení</label>
                                    <input 
                                        type="text" 
                                        value={infoForm.finishDate}
                                        onChange={e => setInfoForm({...infoForm, finishDate: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Hlavní stavbyvedoucí</label>
                                    <input 
                                        type="text" 
                                        value={infoForm.siteManager}
                                        onChange={e => setInfoForm({...infoForm, siteManager: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Stavbyvedoucí</label>
                                    <input 
                                        type="text" 
                                        value={infoForm.constructionManager}
                                        onChange={e => setInfoForm({...infoForm, constructionManager: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Stavební technik</label>
                                    <input 
                                        type="text" 
                                        value={infoForm.constructionTechnician}
                                        onChange={e => setInfoForm({...infoForm, constructionTechnician: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Middle Column: Financial Cards */}
                <div className="flex flex-col gap-6">
                    {/* Investor Financials Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
                                Smlouva s investorem
                            </h3>
                            {!editingInvestor ? (
                                <button onClick={() => setEditingInvestor(true)} className="text-slate-400 hover:text-primary transition-colors">
                                    <span className="material-symbols-outlined text-[20px]">edit</span>
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
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/50 pb-2">
                                    <p className="text-sm font-medium text-slate-800 dark:text-white">Základní SOD</p>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{formatMoneyFull(investor.sodPrice)}</p>
                                </div>
                                
                                {investor.amendments.map((amendment, idx) => (
                                    <div key={amendment.id} className="flex justify-between items-center py-1">
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{amendment.label}</p>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatMoneyFull(amendment.price)}</p>
                                    </div>
                                ))}
                                
                                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white uppercase">Celkem bez DPH</p>
                                    <p className="text-base font-bold text-primary">{formatMoneyFull(totalBudget)}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Základní cena SOD</label>
                                    <input 
                                        type="number" 
                                        value={investorForm.sodPrice}
                                        onChange={e => setInvestorForm({...investorForm, sodPrice: parseFloat(e.target.value) || 0})}
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
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-600">savings</span>
                                Interní Rozpočet
                            </h3>
                            {!editingInternal ? (
                                <button onClick={() => setEditingInternal(true)} className="text-slate-400 hover:text-primary transition-colors">
                                    <span className="material-symbols-outlined text-[20px]">edit</span>
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
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center py-1">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Plánovaný náklad</p>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                                        {plannedCost > 0 ? formatMoneyFull(plannedCost) : 'Nezadáno'}
                                    </p>
                                </div>
                                <div className="flex justify-between items-center py-1">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Zasmluvněno</p>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatMoneyFull(totalContractedCost)}</p>
                                </div>
                                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm font-medium text-slate-800 dark:text-white">Aktuální rezerva</p>
                                        <p className={`text-base font-bold ${plannedBalance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {plannedBalance >= 0 ? '+' : ''}{formatMoneyFull(plannedBalance)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Plánovaný náklad (Cíl)</label>
                                    <input 
                                        type="number" 
                                        value={internalForm.plannedCost}
                                        onChange={e => setInternalForm({...internalForm, plannedCost: parseFloat(e.target.value) || 0})}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-2 text-sm text-slate-900 dark:text-white font-semibold text-right"
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
                         <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                             <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">gavel</span>
                                    Parametry smlouvy
                                </h3>
                                {!editingContract ? (
                                    <button onClick={() => setEditingContract(true)} className="text-slate-400 hover:text-primary transition-colors">
                                        <span className="material-symbols-outlined text-[20px]">edit</span>
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
                                <div className="flex flex-col gap-3 divide-y divide-slate-100 dark:divide-slate-800">
                                    <div className="flex justify-between items-center py-1">
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Splatnost</p>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{contract.maturity} dní</p>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 py-1">
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Záruka</p>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{contract.warranty} měsíců</p>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 py-1">
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Pozastávka</p>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{contract.retention}</p>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 py-1">
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Zařízení staveniště</p>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{contract.siteFacilities} %</p>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 py-1">
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Podíl na pojištění</p>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{contract.insurance} %</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                     <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="text-xs text-slate-500">Splatnost (dní)</label>
                                        <input 
                                            type="number" 
                                            value={contractForm.maturity}
                                            onChange={e => setContractForm({...contractForm, maturity: parseInt(e.target.value) || 0})}
                                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="text-xs text-slate-500">Záruka (měsíců)</label>
                                        <input 
                                            type="number" 
                                            value={contractForm.warranty}
                                            onChange={e => setContractForm({...contractForm, warranty: parseInt(e.target.value) || 0})}
                                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="text-xs text-slate-500">Pozastávka</label>
                                        <input 
                                            type="text" 
                                            value={contractForm.retention}
                                            onChange={e => setContractForm({...contractForm, retention: e.target.value})}
                                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="text-xs text-slate-500">Zař. staveniště (%)</label>
                                        <input 
                                            type="number"
                                            step="0.1" 
                                            value={contractForm.siteFacilities}
                                            onChange={e => setContractForm({...contractForm, siteFacilities: parseFloat(e.target.value) || 0})}
                                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="text-xs text-slate-500">Pojištění (%)</label>
                                        <input 
                                            type="number"
                                            step="0.1"
                                            value={contractForm.insurance}
                                            onChange={e => setContractForm({...contractForm, insurance: parseFloat(e.target.value) || 0})}
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
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button 
                        onClick={() => onTabChange('overview')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                    >
                        Přehled
                    </button>
                    <button 
                        onClick={() => onTabChange('pipeline')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'pipeline' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                    >
                        Pipelines
                    </button>
                    <button 
                        onClick={() => onTabChange('documents')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'documents' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                    >
                        Dokumenty
                    </button>
                </div>
            </Header>

            <div className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'overview' && <ProjectOverview project={project} onUpdate={onUpdateDetails} />}
                {activeTab === 'pipeline' && <Pipeline projectId={projectId} projectDetails={project} bids={project.bids || {}} contacts={contacts} statuses={statuses} onAddCategory={onAddCategory} onEditCategory={onEditCategory} onDeleteCategory={onDeleteCategory} onBidsChange={(bids) => onBidsChange?.(projectId, bids)} />}
                {activeTab === 'documents' && <ProjectDocuments project={project} onUpdate={onUpdateDetails} />}
            </div>
        </div>
    );
};
