
import React, { useState } from 'react';
import { Header } from './Header';
import { Project, ProjectStatus, StatusConfig, Subcontractor } from '../types';

interface SettingsProps {
    darkMode: boolean;
    onToggleDarkMode: () => void;
    primaryColor: string;
    onSetPrimaryColor: (color: string) => void;
    backgroundColor: string;
    onSetBackgroundColor: (color: string) => void;
    projects: Project[];
    onAddProject: (project: Project) => void;
    onDeleteProject: (id: string) => void;
    onArchiveProject: (id: string) => void;
    contactStatuses: StatusConfig[];
    onUpdateStatuses: (statuses: StatusConfig[]) => void;
    onImportContacts: (contacts: Subcontractor[], onProgress?: (percent: number) => void) => Promise<void>;
    onSyncContacts: (url: string, onProgress?: (percent: number) => void) => Promise<void>;
    onDeleteContacts: (ids: string[]) => void;
    contacts: Subcontractor[];
    isAdmin?: boolean;
    onSaveSettings: () => void;
    user?: any; // Add user prop for debug
}

export const Settings: React.FC<SettingsProps> = ({ 
    darkMode, 
    onToggleDarkMode,
    primaryColor,
    onSetPrimaryColor,
    backgroundColor,
    onSetBackgroundColor,
    projects, 
    onAddProject, 
    onDeleteProject,
    onArchiveProject,
    contactStatuses,
    onUpdateStatuses,
    onImportContacts,
    onSyncContacts,
    onDeleteContacts,
    contacts,
    isAdmin = false,
    onSaveSettings,
    user
}) => {
    // Project Form State
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectLocation, setNewProjectLocation] = useState('');
    const [newProjectStatus, setNewProjectStatus] = useState<ProjectStatus>('tender');

    // Status Form State
    const [newStatusLabel, setNewStatusLabel] = useState('');
    const [newStatusColor, setNewStatusColor] = useState<StatusConfig['color']>('blue');

    // Import State
    const [importedContacts, setImportedContacts] = useState<Subcontractor[]>([]);
    const [fileName, setFileName] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    
    // Auto-Sync State
    const [importUrl, setImportUrl] = useState(() => localStorage.getItem('contactsImportUrl') || '');
    const [lastSyncTime, setLastSyncTime] = useState(() => localStorage.getItem('contactsLastSyncTime') || '');
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSaveUrl = () => {
        if (importUrl) {
            localStorage.setItem('contactsImportUrl', importUrl);
            alert('URL uložena.');
        }
    };

    const handleSyncNow = async () => {
        if (!importUrl) {
            alert('Prosím zadejte URL souboru.');
            return;
        }
        
        setIsSyncing(true);
        setUploadProgress(0);
        try {
            await onSyncContacts(importUrl, (p) => setUploadProgress(p));
            const now = new Date().toLocaleString('cs-CZ');
            setLastSyncTime(now);
            localStorage.setItem('contactsLastSyncTime', now);
        } catch (error) {
            console.error('Sync failed:', error);
        } finally {
            setIsSyncing(false);
            setUploadProgress(0);
        }
    };

    const handleDeleteAllContacts = () => {
        if (contacts.length === 0) {
            alert('Databáze kontaktů je již prázdná.');
            return;
        }

        if (confirm(`VAROVÁNÍ: Opravdu chcete smazat VŠECHNY kontakty (${contacts.length}) z databáze? Tuto akci nelze vrátit zpět!`)) {
            if (confirm('Opravdu? Jste si naprosto jistí?')) {
                const allIds = contacts.map(c => c.id);
                onDeleteContacts(allIds);
            }
        }
    };

    const handleCreateProject = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProjectName || !newProjectLocation) return;

        const newProject: Project = {
            id: `p${Date.now()}`,
            name: newProjectName,
            location: newProjectLocation,
            status: newProjectStatus
        };

        onAddProject(newProject);
        setNewProjectName('');
        setNewProjectLocation('');
    };

    const handleAddStatus = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newStatusLabel) return;
        
        const id = newStatusLabel.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now().toString().slice(-4);
        
        const newStatus: StatusConfig = {
            id,
            label: newStatusLabel,
            color: newStatusColor
        };

        onUpdateStatuses([...contactStatuses, newStatus]);
        setNewStatusLabel('');
    };

    const handleDeleteStatus = (id: string) => {
        if (confirm('Opravdu smazat tento status? Kontakty s tímto statusem budou muset být přeřazeny.')) {
            onUpdateStatuses(contactStatuses.filter(s => s.id !== id));
        }
    };

    const handleUpdateStatusLabel = (id: string, newLabel: string) => {
         onUpdateStatuses(contactStatuses.map(s => s.id === id ? { ...s, label: newLabel } : s));
    };
    
    const handleUpdateStatusColor = (id: string, newColor: StatusConfig['color']) => {
         onUpdateStatuses(contactStatuses.map(s => s.id === id ? { ...s, color: newColor } : s));
    };

    const colorOptions: { value: StatusConfig['color'], class: string }[] = [
        { value: 'green', class: 'bg-green-500' },
        { value: 'blue', class: 'bg-blue-500' },
        { value: 'red', class: 'bg-red-500' },
        { value: 'yellow', class: 'bg-yellow-500' },
        { value: 'purple', class: 'bg-purple-500' },
        { value: 'slate', class: 'bg-slate-500' },
    ];

    const themeColors = [
        '#607AFB', // Default Blue
        '#3B82F6', // Vivid Blue
        '#10B981', // Emerald
        '#F59E0B', // Amber
        '#EF4444', // Red
        '#8B5CF6', // Violet
        '#EC4899', // Pink
        '#6366F1', // Indigo
    ];

    const backgroundColors = [
        { label: 'Výchozí', color: '#f5f6f8' },
        { label: 'Čistá bílá', color: '#ffffff' },
        { label: 'Teplá', color: '#fbf7f1' },
        { label: 'Studená', color: '#f0f9ff' },
    ];

    // Import Logic
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setFileName(file.name);
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                parseCSV(text);
            };
            reader.readAsText(file);
        }
    };

    const parseCSV = (csvText: string) => {
        // Simple CSV parser
        // Assumes format: Firma, Jméno, Specializace, Telefon, Email, IČO, Region
        const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);
        const parsed: Subcontractor[] = [];

        // Skip header if it looks like one
        const startIndex = lines[0].toLowerCase().includes('firma') ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
            // Handle basic comma or semicolon separation
            const separator = lines[i].includes(';') ? ';' : ',';
            const cols = lines[i].split(separator).map(c => c.trim());
            
            if (cols.length >= 3) {
                parsed.push({
                    id: `imp_${Date.now()}_${i}`,
                    company: cols[0] || 'Neznámá firma',
                    name: cols[1] || '-',
                    specialization: [cols[2] || 'Ostatní'], // Changed to array
                    phone: cols[3] || '-',
                    email: cols[4] || '-',
                    ico: cols[5] || '-',
                    region: cols[6] || '-',
                    status: 'available' // Default status
                });
            }
        }
        setImportedContacts(parsed);
    };

    const handleConfirmImport = async () => {
        if (importedContacts.length > 0) {
            setIsUploading(true);
            setUploadProgress(0);
            try {
                await onImportContacts(importedContacts, (percent) => setUploadProgress(percent));
                setImportedContacts([]);
                setFileName('');
            } catch (error) {
                console.error("Import failed", error);
            } finally {
                setIsUploading(false);
                setUploadProgress(0);
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-y-auto">
            <Header title="Nastavení" subtitle="Konfigurace aplikace a správa staveb" />

            <div className="p-6 lg:p-10 max-w-4xl mx-auto w-full flex flex-col gap-8 pb-20">
                
                {/* Debug Info */}
                {isAdmin && (
                    <div className="bg-slate-800 text-green-400 p-4 rounded-lg font-mono text-xs overflow-auto">
                        <h3 className="font-bold text-white mb-2">Debug Info</h3>
                        <pre>{JSON.stringify({ 
                            darkMode, 
                            primaryColor, 
                            backgroundColor,
                            userPreferences: user?.preferences
                        }, null, 2)}</pre>
                        <p className="mt-2 text-white">Check console for full logs.</p>
                    </div>
                )}

                {/* 1. Appearance Section */}
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined">palette</span>
                        Vzhled aplikace
                    </h2>
                    
                    <div className="space-y-6">
                        {/* Dark Mode Toggle */}
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <p className="text-sm font-medium text-slate-800 dark:text-white">Tmavý režim</p>
                                <p className="text-xs text-slate-500">Přepnout mezi světlým a tmavým motivem.</p>
                            </div>
                            <button 
                                onClick={onToggleDarkMode}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${darkMode ? 'bg-primary' : 'bg-slate-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* Color Theme */}
                        <div className="flex flex-col gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-medium text-slate-800 dark:text-white">Barevné schéma</p>
                                    <p className="text-xs text-slate-500">Vyberte hlavní barvu aplikace (Brand Color).</p>
                                </div>
                                <div className="flex flex-wrap gap-3 items-center">
                                    {themeColors.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => onSetPrimaryColor(color)}
                                            className={`size-8 rounded-full transition-all shadow-sm ${primaryColor === color ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500 scale-110' : 'hover:scale-105'}`}
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        />
                                    ))}
                                    <div className="relative flex items-center">
                                        <label htmlFor="custom-color" className="cursor-pointer size-8 rounded-full bg-gradient-to-tr from-white to-slate-200 border border-slate-300 flex items-center justify-center hover:scale-105 transition-transform" title="Vlastní barva">
                                            <span className="material-symbols-outlined text-[16px] text-slate-600">colorize</span>
                                        </label>
                                        <input 
                                            id="custom-color"
                                            type="color" 
                                            value={primaryColor}
                                            onChange={(e) => onSetPrimaryColor(e.target.value)}
                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Background Color */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-slate-800 dark:text-white">Barva pozadí</p>
                                <p className="text-xs text-slate-500">Vyberte barvu podkladu aplikace (pouze pro světlý režim).</p>
                            </div>
                            <div className="flex flex-wrap gap-3 items-center">
                                {backgroundColors.map(bg => (
                                    <button
                                        key={bg.color}
                                        onClick={() => onSetBackgroundColor(bg.color)}
                                        className={`size-8 rounded-full transition-all shadow-sm border border-slate-200 ${backgroundColor === bg.color ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500 scale-110' : 'hover:scale-105'}`}
                                        style={{ backgroundColor: bg.color }}
                                        title={bg.label}
                                    />
                                ))}
                                <div className="relative flex items-center">
                                    <label htmlFor="custom-bg" className="cursor-pointer size-8 rounded-full bg-white border border-slate-300 flex items-center justify-center hover:scale-105 transition-transform" title="Vlastní pozadí">
                                        <span className="material-symbols-outlined text-[16px] text-slate-600">format_paint</span>
                                    </label>
                                    <input 
                                        id="custom-bg"
                                        type="color" 
                                        value={backgroundColor}
                                        onChange={(e) => onSetBackgroundColor(e.target.value)}
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-6 flex justify-end border-t border-slate-100 dark:border-slate-800 pt-4">
                        <button 
                            onClick={onSaveSettings}
                            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-lg font-bold shadow-sm transition-all hover:scale-105 active:scale-95"
                        >
                            <span className="material-symbols-outlined">save</span>
                            Uložit nastavení vzhledu
                        </button>
                    </div>
                </section>

                {/* 2. Subcontractor Status Management */}
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined">label</span>
                        Správa stavů kontaktů
                    </h2>
                    
                    {/* Add Status */}
                    <form onSubmit={handleAddStatus} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700 mb-6 flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-xs text-slate-500 mb-1">Název stavu</label>
                            <input 
                                type="text" 
                                value={newStatusLabel}
                                onChange={(e) => setNewStatusLabel(e.target.value)}
                                placeholder="Např. Dovolená" 
                                className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <div className="w-full md:w-auto">
                            <label className="block text-xs text-slate-500 mb-1">Barva</label>
                            <div className="flex gap-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 h-[38px] items-center">
                                {colorOptions.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setNewStatusColor(opt.value)}
                                        className={`size-6 rounded-full ${opt.class} ${newStatusColor === opt.value ? 'ring-2 ring-offset-1 ring-slate-400 dark:ring-slate-500 scale-110' : 'opacity-70 hover:opacity-100'}`}
                                        title={opt.value}
                                    />
                                ))}
                            </div>
                        </div>
                        <button 
                            type="submit" 
                            disabled={!newStatusLabel}
                            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 h-[38px] rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
                        >
                            Přidat
                        </button>
                    </form>

                    {/* Status List */}
                    <div className="space-y-3">
                        {contactStatuses.map(status => (
                            <div key={status.id} className="flex items-center gap-4 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <div className="flex gap-1.5 items-center bg-slate-100 dark:bg-slate-800 rounded px-2 py-1">
                                    {colorOptions.map(opt => (
                                         <button
                                            key={opt.value}
                                            onClick={() => handleUpdateStatusColor(status.id, opt.value)}
                                            className={`size-4 rounded-full ${opt.class} ${status.color === opt.value ? 'ring-2 ring-offset-1 ring-white dark:ring-slate-900' : 'opacity-40 hover:opacity-100'}`}
                                        />
                                    ))}
                                </div>
                                <div className="flex-1">
                                     <input 
                                        type="text" 
                                        value={status.label}
                                        onChange={(e) => handleUpdateStatusLabel(status.id, e.target.value)}
                                        className="bg-transparent border-none p-0 text-sm font-medium text-slate-900 dark:text-white focus:ring-0 w-full"
                                    />
                                </div>
                                <button 
                                    onClick={() => handleDeleteStatus(status.id)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                    title="Smazat stav"
                                >
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 3. Import Data Section */}
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined">upload_file</span>
                            Import Kontaktů
                        </h2>
                        {isAdmin && (
                            <button 
                                onClick={handleDeleteAllContacts}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                title="Smazat všechny kontakty z databáze"
                            >
                                <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                                Smazat vše
                            </button>
                        )}
                    </div>
                    
                    {/* Auto-Sync from URL */}
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3 mb-4">
                            <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">sync</span>
                            <div className="flex-1">
                                <h3 className="text-sm font-bold text-purple-900 dark:text-purple-100 mb-1">Synchronizace kontaktů z URL</h3>
                                <p className="text-xs text-purple-700 dark:text-purple-300 mb-3">
                                    Zadejte odkaz na CSV/XLSX soubor (např. Google Sheets export link). 
                                    Synchronizaci spustíte tlačítkem níže.
                                </p>
                                
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs text-purple-700 dark:text-purple-300 mb-1 font-medium">URL souboru</label>
                                        <input 
                                            type="url"
                                            value={importUrl}
                                            onChange={(e) => setImportUrl(e.target.value)}
                                            placeholder="https://docs.google.com/spreadsheets/.../export?format=csv"
                                            className="w-full rounded-lg bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-purple-500 focus:border-purple-500"
                                        />
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <button 
                                            type="button"
                                            onClick={handleSaveUrl}
                                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm"
                                        >
                                            Uložit URL
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={handleSyncNow}
                                            disabled={isSyncing || !importUrl}
                                            className="bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="flex items-center gap-2">
                                                <span className={`material-symbols-outlined text-[18px] ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
                                                {isSyncing ? 'Synchronizuji...' : 'Synchronizovat nyní'}
                                            </span>
                                        </button>
                                    </div>
                                    
                                    {isSyncing && (
                                        <div className="flex items-center gap-4 mt-2">
                                            <div className="flex-1 h-2 bg-purple-200 dark:bg-purple-900/50 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-purple-600 transition-all duration-300 ease-out"
                                                    style={{ width: `${uploadProgress}%` }}
                                                />
                                            </div>
                                            <span className="text-sm font-bold text-purple-700 dark:text-purple-300 whitespace-nowrap">
                                                {uploadProgress}%
                                            </span>
                                        </div>
                                    )}

                                    <p className="text-xs text-purple-600 dark:text-purple-400 italic">
                                        💡 Poslední synchronizace: {lastSyncTime || 'Ještě nebyla provedena'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Manual File Upload */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <span className="material-symbols-outlined text-[20px]">info</span>
                            <span>Nebo nahrajte soubor jednorázově:</span>
                        </div>
                        
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Nahrajte CSV soubor pro hromadný import kontaktů. <br/>
                            <span className="text-xs italic">Formát: Firma, Jméno, Specializace, Telefon, Email, IČO, Region</span>
                        </p>
                        
                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                            <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700">
                                <span className="material-symbols-outlined">folder_open</span>
                                {fileName || 'Vybrat soubor CSV'}
                                <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                            </label>
                            
                            {importedContacts.length > 0 && !isUploading && (
                                <div className="flex items-center gap-4 flex-1">
                                    <span className="text-sm font-medium text-green-600">
                                        Nalezeno {importedContacts.length} kontaktů
                                    </span>
                                    <button 
                                        onClick={handleConfirmImport}
                                        className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm"
                                    >
                                        Importovat do databáze
                                    </button>
                                </div>
                            )}

                            {isUploading && (
                                <div className="flex-1 flex items-center gap-4">
                                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-primary transition-all duration-300 ease-out"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-bold text-primary whitespace-nowrap">
                                        {uploadProgress}%
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* 4. Project Management Section */}
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined">domain_add</span>
                        Správa Staveb
                    </h2>

                    {/* Add New Project Form */}
                    <form onSubmit={handleCreateProject} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700 mb-8">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">Přidat novou stavbu</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Název projektu</label>
                                <input 
                                    type="text" 
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    placeholder="Např. Rezidence Park" 
                                    className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-primary focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Lokace</label>
                                <input 
                                    type="text" 
                                    value={newProjectLocation}
                                    onChange={(e) => setNewProjectLocation(e.target.value)}
                                    placeholder="Např. Plzeň" 
                                    className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-primary focus:border-primary"
                                />
                            </div>
                             <div>
                                <label className="block text-xs text-slate-500 mb-1">Typ / Fáze</label>
                                <select 
                                    value={newProjectStatus}
                                    onChange={(e) => setNewProjectStatus(e.target.value as ProjectStatus)}
                                    className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-primary focus:border-primary"
                                >
                                    <option value="tender">Soutěž (Příprava)</option>
                                    <option value="realization">Realizace (Výstavba)</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button 
                                type="submit" 
                                disabled={!newProjectName || !newProjectLocation}
                                className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Vytvořit projekt
                            </button>
                        </div>
                    </form>

                    {/* Existing Projects List */}
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">Seznam projektů</h3>
                    <div className="space-y-3">
                        {projects.map(project => (
                            <div key={project.id} className={`flex items-center justify-between p-4 rounded-lg border ${project.status === 'archived' ? 'bg-slate-100 border-slate-200 dark:bg-slate-800/30 dark:border-slate-800 opacity-60' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`size-10 rounded-full flex items-center justify-center ${
                                        project.status === 'realization' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' : 
                                        project.status === 'tender' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' :
                                        'bg-slate-200 text-slate-500 dark:bg-slate-800'
                                    }`}>
                                        <span className="material-symbols-outlined">
                                            {project.status === 'realization' ? 'engineering' : project.status === 'tender' ? 'edit_document' : 'archive'}
                                        </span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">{project.name}</h4>
                                        <p className="text-xs text-slate-500">{project.location} • {
                                            project.status === 'realization' ? 'Realizace' : 
                                            project.status === 'tender' ? 'Soutěž' : 'Archivováno'
                                        }</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {project.status !== 'archived' && (
                                        <button 
                                            onClick={() => onArchiveProject(project.id)}
                                            className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-full transition-colors"
                                            title="Archivovat"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">archive</span>
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => onDeleteProject(project.id)}
                                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                        title="Odstranit"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {projects.length === 0 && (
                            <p className="text-center text-slate-500 italic py-4">Žádné projekty v databázi.</p>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};
