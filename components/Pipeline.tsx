
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Header } from './Header';
import { DemandCategory, Bid, BidStatus, Subcontractor, ProjectDetails, StatusConfig, DemandDocument } from '../types';
import { SubcontractorSelector } from './SubcontractorSelector';
import { supabase } from '../services/supabase';
import { uploadDocument, formatFileSize } from '../services/documentService';
import { generateInquiryEmail, createMailtoLink } from '../services/inquiryService';
import { exportToXLSX, exportToMarkdown, exportToPDF } from '../services/exportService';

const DEFAULT_STATUSES: StatusConfig[] = [
  { id: 'available', label: 'K dispozici', color: 'green' },
  { id: 'busy', label: 'Zaneprázdněn', color: 'red' },
  { id: 'waiting', label: 'Čeká', color: 'yellow' }
];

// --- Components ---

interface ColumnProps {
    title: string;
    status: BidStatus;
    color: 'slate' | 'blue' | 'amber' | 'green' | 'red';
    children: React.ReactNode;
    count?: number;
    onDrop: (e: React.DragEvent, status: BidStatus) => void;
}

const Column: React.FC<ColumnProps> = ({ title, status, color, children, count, onDrop }) => {
    const [isOver, setIsOver] = useState(false);

    const colorStyles = {
        slate: { 
            wrapper: 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-white/5',
            headerBorder: 'border-slate-300 dark:border-slate-700',
            headerBg: 'bg-slate-50/90 dark:bg-slate-900/80'
        },
        blue: { 
            wrapper: 'border-blue-100 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-500/5', 
            headerBorder: 'border-blue-200 dark:border-blue-800',
            headerBg: 'bg-blue-50/90 dark:bg-slate-900/80'
        },
        amber: { 
            wrapper: 'border-amber-100 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-500/5', 
            headerBorder: 'border-amber-200 dark:border-amber-800',
            headerBg: 'bg-amber-50/90 dark:bg-slate-900/80'
        },
        green: { 
            wrapper: 'border-green-100 bg-green-50 dark:border-green-900/30 dark:bg-green-500/5', 
            headerBorder: 'border-green-200 dark:border-green-800',
            headerBg: 'bg-green-50/90 dark:bg-slate-900/80'
        },
        red: { 
            wrapper: 'border-red-100 bg-red-50 dark:border-red-900/30 dark:bg-red-500/5', 
            headerBorder: 'border-red-200 dark:border-red-800',
            headerBg: 'bg-red-50/90 dark:bg-slate-900/80'
        }
    };

    const styles = colorStyles[color];

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsOver(true);
    };

    const handleDragLeave = () => {
        setIsOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        setIsOver(false);
        onDrop(e, status);
    };

    return (
        <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col w-80 flex-shrink-0 rounded-xl h-full max-h-full border transition-colors ${styles.wrapper} ${isOver ? 'ring-2 ring-primary ring-inset bg-opacity-70' : ''}`}
        >
            <div className={`p-4 border-b-2 ${styles.headerBorder} ${styles.headerBg} sticky top-0 rounded-t-xl z-10 backdrop-blur-sm flex justify-between items-center transition-colors`}>
                 <h2 className="text-slate-900 dark:text-slate-100 text-sm font-bold uppercase tracking-wide">{title}</h2>
                 {count !== undefined && <span className="bg-white dark:bg-slate-800 text-xs font-bold px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700">{count}</span>}
            </div>
            <div className="flex flex-col gap-3 p-3 overflow-y-auto no-scrollbar flex-1">
                {children}
            </div>
        </div>
    );
}

const EditBidModal: React.FC<{ bid: Bid, onClose: () => void, onSave: (updatedBid: Bid) => void }> = ({ bid, onClose, onSave }) => {
    const [form, setForm] = useState({ ...bid });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(form);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Upravit nabídku</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col">
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Kontaktní osoba</label>
                            <input 
                                type="text" 
                                value={form.contactPerson} 
                                onChange={e => setForm({...form, contactPerson: e.target.value})}
                                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Email</label>
                                <input 
                                    type="email" 
                                    value={form.email || ''} 
                                    onChange={e => setForm({...form, email: e.target.value})}
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Telefon</label>
                                <input 
                                    type="text" 
                                    value={form.phone || ''} 
                                    onChange={e => setForm({...form, phone: e.target.value})}
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Cena</label>
                            <input 
                                type="text" 
                                value={form.price || ''} 
                                onChange={e => setForm({...form, price: e.target.value})}
                                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Poznámka</label>
                            <textarea 
                                rows={3}
                                value={form.notes || ''} 
                                onChange={e => setForm({...form, notes: e.target.value})}
                                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white resize-none"
                            />
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700">Zrušit</button>
                        <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold shadow-sm transition-colors">Uložit</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const BidCard: React.FC<{ bid: Bid, onClick?: () => void, onDragStart: (e: React.DragEvent, bidId: string) => void, onEdit: (bid: Bid) => void, onGenerateInquiry?: (bid: Bid) => void, category?: DemandCategory }> = ({ bid, onClick, onDragStart, onEdit, onGenerateInquiry, category }) => {
    return (
        <div 
            draggable
            onDragStart={(e) => onDragStart(e, bid.id)}
            onClick={onClick} 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-3 border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-primary/50 transition-all cursor-grab active:cursor-grabbing group"
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{bid.companyName}</h3>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onEdit(bid); }}
                        className="text-slate-400 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                    >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                </div>
                {bid.price && bid.price !== '-' && bid.price !== '?' && (
                    <span className="text-xs font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
                        {bid.price}
                    </span>
                )}
            </div>
            
            <div className="flex flex-col gap-1 mb-3">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
                    <span className="material-symbols-outlined text-[14px]">person</span>
                    {bid.contactPerson}
                </div>
                {bid.phone && (
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
                        <span className="material-symbols-outlined text-[14px]">call</span>
                        {bid.phone}
                    </div>
                )}
                {bid.email && (
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
                        <span className="material-symbols-outlined text-[14px]">mail</span>
                        {bid.email}
                    </div>
                )}
                {bid.notes && (
                    <p className="text-xs text-slate-400 italic mt-1">"{bid.notes}"</p>
                )}
            </div>

            {bid.tags && bid.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                    {bid.tags.map(tag => (
                        <span key={tag} className="text-[10px] bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                            {tag}
                        </span>
                    ))}
                </div>
            )}
            
            {/* Generate Inquiry Button for contacted status */}
            {bid.status === 'contacted' && onGenerateInquiry && bid.email && (
                <button
                    onClick={(e) => { e.stopPropagation(); onGenerateInquiry(bid); }}
                    className="mt-3 w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors"
                >
                    <span className="material-symbols-outlined text-[16px]">mail</span>
                    Generovat poptávku
                </button>
            )}
        </div>
    )
}

const CategoryCard: React.FC<{ category: DemandCategory, onClick: () => void, onEdit?: (category: DemandCategory) => void, onDelete?: (categoryId: string) => void }> = ({ category, onClick, onEdit, onDelete }) => {
    const statusColors = {
        open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
        negotiating: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
        closed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200',
        sod: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200',
    };

    const statusLabels = {
        open: 'Poptávání',
        negotiating: 'Vyjednávání',
        closed: 'Uzavřeno',
        sod: 'V Realizaci',
    };

    const status = category.status === 'sod' ? 'sod' : category.status === 'closed' ? 'closed' : category.status === 'negotiating' ? 'negotiating' : 'open';

    // Formatting Helper
    const formatMoney = (val: number) => {
        if(!val) return '-';
        return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(val);
    }

    return (
        <button onClick={onClick} className="flex flex-col text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:shadow-lg hover:border-primary/50 transition-all group relative overflow-hidden h-full">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            {/* Action buttons */}
            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onEdit && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(category); }}
                        className="p-1.5 bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-900/60 rounded-lg transition-colors"
                        title="Upravit"
                    >
                        <span className="material-symbols-outlined text-[16px] text-blue-700 dark:text-blue-200">edit</span>
                    </button>
                )}
                {onDelete && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(category.id); }}
                        className="p-1.5 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 rounded-lg transition-colors"
                        title="Smazat"
                    >
                        <span className="material-symbols-outlined text-[16px] text-red-700 dark:text-red-200">delete</span>
                    </button>
                )}
            </div>
            
            <div className="flex justify-between w-full items-start mb-2">
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${statusColors[status]}`}>
                    {statusLabels[status]}
                </span>
                <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">arrow_forward</span>
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{category.title}</h3>
            
            {category.deadline && (() => {
                const deadlineDate = new Date(category.deadline);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const daysUntil = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const isOverdue = daysUntil < 0;
                const isUrgent = daysUntil >= 0 && daysUntil <= 7;
                
                const colorClass = isOverdue 
                    ? 'text-red-600 dark:text-red-400' 
                    : isUrgent 
                        ? 'text-orange-600 dark:text-orange-400' 
                        : 'text-slate-500 dark:text-slate-400';
                
                return (
                    <div className={`flex items-center gap-1 text-xs mb-2 ${colorClass}`}>
                        <span className="material-symbols-outlined text-[14px]">event</span>
                        <span>Termín: {deadlineDate.toLocaleDateString('cs-CZ')}</span>
                        {isOverdue && <span className="font-bold">(prošlý)</span>}
                        {isUrgent && !isOverdue && <span className="font-bold">({daysUntil}d)</span>}
                    </div>
                );
            })()}
            
            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 h-10">
                {category.description}
            </p>

            <div className="flex items-center justify-between w-full mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-col">
                     <span className="text-xs text-slate-400">Cena SOD</span>
                     <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatMoney(category.sodBudget)}</span>
                </div>
                 <div className="flex flex-col items-end">
                     <span className="text-xs text-slate-400">Dodavatelé</span>
                     <div className="flex items-center gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <span className="material-symbols-outlined text-[16px]">groups</span>
                        {category.subcontractorCount}
                     </div>
                </div>
                {category.documents && category.documents.length > 0 && (
                    <div className="flex flex-col items-end">
                        <span className="text-xs text-slate-400">Dokumenty</span>
                        <div className="flex items-center gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                            <span className="material-symbols-outlined text-[16px]">attachment</span>
                            {category.documents.length}
                        </div>
                    </div>
                )}
            </div>
        </button>
    );
}


