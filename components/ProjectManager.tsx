import React, { useState, useEffect } from 'react';
import { Project, ProjectStatus } from '../types';
import { Header } from './Header';
import { projectService } from '../services/projectService';
import { useAuth } from '../context/AuthContext';

interface ProjectManagerProps {
    projects: Project[];
    onAddProject: (project: Project) => void;
    onDeleteProject: (id: string) => void;
    onArchiveProject: (id: string) => void;
}

// Collapsible Archive Section Component
const ArchiveSection: React.FC<{
    projects: Project[];
    user: { id: string } | null;
    onRestoreProject: (id: string) => void;
    onDeleteProject: (id: string) => void;
    openShareModal: (id: string) => void;
}> = ({ projects, user, onRestoreProject, onDeleteProject, openShareModal }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <section className="bg-gradient-to-br from-slate-900/50 to-slate-950/50 backdrop-blur-xl border border-slate-700/30 rounded-2xl shadow-xl overflow-hidden">
            {/* Collapsible Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-slate-500">inventory_2</span>
                    <h2 className="text-base font-bold text-slate-400">Archiv</h2>
                    <span className="bg-slate-700/50 text-slate-500 text-xs px-2 py-0.5 rounded-lg">
                        {projects.length} {projects.length === 1 ? 'projekt' : projects.length < 5 ? 'projekty' : 'projektů'}
                    </span>
                </div>
                <span className={`material-symbols-outlined text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    expand_more
                </span>
            </button>

            {/* Collapsible Content */}
            {isExpanded && (
                <div className="p-4 pt-0 space-y-2">
                    {projects.map(project => (
                        <div key={project.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30 border border-slate-700/30 opacity-70 hover:opacity-100 transition-opacity">
                            <div className="flex items-center gap-3">
                                <div className="size-8 rounded-full bg-slate-700/50 text-slate-500 flex items-center justify-center text-sm font-bold">
                                    A
                                </div>
                                <div>
                                    <h4 className="font-medium text-slate-300 text-sm">{project.name}</h4>
                                    <p className="text-[10px] text-slate-600">{project.location}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                {/* Restore Button */}
                                <button
                                    onClick={() => onRestoreProject(project.id)}
                                    className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                    title="Obnovit projekt"
                                >
                                    <span className="material-symbols-outlined text-[18px]">unarchive</span>
                                </button>

                                {/* Delete Button - Only Owner */}
                                {(!project.ownerId || project.ownerId === user?.id) && (
                                    <button
                                        onClick={() => onDeleteProject(project.id)}
                                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                        title="Odstranit trvale"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
};

export const ProjectManager: React.FC<ProjectManagerProps> = ({
    projects,
    onAddProject,
    onDeleteProject,
    onArchiveProject
}) => {
    const { user } = useAuth();

    // Create Form State
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectLocation, setNewProjectLocation] = useState('');
    const [newProjectStatus, setNewProjectStatus] = useState<ProjectStatus>('tender');
    const [isCreating, setIsCreating] = useState(false);

    // Sharing State
    const [sharingProjectId, setSharingProjectId] = useState<string | null>(null);
    const [shareEmail, setShareEmail] = useState('');
    const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('edit');
    const [shares, setShares] = useState<{ user_id: string, email: string, permission: string }[]>([]);
    const [isLoadingShares, setIsLoadingShares] = useState(false);
    const [isSharing, setIsSharing] = useState(false);

    // Permission translation helper
    const getPermissionLabel = (permission: string) => {
        return permission === 'edit' ? 'Úpravy' : 'Pouze čtení';
    };

    // Drag & Drop State
    const [projectOrder, setProjectOrder] = useState<string[]>([]);
    const [draggedId, setDraggedId] = useState<string | null>(null);

    // Load order from localStorage on mount
    useEffect(() => {
        const savedOrder = localStorage.getItem('projectOrder');
        if (savedOrder) {
            try {
                setProjectOrder(JSON.parse(savedOrder));
            } catch {
                setProjectOrder([]);
            }
        }
    }, []);

    // Get ordered active projects
    const activeProjects = projects.filter(p => p.status !== 'archived');
    const orderedActiveProjects = [...activeProjects].sort((a, b) => {
        const aIndex = projectOrder.indexOf(a.id);
        const bIndex = projectOrder.indexOf(b.id);
        // Projects not in order go to the end
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
    });

    // Drag handlers
    const handleDragStart = (e: React.DragEvent, projectId: string) => {
        setDraggedId(projectId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedId || draggedId === targetId) {
            setDraggedId(null);
            return;
        }

        // Create new order
        const currentOrder = orderedActiveProjects.map(p => p.id);
        const draggedIndex = currentOrder.indexOf(draggedId);
        const targetIndex = currentOrder.indexOf(targetId);

        if (draggedIndex === -1 || targetIndex === -1) {
            setDraggedId(null);
            return;
        }

        // Remove dragged item and insert at target position
        currentOrder.splice(draggedIndex, 1);
        currentOrder.splice(targetIndex, 0, draggedId);

        // Save to state and localStorage
        setProjectOrder(currentOrder);
        localStorage.setItem('projectOrder', JSON.stringify(currentOrder));
        setDraggedId(null);
    };

    const handleDragEnd = () => {
        setDraggedId(null);
    };

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProjectName || !newProjectLocation) return;
        setIsCreating(true);

        const newProject: Project = {
            id: `p${Date.now()}`, // Temporary ID, service should likely handle real ID if DB gen
            name: newProjectName,
            location: newProjectLocation,
            status: newProjectStatus
            // Owner ID handled by service/backend
        };

        try {
            // Service call removed to avoid double insertion (App.tsx handles it via onAddProject)
            // await projectService.createProject(newProject);

            // We call onAddProject to update local state in App.tsx and persist
            onAddProject(newProject);

            setNewProjectName('');
            setNewProjectLocation('');
        } catch (error) {
            console.error('Error creating project:', error);
            alert('Chyba při vytváření projektu.');
        } finally {
            setIsCreating(false);
        }
    };

    const openShareModal = async (projectId: string) => {
        console.log('[ProjectManager] Opening share modal for project:', projectId);
        setSharingProjectId(projectId);
        setShareEmail('');
        setSharePermission('edit');
        setIsLoadingShares(true);
        try {
            console.log('[ProjectManager] Fetching shares...');
            const fetchedShares = await projectService.getProjectShares(projectId);
            console.log('[ProjectManager] Fetched shares:', fetchedShares);
            setShares(fetchedShares);
            if (fetchedShares.length === 0) {
                console.warn('[ProjectManager] No shares found for this project');
            }
        } catch (error) {
            console.error('[ProjectManager] Error loading shares:', error);
            alert(`Chyba při načítání sdílení: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
            setShares([]);
        } finally {
            setIsLoadingShares(false);
        }
    };

    const closeShareModal = () => {
        setSharingProjectId(null);
        setShares([]);
    };

    const handleShare = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sharingProjectId || !shareEmail) return;

        setIsSharing(true);
        try {
            await projectService.shareProject(sharingProjectId, shareEmail, sharePermission);
            // Refresh shares
            const fetchedShares = await projectService.getProjectShares(sharingProjectId);
            setShares(fetchedShares);
            setShareEmail('');
            setSharePermission('edit');
            alert('Projekt byl úspěšně nasdílen.');
        } catch (error: any) {
            console.error('Example share error:', error);
            alert(error.message || 'Chyba při sdílení.');
        } finally {
            setIsSharing(false);
        }
    };

    const handleRemoveShare = async (userId: string) => {
        if (!sharingProjectId || !confirm('Opravdu zrušit sdílení tomuto uživateli?')) return;

        try {
            await projectService.removeShare(sharingProjectId, userId);
            setShares(shares.filter(s => s.user_id !== userId));
        } catch (error) {
            console.error('Error removing share:', error);
            alert('Chyba při rušení sdílení.');
        }
    };

    const handleChangePermission = async (userId: string, newPermission: 'view' | 'edit') => {
        if (!sharingProjectId) return;

        try {
            await projectService.updateSharePermission(sharingProjectId, userId, newPermission);
            setShares(shares.map(s => 
                s.user_id === userId ? { ...s, permission: newPermission } : s
            ));
        } catch (error) {
            console.error('Error updating permission:', error);
            alert('Chyba při změně oprávnění.');
        }
    };

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-screen overflow-y-auto">
            <Header title="Správa Staveb" subtitle="Vytváření, archivace a sdílení projektů" />

            <div className="p-6 lg:p-10 max-w-5xl mx-auto w-full pb-20">

                {/* 1. Create New Project */}
                <section className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl mb-8">
                    <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-400">add_business</span>
                        Nová stavba
                    </h2>

                    <form onSubmit={handleCreateProject} className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Název projektu</label>
                                <input
                                    type="text"
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    placeholder="Např. Rezidence Park"
                                    className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Lokace</label>
                                <input
                                    type="text"
                                    value={newProjectLocation}
                                    onChange={(e) => setNewProjectLocation(e.target.value)}
                                    placeholder="Např. Plzeň"
                                    className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Typ / Fáze</label>
                                <select
                                    value={newProjectStatus}
                                    onChange={(e) => setNewProjectStatus(e.target.value as ProjectStatus)}
                                    className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                                >
                                    <option value="tender">Soutěž (Příprava)</option>
                                    <option value="realization">Realizace (Výstavba)</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={!newProjectName || !newProjectLocation || isCreating}
                                className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isCreating && <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>}
                                Vytvořit projekt
                            </button>
                        </div>
                    </form>
                </section>

                {/* 2. Active Project List */}
                <section className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl mb-8">
                    <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-400">list_alt</span>
                        Seznam vašich a sdílených staveb
                    </h2>

                    <div className="space-y-3">
                        {orderedActiveProjects.map(project => (
                            <div
                                key={project.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, project.id)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, project.id)}
                                onDragEnd={handleDragEnd}
                                className={`flex items-center justify-between p-4 rounded-xl border bg-slate-800/50 border-slate-700/50 cursor-move transition-all ${draggedId === project.id ? 'opacity-50 scale-[0.98]' : ''}`}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Drag Handle */}
                                    <span className="material-symbols-outlined text-slate-600 text-[20px] cursor-grab active:cursor-grabbing">
                                        drag_indicator
                                    </span>
                                    <div className={`size-10 rounded-full flex items-center justify-center text-lg font-bold ${project.status === 'realization' ? 'bg-amber-500/20 text-amber-400' :
                                        project.status === 'tender' ? 'bg-blue-500/20 text-blue-400' :
                                            'bg-slate-700/50 text-slate-500'
                                        }`}>
                                        {project.status === 'realization' ? 'R' : project.status === 'tender' ? 'S' : 'A'}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-white text-sm">{project.name}</h4>
                                            {/* Ownership Badges */}
                                            {project.ownerId && project.ownerId !== user?.id && (
                                                <span className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded-lg border border-blue-500/30">
                                                    Sdíleno od: {project.ownerEmail || 'Uživatel'}
                                                </span>
                                            )}
                                            {!project.ownerId && (
                                                <span className="bg-slate-700/50 text-slate-400 text-[10px] px-2 py-0.5 rounded-lg border border-slate-600/50">
                                                    Veřejné
                                                </span>
                                            )}
                                            {/* Shared WITH Badge (For Owners) */}
                                            {project.ownerId === user?.id && project.sharedWith && project.sharedWith.length > 0 && (
                                                <div
                                                    className="bg-violet-500/20 text-violet-400 text-[10px] px-2 py-0.5 rounded-lg border border-violet-500/30 hover:bg-violet-500/30 transition-colors cursor-pointer max-w-[200px] truncate"
                                                    onClick={(e) => { e.stopPropagation(); openShareModal(project.id); }}
                                                    title={`Sdíleno s: ${project.sharedWith.join(', ')}`}
                                                >
                                                    Sdíleno s: {project.sharedWith.join(', ')}
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500">{project.location} • {
                                            project.status === 'realization' ? 'Realizace' :
                                                project.status === 'tender' ? 'Soutěž' : 'Archivováno'
                                        }</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Share Button - Only Owner */}
                                    {(!project.ownerId || project.ownerId === user?.id) && (
                                        <button
                                            onClick={() => openShareModal(project.id)}
                                            className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors flex items-center gap-1"
                                            title="Sdílet projekt"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">share</span>
                                        </button>
                                    )}

                                    <button
                                        onClick={() => onArchiveProject(project.id)}
                                        className="p-2 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                                        title="Archivovat"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">archive</span>
                                    </button>

                                    {/* Delete Button - Only Owner */}
                                    {(!project.ownerId || project.ownerId === user?.id) && (
                                        <button
                                            onClick={() => onDeleteProject(project.id)}
                                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="Odstranit"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">delete</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {orderedActiveProjects.length === 0 && (
                            <p className="text-center text-slate-500 italic py-4">Žádné aktivní projekty.</p>
                        )}
                    </div>
                </section>

                {/* 3. Archive Section */}
                {projects.filter(p => p.status === 'archived').length > 0 && (
                    <ArchiveSection
                        projects={projects.filter(p => p.status === 'archived')}
                        user={user}
                        onRestoreProject={onArchiveProject}
                        onDeleteProject={onDeleteProject}
                        openShareModal={openShareModal}
                    />
                )}
            </div>

            {/* Sharing Modal */}
            {sharingProjectId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-700/50">
                        <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-400">share</span>
                                Sdílení projektu
                            </h3>
                            <button onClick={closeShareModal} className="text-slate-400 hover:text-white transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6">
                            {/* Add User Form */}
                            <form onSubmit={handleShare} className="flex flex-wrap gap-2 mb-6">
                                <div className="flex-1 min-w-[180px]">
                                    <label className="block text-xs text-slate-400 mb-1">Email uživatele</label>
                                    <input
                                        type="email"
                                        required
                                        value={shareEmail}
                                        onChange={(e) => setShareEmail(e.target.value)}
                                        placeholder="kolega@firma.cz"
                                        className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                                    />
                                </div>
                                <div className="w-[140px]">
                                    <label className="block text-xs text-slate-400 mb-1">Oprávnění</label>
                                    <select
                                        value={sharePermission}
                                        onChange={(e) => setSharePermission(e.target.value as 'view' | 'edit')}
                                        className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none h-[42px]"
                                    >
                                        <option value="edit">Úpravy</option>
                                        <option value="view">Pouze čtení</option>
                                    </select>
                                </div>
                                <div className="flex items-end">
                                    <button
                                        type="submit"
                                        disabled={isSharing || !shareEmail}
                                        className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-4 py-2.5 rounded-xl text-sm font-bold h-[42px] flex items-center gap-2 shadow-lg transition-all"
                                    >
                                        {isSharing ? '...' : 'Přidat'}
                                    </button>
                                </div>
                            </form>

                            {/* List of Shared Users */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                    Lidé s přístupem
                                </h4>
                                {isLoadingShares ? (
                                    <div className="flex justify-center py-4">
                                        <span className="material-symbols-outlined animate-spin text-slate-400">sync</span>
                                    </div>
                                ) : shares.length === 0 ? (
                                    <p className="text-sm text-slate-500 italic">Nikomu nesdíleno.</p>
                                ) : (
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                                        {shares.map(share => (
                                            <div key={share.user_id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                                                        {share.email?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-white">{share.email}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={share.permission}
                                                        onChange={(e) => handleChangePermission(share.user_id, e.target.value as 'view' | 'edit')}
                                                        className="rounded-lg bg-slate-700/50 border border-slate-600/50 px-2 py-1 text-xs text-slate-300 focus:border-blue-500/50 focus:outline-none cursor-pointer"
                                                    >
                                                        <option value="edit">Úpravy</option>
                                                        <option value="view">Pouze čtení</option>
                                                    </select>
                                                    <button
                                                        onClick={() => handleRemoveShare(share.user_id)}
                                                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                        title="Odebrat přístup"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">person_remove</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
