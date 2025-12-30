import React, { useState, useEffect } from 'react';
import { userManagementService, WhitelistedEmail } from '../services/userManagementService';

interface EmailWhitelistManagementProps {
    isAdmin: boolean;
}

export const EmailWhitelistManagement: React.FC<EmailWhitelistManagementProps> = ({ isAdmin }) => {
    const [whitelist, setWhitelist] = useState<WhitelistedEmail[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newEmail, setNewEmail] = useState('');
    const [newName, setNewName] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [domainFilter, setDomainFilter] = useState('');

    useEffect(() => {
        if (isAdmin) {
            loadWhitelist();
        }
    }, [isAdmin]);

    const loadWhitelist = async () => {
        setIsLoading(true);
        try {
            const data = await userManagementService.getWhitelistedEmails();
            setWhitelist(data);
        } catch (error) {
            console.error('Failed to load whitelist:', error);
            // Don't alert on load, just log
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail || !newEmail.includes('@')) {
            alert('Zadejte platný email');
            return;
        }

        setIsAdding(true);
        try {
            await userManagementService.addWhitelistedEmail(newEmail, newName, newNotes);
            setNewEmail('');
            setNewName('');
            setNewNotes('');
            await loadWhitelist();
        } catch (error: any) {
            console.error('Failed to add email:', error);
            alert(`Chyba: ${error.message || 'Nepodařilo se přidat email'}`);
        } finally {
            setIsAdding(false);
        }
    };

    const handleDelete = async (id: string, email: string) => {
        if (!confirm(`Opravdu chcete odebrat ${email} ze seznamu povolených?`)) return;

        try {
            await userManagementService.removeWhitelistedEmail(id);
            setWhitelist(prev => prev.filter(item => item.id !== id));
        } catch (error) {
            console.error('Failed to remove email:', error);
            alert('Nepodařilo se odebrat email');
        }
    };

    const handleToggle = async (id: string, currentStatus: boolean) => {
        try {
            await userManagementService.toggleWhitelistedEmail(id, !currentStatus);
            setWhitelist(prev => prev.map(item => 
                item.id === id ? { ...item, is_active: !currentStatus } : item
            ));
        } catch (error) {
            console.error('Failed to toggle status:', error);
            alert('Nepodařilo se změnit stav');
        }
    };

    // Filter logic
    const uniqueDomains = Array.from(new Set(whitelist.map(w => w.domain))).sort();
    
    const filteredList = whitelist.filter(item => {
        if (domainFilter && item.domain !== domainFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return item.email.toLowerCase().includes(q) || 
                   (item.display_name && item.display_name.toLowerCase().includes(q));
        }
        return true;
    });

    if (!isAdmin) return null;

    return (
        <section className="bg-white dark:bg-gradient-to-br dark:from-slate-900/80 dark:to-slate-950/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl mb-8">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">playlist_add_check</span>
                Seznam povolených emailů (Whitelist)
                <span className="ml-2 px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/30">
                    Admin
                </span>
            </h2>

            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Pokud je zapnuta volba "Vyžadovat whitelist", mohou se registrovat POUZE emaily uvedené v tomto seznamu. 
                Seznam je seskupen podle domén.
            </p>

            {/* Add New Email Form */}
            <form onSubmit={handleAdd} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 mb-6">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Přidat nový email</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-1">
                        <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="email@firma.cz"
                            className="w-full rounded-lg bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600/50 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none"
                            required
                        />
                    </div>
                    <div className="md:col-span-1">
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Jméno (nepovinné)"
                            className="w-full rounded-lg bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600/50 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none"
                        />
                    </div>
                    <div className="md:col-span-1">
                        <input
                            type="text"
                            value={newNotes}
                            onChange={(e) => setNewNotes(e.target.value)}
                            placeholder="Poznámka (nepovinné)"
                            className="w-full rounded-lg bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600/50 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none"
                        />
                    </div>
                    <div className="md:col-span-1">
                        <button
                            type="submit"
                            disabled={isAdding}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isAdding ? (
                                <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                            ) : (
                                <span className="material-symbols-outlined text-[18px]">add</span>
                            )}
                            Přidat
                        </button>
                    </div>
                </div>
            </form>

            {/* Filter */}
            <div className="flex flex-wrap gap-3 mb-4">
                <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-[20px]">
                            search
                        </span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Hledat email..."
                            className="w-full rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 pl-10 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none"
                        />
                    </div>
                </div>
                <div className="w-[180px]">
                    <select
                        value={domainFilter}
                        onChange={(e) => setDomainFilter(e.target.value)}
                        className="w-full rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                    >
                        <option value="">Všechny domény</option>
                        {uniqueDomains.map(d => (
                            <option key={d} value={d}>@{d}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="flex justify-center py-8">
                    <span className="material-symbols-outlined animate-spin text-slate-400 text-[32px]">sync</span>
                </div>
            ) : filteredList.length === 0 ? (
                <div className="text-center py-8 text-slate-500 italic bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                    Seznam je prázdný
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700/50">
                                <th className="text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2">Status</th>
                                <th className="text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2">Email</th>
                                <th className="text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2">Jméno</th>
                                <th className="text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2">Poznámka</th>
                                <th className="text-right text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2">Akce</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredList.map(item => (
                                <tr key={item.id} className="border-b border-slate-200 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="py-3 px-2">
                                        <button
                                            onClick={() => handleToggle(item.id, item.is_active)}
                                            className={`size-6 rounded flex items-center justify-center transition-colors ${
                                                item.is_active 
                                                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30'
                                                    : 'bg-slate-200 dark:bg-slate-700/50 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-700'
                                            }`}
                                            title={item.is_active ? 'Aktivní' : 'Neaktivní'}
                                        >
                                            <span className="material-symbols-outlined text-[16px]">
                                                {item.is_active ? 'check' : 'block'}
                                            </span>
                                        </button>
                                    </td>
                                    <td className="py-3 px-2">
                                        <div className="flex flex-col">
                                            <span className={`text-sm ${item.is_active ? 'text-slate-900 dark:text-white' : 'text-slate-500 line-through'}`}>
                                                {item.email}
                                            </span>
                                            <span className="text-[10px] text-slate-500">@{item.domain}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-2 text-sm text-slate-700 dark:text-slate-300">
                                        {item.display_name || '-'}
                                    </td>
                                    <td className="py-3 px-2 text-sm text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
                                        {item.notes || '-'}
                                    </td>
                                    <td className="py-3 px-2 text-right">
                                        <button
                                            onClick={() => handleDelete(item.id, item.email)}
                                            className="text-slate-500 hover:text-red-400 transition-colors p-1"
                                            title="Odebrat"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};