interface PipelineProps {
    projectId: string;
    projectDetails: ProjectDetails;
    bids: Record<string, Bid[]>;
    contacts: Subcontractor[];
    onAddCategory?: (category: DemandCategory) => void;
    onEditCategory?: (category: DemandCategory) => void;
    onDeleteCategory?: (categoryId: string) => void;
}

const CreateContactModal: React.FC<{ initialName: string, onClose: () => void, onSave: (contact: Subcontractor) => void }> = ({ initialName, onClose, onSave }) => {
    const [form, setForm] = useState({
        company: initialName,
        name: '',
        email: '',
        phone: '',
        specialization: '',
        ico: '',
        region: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newContact: Subcontractor = {
            id: crypto.randomUUID(),
            company: form.company,
            name: form.name || '-',
            email: form.email || '-',
            phone: form.phone || '-',
            specialization: form.specialization || 'Ostatní',
            ico: form.ico,
            region: form.region,
            status: 'available'
        };
        onSave(newContact);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nový dodavatel</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col">
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Firma / Název *</label>
                            <input 
                                required
                                type="text" 
                                value={form.company} 
                                onChange={e => setForm({...form, company: e.target.value})}
                                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Specializace</label>
                            <input 
                                type="text" 
                                value={form.specialization} 
                                onChange={e => setForm({...form, specialization: e.target.value})}
                                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                placeholder="Např. Elektro, Zedník..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Kontaktní osoba</label>
                            <input 
                                type="text" 
                                value={form.name} 
                                onChange={e => setForm({...form, name: e.target.value})}
                                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Email</label>
                                <input 
                                    type="email" 
                                    value={form.email} 
                                    onChange={e => setForm({...form, email: e.target.value})}
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Telefon</label>
                                <input 
                                    type="text" 
                                    value={form.phone} 
                                    onChange={e => setForm({...form, phone: e.target.value})}
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700">Zrušit</button>
                        <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold shadow-sm transition-colors">Vytvořit</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const Pipeline: React.FC<PipelineProps> = ({ projectId, projectDetails, bids: initialBids, contacts, onAddCategory, onEditCategory, onDeleteCategory }) => {
    const [activeCategory, setActiveCategory] = useState<DemandCategory | null>(null);
    const [bids, setBids] = useState<Record<string, Bid[]>>(initialBids);
    // const [contacts, setContacts] = useState<Subcontractor[]>(ALL_CONTACTS); // Use prop directly or state if we modify it locally?
    // The component modifies contacts (adding new ones). So we might need state, but initialized from prop.
    // However, App.tsx manages contacts. Ideally we should call a handler to add contact in App.tsx.
    // For now, let's keep local state initialized from prop to minimize refactor, 
    // BUT we need to sync back or just rely on the fact that we insert to Supabase and App.tsx might reload?
    // App.tsx doesn't auto-reload contacts on change in child.
    // Let's use the prop for reading, but we need a way to update.
    // The original code had `setContacts`.
    // Let's use a local state initialized from prop for now.
    const [localContacts, setLocalContacts] = useState<Subcontractor[]>(contacts);
    
    useEffect(() => {
        setLocalContacts(contacts);
    }, [contacts]);

    useEffect(() => {
        setBids(initialBids);
    }, [initialBids]);
    
    // Subcontractor Selection State
    const [isSubcontractorModalOpen, setIsSubcontractorModalOpen] = useState(false);
    const [selectedSubcontractorIds, setSelectedSubcontractorIds] = useState<Set<string>>(new Set());
    
    // Edit Bid State
    const [editingBid, setEditingBid] = useState<Bid | null>(null);

    // Create New Category State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<DemandCategory | null>(null);
    const [newCategoryForm, setNewCategoryForm] = useState({
        title: '',
        sodBudget: '',
        planBudget: '',
        description: '',
        deadline: ''
    });
    const [isSubcontractorModalMaximized, setIsSubcontractorModalMaximized] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState(false);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const exportButtonRef = useRef<HTMLButtonElement>(null);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

    // Create Contact State
    const [isCreateContactModalOpen, setIsCreateContactModalOpen] = useState(false);
    const [newContactName, setNewContactName] = useState('');

    // Reset active category when switching projects
    useEffect(() => {
        setActiveCategory(null);
    }, [projectId]);

    const projectData = projectDetails;

    const getBidsForColumn = (categoryId: string, status: BidStatus) => {
        return (bids[categoryId] || []).filter(bid => bid.status === status);
    };

    const handleDragStart = (e: React.DragEvent, bidId: string) => {
        e.dataTransfer.setData('bidId', bidId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetStatus: BidStatus) => {
        e.preventDefault();
        const bidId = e.dataTransfer.getData('bidId');
        
        if (activeCategory && bidId) {
            setBids(prev => {
                const categoryBids = [...(prev[activeCategory.id] || [])];
                const bidIndex = categoryBids.findIndex(b => b.id === bidId);
                
                if (bidIndex > -1 && categoryBids[bidIndex].status !== targetStatus) {
                    categoryBids[bidIndex] = { ...categoryBids[bidIndex], status: targetStatus };
                    return { ...prev, [activeCategory.id]: categoryBids };
                }
                return prev;
            });
        }
    };

    const handleAddSubcontractors = () => {
        if (!activeCategory) return;

        const newBids: Bid[] = [];
        selectedSubcontractorIds.forEach(id => {
            const contact = localContacts.find(c => c.id === id);
            if (contact) {
                // Check if already exists
                const existing = (bids[activeCategory.id] || []).find(b => b.subcontractorId === contact.id);
                if (!existing) {
                    newBids.push({
                        id: `bid_${Date.now()}_${contact.id}`,
                        subcontractorId: contact.id,
                        companyName: contact.company,
                        contactPerson: contact.name,
                        email: contact.email,
                        phone: contact.phone,
                        price: '?',
                        status: 'contacted',
                        tags: []
                    });
                }
            }
        });

        if (newBids.length > 0) {
            setBids(prev => ({
                ...prev,
                [activeCategory.id]: [...(prev[activeCategory.id] || []), ...newBids]
            }));
        }

        setIsSubcontractorModalOpen(false);
        setSelectedSubcontractorIds(new Set());
    };

    const handleCreateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!onAddCategory) return;
        
        const sod = parseFloat(newCategoryForm.sodBudget) || 0;
        const categoryId = `cat_${Date.now()}`;
        
        // Upload documents if any
        let uploadedDocuments: DemandDocument[] = [];
        if (selectedFiles.length > 0) {
            setUploadingFiles(true);
            try {
                uploadedDocuments = await Promise.all(
                    selectedFiles.map(file => uploadDocument(file, categoryId))
                );
            } catch (error) {
                console.error('Error uploading documents:', error);
                alert('Chyba při nahrávání dokumentů. Zkuste to prosím znovu.');
                setUploadingFiles(false);
                return;
            }
            setUploadingFiles(false);
        }
        
        const newCat: DemandCategory = {
            id: categoryId,
            title: newCategoryForm.title,
            budget: '~' + new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(sod) + ' Kč', // Legacy
            sodBudget: sod,
            planBudget: parseFloat(newCategoryForm.planBudget) || 0,
            description: newCategoryForm.description,
            status: 'open',
            subcontractorCount: 0,
            documents: uploadedDocuments.length > 0 ? uploadedDocuments : undefined,
            deadline: newCategoryForm.deadline || undefined
        };

        onAddCategory(newCat);
        setNewCategoryForm({ title: '', sodBudget: '', planBudget: '', description: '', deadline: '' });
        setSelectedFiles([]);
        setIsAddModalOpen(false);
    };

    const handleEditCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!onEditCategory || !editingCategory) return;
        
        const sod = parseFloat(newCategoryForm.sodBudget) || 0;
        
        // Upload documents if any new files selected
        let uploadedDocuments: DemandDocument[] = editingCategory.documents || [];
        if (selectedFiles.length > 0) {
            setUploadingFiles(true);
            try {
                const newDocs = await Promise.all(
                    selectedFiles.map(file => uploadDocument(file, editingCategory.id))
                );
                uploadedDocuments = [...uploadedDocuments, ...newDocs];
            } catch (error) {
                console.error('Error uploading documents:', error);
                alert('Chyba při nahrávání dokumentů. Zkuste to prosím znovu.');
                setUploadingFiles(false);
                return;
            }
            setUploadingFiles(false);
        }
        
        const updatedCat: DemandCategory = {
            ...editingCategory,
            title: newCategoryForm.title,
            budget: '~' + new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(sod) + ' Kč',
            sodBudget: sod,
            planBudget: parseFloat(newCategoryForm.planBudget) || 0,
            description: newCategoryForm.description,
            documents: uploadedDocuments.length > 0 ? uploadedDocuments : undefined,
            deadline: newCategoryForm.deadline || undefined
        };

        onEditCategory(updatedCat);
        setNewCategoryForm({ title: '', sodBudget: '', planBudget: '', description: '', deadline: '' });
        setSelectedFiles([]);
        setEditingCategory(null);
        setIsEditModalOpen(false);
    };

    const handleEditCategoryClick = (category: DemandCategory) => {
        setEditingCategory(category);
        setNewCategoryForm({
            title: category.title,
            sodBudget: category.sodBudget.toString(),
            planBudget: category.planBudget.toString(),
            description: category.description,
            deadline: category.deadline || ''
        });
        setSelectedFiles([]);
        setIsEditModalOpen(true);
    };

    const handleDeleteCategory = (categoryId: string) => {
        if (!onDeleteCategory) return;
        
        if (confirm('Opravdu chcete smazat tuto poptávku? Tato akce je nevratná.')) {
            onDeleteCategory(categoryId);
        }
    };

    const handleSaveBid = (updatedBid: Bid) => {
        if (!activeCategory) return;
        
        setBids(prev => {
            const categoryBids = [...(prev[activeCategory.id] || [])];
            const index = categoryBids.findIndex(b => b.id === updatedBid.id);
            if (index > -1) {
                categoryBids[index] = updatedBid;
                return { ...prev, [activeCategory.id]: categoryBids };
            }
            return prev;
        });
        setEditingBid(null);
    };

    const handleCreateContactRequest = (name: string) => {
        setNewContactName(name);
        setIsCreateContactModalOpen(true);
    };

    const handleGenerateInquiry = (bid: Bid) => {
        if (!activeCategory) return;
        
        // Generate email content
        const { subject, body } = generateInquiryEmail(activeCategory, projectDetails, bid);
        
        // Create mailto link
        const mailtoLink = createMailtoLink(bid.email || '', subject, body);
        
        // Open email client
        window.location.href = mailtoLink;
        
        // Move bid to 'sent' status
        setTimeout(() => {
            setBids(prev => {
                const categoryBids = [...(prev[activeCategory.id] || [])];
                const index = categoryBids.findIndex(b => b.id === bid.id);
                if (index > -1) {
                    categoryBids[index] = { ...categoryBids[index], status: 'sent' };
                    return { ...prev, [activeCategory.id]: categoryBids };
                }
                return prev;
            });
        }, 100);
    };

    const handleExport = (format: 'xlsx' | 'markdown' | 'pdf') => {
        if (!activeCategory) return;
        
        const categoryBids = bids[activeCategory.id] || [];
        
        try {
            switch (format) {
                case 'xlsx':
                    exportToXLSX(activeCategory, categoryBids, projectDetails);
                    break;
                case 'markdown':
                    exportToMarkdown(activeCategory, categoryBids, projectDetails);
                    break;
                case 'pdf':
                    exportToPDF(activeCategory, categoryBids, projectDetails);
                    break;
            }
            setIsExportMenuOpen(false);
        } catch (error) {
            console.error('Export error:', error);
            alert('Chyba při exportu. Zkuste to prosím znovu.');
        }
    };

    const handleSaveNewContact = async (newContact: Subcontractor) => {
        // Optimistic update
        setLocalContacts(prev => [...prev, newContact]);
        setSelectedSubcontractorIds(prev => new Set(prev).add(newContact.id));
        setIsCreateContactModalOpen(false);

        // Persist to Supabase
        try {
            const { error } = await supabase.from('subcontractors').insert({
                id: newContact.id,
                company_name: newContact.company,
                contact_person_name: newContact.name,
                email: newContact.email,
                phone: newContact.phone,
                specialization: newContact.specialization,
                ico: newContact.ico,
                region: newContact.region,
                status_id: newContact.status
            });

            if (error) {
                console.error('Error saving contact to Supabase:', error);
                // Optionally revert state or show notification
            }
        } catch (err) {
            console.error('Unexpected error saving contact:', err);
        }
    };

    if (activeCategory) {
        // --- DETAIL VIEW (PIPELINE) ---
        return (
            <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
                <Header title={activeCategory.title} subtitle={`${projectData.title} > Průběh výběrového řízení`}>
                    <button 
                        onClick={() => setActiveCategory(null)}
                        className="mr-auto flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors px-2"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                        <span className="text-sm font-medium">Zpět na přehled</span>
                    </button>
                     <button 
                        onClick={() => setIsSubcontractorModalOpen(true)}
                        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        <span>Přidat dodavatele</span>
                    </button>
                    
                    {/* Export Button with Dropdown */}
                    <div className="relative">
                        <button 
                            ref={exportButtonRef}
                            onClick={() => {
                                if (!isExportMenuOpen && exportButtonRef.current) {
                                    const rect = exportButtonRef.current.getBoundingClientRect();
                                    setMenuPosition({
                                        top: rect.bottom + 8,
                                        left: rect.right - 224 // w-56 = 14rem = 224px
                                    });
                                }
                                setIsExportMenuOpen(!isExportMenuOpen);
                            }}
                            className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                        >
                            <span className="material-symbols-outlined text-[20px]">download</span>
                            <span>Export</span>
                            <span className="material-symbols-outlined text-[16px]">expand_more</span>
                        </button>
                        
                        {isExportMenuOpen && createPortal(
                            <>
                                <div 
                                    className="fixed inset-0 z-[9998] bg-transparent" 
                                    onClick={() => setIsExportMenuOpen(false)}
                                />
                                <div 
                                    className="fixed w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-[9999]"
                                    style={{ 
                                        top: `${menuPosition.top}px`, 
                                        left: `${menuPosition.left}px` 
                                    }}
                                >
                                    <button
                                        onClick={() => handleExport('xlsx')}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left border-b border-slate-100 dark:border-slate-700"
                                    >
                                        <span className="material-symbols-outlined text-green-600 text-[20px]">table_chart</span>
                                        <div>
                                            <div className="text-sm font-medium text-slate-900 dark:text-white">Excel</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">.xlsx formát</div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => handleExport('markdown')}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left border-b border-slate-100 dark:border-slate-700"
                                    >
                                        <span className="material-symbols-outlined text-blue-600 text-[20px]">code</span>
                                        <div>
                                            <div className="text-sm font-medium text-slate-900 dark:text-white">Markdown</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">.md formát</div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => handleExport('pdf')}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                                    >
                                        <span className="material-symbols-outlined text-red-600 text-[20px]">picture_as_pdf</span>
                                        <div>
                                            <div className="text-sm font-medium text-slate-900 dark:text-white">PDF</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">.pdf formát</div>
                                        </div>
                                    </button>
                                </div>
                            </>,
                            document.body
                        )}
                    </div>
                </Header>
                
                {/* Document List Section */}
                {activeCategory.documents && activeCategory.documents.length > 0 && (
                    <div className="px-6 pt-4">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-slate-600 dark:text-slate-400 text-[20px]">folder_open</span>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Přiložené dokumenty</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {activeCategory.documents.map((doc) => (
                                    <a
                                        key={doc.id}
                                        href={doc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
                                    >
                                        <span className="material-symbols-outlined text-slate-400 text-[20px]">description</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-primary">{doc.name}</p>
                                            <p className="text-[10px] text-slate-400">{formatFileSize(doc.size)}</p>
                                        </div>
                                        <span className="material-symbols-outlined text-slate-400 group-hover:text-primary text-[16px]">download</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
                    <div className="flex h-full space-x-4 min-w-max">
                        {/* 1. Oslovení (Contacted) */}
                        <Column 
                            title="Oslovení" 
                            status="contacted"
                            color="slate" 
                            count={getBidsForColumn(activeCategory.id, 'contacted').length}
                            onDrop={handleDrop}
                        >
                             {getBidsForColumn(activeCategory.id, 'contacted').map(bid => (
                                 <BidCard 
                                     key={bid.id} 
                                     bid={bid} 
                                     onDragStart={handleDragStart} 
                                     onEdit={setEditingBid}
                                     onGenerateInquiry={handleGenerateInquiry}
                                     category={activeCategory}
                                 />
                             ))}
                             {getBidsForColumn(activeCategory.id, 'contacted').length === 0 && (
                                 <div className="text-center p-4 text-slate-400 text-sm italic">Žádní dodavatelé v této fázi</div>
                             )}
                        </Column>

                        {/* 2. Odesláno (Sent) */}
                        <Column 
                            title="Odesláno" 
                            status="sent"
                            color="blue" 
                            count={getBidsForColumn(activeCategory.id, 'sent').length}
                            onDrop={handleDrop}
                        >
                             {getBidsForColumn(activeCategory.id, 'sent').map(bid => (
                                 <BidCard key={bid.id} bid={bid} onDragStart={handleDragStart} onEdit={setEditingBid} />
                             ))}
                             {getBidsForColumn(activeCategory.id, 'sent').length === 0 && (
                                 <div className="text-center p-4 text-slate-400 text-sm italic">Žádní dodavatelé v této fázi</div>
                             )}
                        </Column>

                        {/* 3. Cenová nabídka (Offers) */}
                        <Column 
                            title="Cenová nabídka" 
                            status="offer"
                            color="amber" 
                            count={getBidsForColumn(activeCategory.id, 'offer').length}
                            onDrop={handleDrop}
                        >
                            {getBidsForColumn(activeCategory.id, 'offer').map(bid => (
                                 <BidCard key={bid.id} bid={bid} onDragStart={handleDragStart} onEdit={setEditingBid} />
                             ))}
                        </Column>

                        {/* 4. Užší výběr (Shortlist) */}
                         <Column 
                            title="Užší výběr" 
                            status="shortlist"
                            color="blue" 
                            count={getBidsForColumn(activeCategory.id, 'shortlist').length}
                            onDrop={handleDrop}
                        >
                            {getBidsForColumn(activeCategory.id, 'shortlist').map(bid => (
                                 <BidCard key={bid.id} bid={bid} onDragStart={handleDragStart} onEdit={setEditingBid} />
                             ))}
                        </Column>

                        {/* 5. Jednání o SOD (Contract Negotiation) */}
                        <Column 
                            title="Jednání o SOD" 
                            status="sod"
                            color="green" 
                            count={getBidsForColumn(activeCategory.id, 'sod').length}
                            onDrop={handleDrop}
                        >
                            {getBidsForColumn(activeCategory.id, 'sod').map(bid => (
                                 <div key={bid.id} className="relative">
                                    <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 rounded-full p-1 z-10 shadow-sm pointer-events-none">
                                        <span className="material-symbols-outlined text-[16px] block">trophy</span>
                                    </div>
                                    <BidCard bid={bid} onDragStart={handleDragStart} onEdit={setEditingBid} />
                                 </div>
                             ))}
                        </Column>
                        
                         {/* 6. Zamítnuto (Rejected) */}
                         <Column 
                            title="Zamítnuto / Odstoupili" 
                            status="rejected"
                            color="red"
                            onDrop={handleDrop}
                        >
                              {getBidsForColumn(activeCategory.id, 'rejected').map(bid => (
                                  <BidCard key={bid.id} bid={bid} onDragStart={handleDragStart} onEdit={setEditingBid} />
                              ))}
                         </Column>
                    </div>
                </div>

                {isSubcontractorModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className={`bg-white dark:bg-slate-900 shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col transition-all duration-200 ${
                            isSubcontractorModalMaximized 
                                ? 'fixed inset-0 rounded-none w-full h-full' 
                                : 'rounded-2xl max-w-4xl w-full h-[80vh]'
                        }`}>
                            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                    Vybrat subdodavatele
                                </h3>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setIsSubcontractorModalMaximized(!isSubcontractorModalMaximized)} 
                                        className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        title={isSubcontractorModalMaximized ? "Obnovit velikost" : "Zvětšit na celou obrazovku"}
                                    >
                                        <span className="material-symbols-outlined">
                                            {isSubcontractorModalMaximized ? 'close_fullscreen' : 'fullscreen'}
                                        </span>
                                    </button>
                                    <button onClick={() => setIsSubcontractorModalOpen(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-hidden p-6 flex flex-col min-h-0">
                                <SubcontractorSelector 
                                    contacts={localContacts}
                                    statuses={DEFAULT_STATUSES}
                                    selectedIds={selectedSubcontractorIds}
                                    onSelectionChange={setSelectedSubcontractorIds}
                                    onAddContact={handleCreateContactRequest}
                                    className="flex-1 min-h-0"
                                />
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                                <div className="text-sm text-slate-500">
                                    Vybráno: <span className="font-bold text-slate-900 dark:text-white">{selectedSubcontractorIds.size}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setIsSubcontractorModalOpen(false)}
                                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                                    >
                                        Zrušit
                                    </button>
                                    <button 
                                        onClick={handleAddSubcontractors}
                                        disabled={selectedSubcontractorIds.size === 0}
                                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Přenést do pipeline
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Create Contact Modal */}
                {isCreateContactModalOpen && (
                    <CreateContactModal 
                        initialName={newContactName}
                        onClose={() => setIsCreateContactModalOpen(false)}
                        onSave={handleSaveNewContact}
                    />
                )}

                {/* Edit Bid Modal */}
                {editingBid && (
                    <EditBidModal 
                        bid={editingBid} 
                        onClose={() => setEditingBid(null)} 
                        onSave={handleSaveBid} 
                    />
                )}
            </div>
        );
    }

    // --- LIST VIEW (OVERVIEW) ---
    return (
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
            <Header title={`Stavba: ${projectData.title}`} subtitle="Přehled poptávek a subdodávek">
                 <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors"
                >
                    <span className="material-symbols-outlined text-[20px]">add_home_work</span>
                    <span className="hidden sm:inline">Nová Poptávka</span>
                </button>
            </Header>

            <div className="p-6 lg:p-10 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {projectData.categories.map((category) => (
                        <CategoryCard 
                            key={category.id} 
                            category={category} 
                            onClick={() => setActiveCategory(category)}
                            onEdit={handleEditCategoryClick}
                            onDelete={handleDeleteCategory}
                        />
                    ))}
                    
                    {/* Add New Placeholder */}
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[200px] group"
                    >
                        <div className="size-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-slate-500 dark:text-slate-400">add</span>
                        </div>
                        <h3 className="text-base font-bold text-slate-600 dark:text-slate-400">Vytvořit novou sekci</h3>
                        <p className="text-xs text-slate-400 mt-1">Např. Klempířské práce</p>
                    </button>
                </div>
            </div>

            {/* Create Category Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                Nová Poptávka / Sekce
                            </h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        
                        <form onSubmit={handleCreateCategory} className="flex flex-col">
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Název sekce *</label>
                                    <input 
                                        required
                                        type="text" 
                                        value={newCategoryForm.title} 
                                        onChange={e => setNewCategoryForm({...newCategoryForm, title: e.target.value})}
                                        className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                        placeholder="Např. Klempířské konstrukce"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Cena SOD (Investor)</label>
                                        <input 
                                            type="number" 
                                            value={newCategoryForm.sodBudget} 
                                            onChange={e => setNewCategoryForm({...newCategoryForm, sodBudget: e.target.value})}
                                            className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                            placeholder="500000"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Interní Plán</label>
                                        <input 
                                            type="number" 
                                            value={newCategoryForm.planBudget} 
                                            onChange={e => setNewCategoryForm({...newCategoryForm, planBudget: e.target.value})}
                                            className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                            placeholder="450000"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Popis prací</label>
                                    <textarea 
                                        rows={4}
                                        value={newCategoryForm.description} 
                                        onChange={e => setNewCategoryForm({...newCategoryForm, description: e.target.value})}
                                        className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white resize-none"
                                        placeholder="Detailní popis požadovaných prací..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Termín poptávky</label>
                                    <input 
                                        type="date"
                                        value={newCategoryForm.deadline} 
                                        onChange={e => setNewCategoryForm({...newCategoryForm, deadline: e.target.value})}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Termín pro podání cenové nabídky</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Dokumenty</label>
                                    <div className="flex flex-col gap-3">
                                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                            <div className="flex flex-col items-center justify-center">
                                                <span className="material-symbols-outlined text-slate-400 text-[28px] mb-1">upload_file</span>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Klikněte pro výběr souborů</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">PDF, Word, Excel, obrázky (max 10MB)</p>
                                            </div>
                                            <input 
                                                type="file" 
                                                multiple
                                                className="hidden" 
                                                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                                                onChange={(e) => {
                                                    if (e.target.files) {
                                                        const newFiles = Array.from(e.target.files).filter((f: File) => f.size <= 10 * 1024 * 1024);
                                                        if (newFiles.length < e.target.files.length) {
                                                            alert('Některé soubory překročily limit 10MB a nebyly přidány.');
                                                        }
                                                        setSelectedFiles(prev => [...prev, ...newFiles]);
                                                    }
                                                }}
                                            />
                                        </label>
                                        {selectedFiles.length > 0 && (
                                            <div className="space-y-2">
                                                {selectedFiles.map((file, index) => (
                                                    <div key={index} className="flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2">
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <span className="material-symbols-outlined text-slate-400 text-[18px]">description</span>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{file.name}</p>
                                                                <p className="text-[10px] text-slate-400">{formatFileSize(file.size)}</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                                                            className="text-slate-400 hover:text-red-500 transition-colors ml-2"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">close</span>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                                <button 
                                    type="button" 
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                                >
                                    Zrušit
                                </button>
                                <button 
                                    type="submit"
                                    disabled={uploadingFiles}
                                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {uploadingFiles && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
                                    {uploadingFiles ? 'Nahrávání...' : 'Vytvořit poptávku'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Category Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                Upravit Poptávku
                            </h3>
                            <button onClick={() => {setIsEditModalOpen(false); setEditingCategory(null);}} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        
                        <form onSubmit={handleEditCategory} className="flex flex-col">
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Název sekce *</label>
                                    <input 
                                        required
                                        type="text" 
                                        value={newCategoryForm.title} 
                                        onChange={e => setNewCategoryForm({...newCategoryForm, title: e.target.value})}
                                        className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                        placeholder="Např. Klempířské konstrukce"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Cena SOD (Investor)</label>
                                        <input 
                                            type="number" 
                                            value={newCategoryForm.sodBudget} 
                                            onChange={e => setNewCategoryForm({...newCategoryForm, sodBudget: e.target.value})}
                                            className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                            placeholder="500000"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Interní Plán</label>
                                        <input 
                                            type="number" 
                                            value={newCategoryForm.planBudget} 
                                            onChange={e => setNewCategoryForm({...newCategoryForm, planBudget: e.target.value})}
                                            className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                            placeholder="450000"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Popis prací</label>
                                    <textarea 
                                        rows={4}
                                        value={newCategoryForm.description} 
                                        onChange={e => setNewCategoryForm({...newCategoryForm, description: e.target.value})}
                                        className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white resize-none"
                                        placeholder="Detailní popis požadovaných prací..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Termín poptávky</label>
                                    <input 
                                        type="date"
                                        value={newCategoryForm.deadline} 
                                        onChange={e => setNewCategoryForm({...newCategoryForm, deadline: e.target.value})}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Termín pro podání cenové nabídky</p>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                                <button 
                                    type="button"
                                    onClick={() => {setIsEditModalOpen(false); setEditingCategory(null);}}
                                    className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                                >
                                    Zrušit
                                </button>
                                <button 
                                    type="submit"
                                    disabled={uploadingFiles}
                                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {uploadingFiles && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
                                    {uploadingFiles ? 'Ukládání...' : 'Uložit změny'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
