
import React, { useState } from 'react';
import { Header } from './Header';
import { Project, ProjectStatus, StatusConfig, Subcontractor } from '../types';

interface SettingsProps {
    darkMode: boolean;
    onToggleDarkMode: () => void;
    projects: Project[];
    onAddProject: (project: Project) => void;
    onDeleteProject: (id: string) => void;
    onArchiveProject: (id: string) => void;
    contactStatuses: StatusConfig[];
    onUpdateStatuses: (statuses: StatusConfig[]) => void;
    onImportContacts: (contacts: Subcontractor[]) => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
    darkMode, 
    onToggleDarkMode, 
    projects, 
    onAddProject, 
    onDeleteProject,
    onArchiveProject,
    contactStatuses,
    onUpdateStatuses,
    onImportContacts
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
                    specialization: cols[2] || 'Ostatní',
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

    const handleConfirmImport = () => {
        if (importedContacts.length > 0) {
            onImportContacts(importedContacts);
            setImportedContacts([]);
            setFileName('');
        }
    };

    return (
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-y-auto">
            <Header title="Nastavení" subtitle="Konfigurace aplikace a správa staveb" />

            <div className="p-6 lg:p-10 max-w-4xl mx-auto w-full flex flex-col gap-8 pb-20">
                
                {/* 1. Appearance Section */}
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined">palette</span>
                        Vzhled aplikace
                    </h2>
                    <div className="flex items-center justify-between">
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
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined">upload_file</span>
                        Import Kontaktů
                    </h2>
                    
                    <div className="flex flex-col gap-4">
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
                            
                            {importedContacts.length > 0 && (
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
