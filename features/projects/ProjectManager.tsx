import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PROJECT_KEYS } from '@/shared/queryKeys/projectKeys';
import { Project, ProjectStatus } from '@/types';
import { Header } from '@/shared/ui/Header';
import { NotificationBell } from "@features/notifications/ui/NotificationBell";
import { TaskCreateButton } from '@features/tasks';
import { HelpButton } from "@features/help";
import { projectService } from '@/services/projectService';
import { organizationService } from '@features/organization/api';
import type { OrganizationMember } from '@features/organization/api';
import { useAuth } from '@/context/AuthContext';
import { DeleteConfirmationModal } from '@/shared/ui/DeleteConfirmationModal';
import { AlertModal } from '@/shared/ui/AlertModal';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import { useFeatures } from '@/context/FeatureContext';
import type { ThemeSkin } from '@/shared/types/theme';
import { readPortfolioState, writePortfolioState, portfolioStorageKey, parsePortfolioStatus, PORTFOLIO_VIEWS } from '@features/projects/model/portfolioState';
import { Link, navigate, useLocation } from '@/shared/routing/router';
import { buildAppUrl } from '@/shared/routing/routeUtils';
import { PROJECT_TEAM_ROLE_LABELS } from '@/shared/authorization/projectRoles';
import { useProjectPortfolioSummary } from '@features/projects/hooks/useProjectPortfolioSummary';
import { ProjectPortfolioCharts, PortfolioDeadline } from '@features/projects/ui/ProjectPortfolioCharts';
import { ThemedNativeSelect } from "@shared/ui/ThemedNativeSelect";

interface ProjectManagerProps {
    projects: Project[];
    onAddProject: (project: Project) => Promise<void>;
    onDeleteProject: (id: string) => void;
    onCloneTenderToRealization: (id: string) => Promise<{ projectId: string }>;
    onArchiveProject: (id: string) => void;
    skin?: ThemeSkin;
}

// Archived projects remain read-only; only authorized restoration is offered.
const ArchiveSection: React.FC<{
    projects: Project[];
    onRestoreProject: (id: string) => void;
    canAdminister: (id: string) => boolean;
}> = ({ projects, onRestoreProject, canAdminister }) => {

    return (
        <section data-help-id="pm-archive-section" className="bg-white dark:bg-gradient-to-br dark:from-slate-900/50 dark:to-slate-950/50 backdrop-blur-xl border border-slate-200 dark:border-slate-700/30 rounded-2xl shadow-xl overflow-hidden">
            <h2 className="p-4 text-base font-bold">Archiv · {projects.length}</h2>
                <div className="p-4 pt-0 space-y-2">
                    {!projects.length && <p className="py-4 text-sm text-slate-500">Žádné archivované stavby neodpovídají výběru.</p>}
                    {projects.map(project => (
                        <div key={project.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-700/40 opacity-70 hover:opacity-100 transition-opacity">
                            <div className="flex items-center gap-3">
                                <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-700/50 text-slate-500 flex items-center justify-center text-sm font-bold">
                                    A
                                </div>
                                <div>
                                    <Link to={buildAppUrl('project', { projectId: project.id, tab: 'overview' })} className="font-medium text-slate-600 dark:text-slate-300 text-sm hover:underline">{project.name}</Link>
                                    <p className="text-[10px] text-slate-600">{project.location}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                {/* Restore Button */}
                                {canAdminister(project.id) && <button
                                    onClick={() => onRestoreProject(project.id)}
                                    className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                    title="Obnovit projekt"
                                >
                                    <span className="material-symbols-outlined text-[18px]">unarchive</span>
                                </button>}

                                {/* Archiv je read-only; trvalé smazání je dostupné až po obnovení. */}
                            </div>
                        </div>
                    ))}
                </div>
        </section>
    );
};

export const ProjectManager: React.FC<ProjectManagerProps> = ({
    projects,
    onAddProject,
    onDeleteProject,
    onCloneTenderToRealization,
    onArchiveProject,
    skin = 'classic'
}) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { search } = useLocation();
    const routeStatus = parsePortfolioStatus(new URLSearchParams(search).get('status'));
    const portfolioKey = portfolioStorageKey(user?.id, user?.organizationId);
    const [portfolio, setPortfolio] = useState(() => readPortfolioState(portfolioKey));
    const portfolioStatus = routeStatus ?? portfolio.status;
    useEffect(() => {
        if (routeStatus && routeStatus !== portfolio.status) {
            setPortfolio(previous => ({ ...previous, status: routeStatus, scrollTop: 0 }));
            if (scrollContainer.current) scrollContainer.current.scrollTop = 0;
        }
    }, [routeStatus, portfolio.status]);
    const [showCreate, setShowCreate] = useState(false);
    const summaries = useProjectPortfolioSummary(projects, user?.id, user?.organizationId);
    const scrollContainer = useRef<HTMLDivElement>(null);
    const currentPortfolio = useRef(portfolio);
    const storedPortfolioKey = useRef(portfolioKey);
    useEffect(() => {
        if (storedPortfolioKey.current !== portfolioKey) {
            const saved = readPortfolioState(portfolioKey);
            storedPortfolioKey.current = portfolioKey;
            currentPortfolio.current = saved;
            setPortfolio(saved);
            if (scrollContainer.current) scrollContainer.current.scrollTop = saved.scrollTop;
            return;
        }
        currentPortfolio.current = portfolio;
        writePortfolioState(portfolioKey, portfolio);
    }, [portfolio, portfolioKey]);
    useEffect(() => {
        if (scrollContainer.current) scrollContainer.current.scrollTop = currentPortfolio.current.scrollTop;
    }, []);
    const { currentPlan, isLoading: isFeaturesLoading } = useFeatures();
    const ownedActiveProjectsCount = projects.filter((project) => {
        if (project.status === 'archived') return false;
        return project.ownerId === user?.id;
    }).length;
    const isFreeTier = !isFeaturesLoading && currentPlan === 'free';
    const isProjectLimitReached = isFreeTier && ownedActiveProjectsCount >= 1;

    // Create Form State
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectLocation, setNewProjectLocation] = useState('');
    const [newProjectStatus, setNewProjectStatus] = useState<ProjectStatus>('tender');
    const [isCreating, setIsCreating] = useState(false);
    const [createMembers, setCreateMembers] = useState<OrganizationMember[]>([]);
    const [initialTeam, setInitialTeam] = useState<Record<string, boolean>>({});

    // Edit State
    const [editingProject, setEditingProject] = useState<{ id: string; name: string; location: string; status: ProjectStatus } | null>(null);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [cloningProjectId, setCloningProjectId] = useState<string | null>(null);

    // Sharing State
    const [sharingProjectId, setSharingProjectId] = useState<string | null>(null);
    const [shareEmail, setShareEmail] = useState('');
    const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('edit');
    const [shares, setShares] = useState<{ user_id: string, email: string, permission: string }[]>([]);
    const [isLoadingShares, setIsLoadingShares] = useState(false);
    const [isSharing, setIsSharing] = useState(false);

    // Delete Confirmation State
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

    // Transfer Ownership State
    const [transferTarget, setTransferTarget] = useState<{ id: string; name: string } | null>(null);
    const [transferMembers, setTransferMembers] = useState<OrganizationMember[]>([]);
    const [selectedTransferOwnerId, setSelectedTransferOwnerId] = useState<string>('');
    const [isLoadingTransferMembers, setIsLoadingTransferMembers] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);

    useEffect(() => {
        if (!user?.organizationId) {
            setCreateMembers([]);
            return;
        }
        organizationService.getOrganizationMembers(user.organizationId)
            .then((members) => setCreateMembers(members.filter((member) => member.is_active)))
            .catch((error) => console.error('[ProjectManager] Failed to load team candidates:', error));
    }, [user?.id, user?.organizationId]);

    const canAdministerProject = (projectId: string) => {
        const project = projects.find((item) => item.id === projectId);
        return Boolean(project?.ownerId && project.ownerId === user?.id);
    };

    const openDeleteModal = (id: string, name: string) => {
        setDeleteTarget({ id, name });
    };

    const closeDeleteModal = () => {
        setDeleteTarget(null);
    };

    // Alert & Confirm Modal State
    const [alertModal, setAlertModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'info';
    }>({ isOpen: false, title: '', message: '', variant: 'info' });

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant?: 'danger' | 'info';
        confirmLabel?: string;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const closeAlertModal = () => setAlertModal(prev => ({ ...prev, isOpen: false }));
    const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

    const handleConfirmDelete = () => {
        if (deleteTarget) {
            onDeleteProject(deleteTarget.id);
            setDeleteTarget(null);
        }
    };

    const openTransferModal = async (project: Project) => {
        if (!user?.organizationId) {
            setAlertModal({
                isOpen: true,
                title: 'Předání není možné',
                message: 'Stavbu lze předat pouze v rámci organizace. Tvůj účet není přiřazen k žádné organizaci.',
                variant: 'info',
            });
            return;
        }

        setTransferTarget({ id: project.id, name: project.name });
        setSelectedTransferOwnerId('');
        setTransferMembers([]);
        setIsLoadingTransferMembers(true);
        try {
            const members = await organizationService.getOrganizationMembers(user.organizationId);
            const eligible = members.filter(
                (m) => m.user_id !== user.id && m.is_active !== false,
            );
            setTransferMembers(eligible);
        } catch (error) {
            console.error('[ProjectManager] Error loading organization members:', error);
            setAlertModal({
                isOpen: true,
                title: 'Chyba',
                message: error instanceof Error ? error.message : 'Nepodařilo se načíst členy organizace.',
                variant: 'error',
            });
            setTransferTarget(null);
        } finally {
            setIsLoadingTransferMembers(false);
        }
    };

    const closeTransferModal = () => {
        if (isTransferring) return;
        setTransferTarget(null);
        setTransferMembers([]);
        setSelectedTransferOwnerId('');
    };

    const handleConfirmTransfer = async () => {
        if (!transferTarget || !selectedTransferOwnerId) return;

        const newOwner = transferMembers.find((m) => m.user_id === selectedTransferOwnerId);
        const newOwnerLabel = newOwner?.display_name || newOwner?.email || 'zvolenému uživateli';
        const projectName = transferTarget.name;

        setConfirmModal({
            isOpen: true,
            title: 'Předat vlastnictví stavby',
            message: `Opravdu chcete předat stavbu „${projectName}" uživateli ${newOwnerLabel}? Přestanete být systémovým vlastníkem; případná profesní role realizačního týmu zůstane beze změny.`,
            confirmLabel: 'Předat vlastnictví',
            variant: 'danger',
            onConfirm: () => executeTransfer(),
        });
    };

    const executeTransfer = async () => {
        closeConfirmModal();
        if (!transferTarget || !selectedTransferOwnerId) return;

        setIsTransferring(true);
        try {
            await projectService.transferProjectOwnership(
                transferTarget.id,
                selectedTransferOwnerId,
            );
            await queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.list() });
            setAlertModal({
                isOpen: true,
                title: 'Vlastnictví předáno',
                message: `Stavba „${transferTarget.name}" má nového vlastníka.`,
                variant: 'success',
            });
            setTransferTarget(null);
            setSelectedTransferOwnerId('');
            setTransferMembers([]);
        } catch (error) {
            console.error('[ProjectManager] Transfer ownership failed:', error);
            setAlertModal({
                isOpen: true,
                title: 'Chyba',
                message: error instanceof Error ? error.message : 'Nepodařilo se předat vlastnictví stavby.',
                variant: 'error',
            });
        } finally {
            setIsTransferring(false);
        }
    };

    // Permission translation helper
    const getPermissionLabel = (permission: string) => {
        return permission === 'edit' ? 'Úpravy' : 'Pouze čtení';
    };

    // Edit handlers
    const openEditModal = (project: Project) => {
        setEditingProject({
            id: project.id,
            name: project.name,
            location: project.location,
            status: project.status,
        });
    };

    const closeEditModal = () => {
        setEditingProject(null);
        setIsSavingEdit(false);
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProject || !editingProject.name || !editingProject.location) return;

        setIsSavingEdit(true);
        try {
            await projectService.updateProject(editingProject.id, {
                name: editingProject.name,
                location: editingProject.location,
                status: editingProject.status,
            });
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.list() });
            setAlertModal({
                isOpen: true,
                title: 'Uloženo',
                message: 'Projekt byl úspěšně upraven.',
                variant: 'success'
            });
            closeEditModal();
        } catch (error) {
            console.error('Error updating project:', error);
            setAlertModal({
                isOpen: true,
                title: 'Chyba',
                message: 'Chyba při ukládání úprav.',
                variant: 'error'
            });
        } finally {
            setIsSavingEdit(false);
        }
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

    const displayedProjects = orderedActiveProjects.filter(project =>
        (portfolioStatus === 'all' || project.status === portfolioStatus)
        && (!portfolio.ownOnly || project.ownerId === user?.id)
        && `${project.name} ${project.location}`.toLocaleLowerCase('cs').includes(portfolio.query.toLocaleLowerCase('cs'))
    );

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
        if (isProjectLimitReached) {
            setAlertModal({
                isOpen: true,
                title: 'Limit tarifu Free',
                message: 'Tarif Free umožňuje pouze 1 aktivní stavbu. Pro další stavby prosím upgradujte plán nebo stávající stavbu archivujte.',
                variant: 'info'
            });
            return;
        }
        if (!newProjectName || !newProjectLocation) return;
        setIsCreating(true);

        const newProject: Project = {
            id: crypto.randomUUID(),
            name: newProjectName,
            location: newProjectLocation,
            status: newProjectStatus,
            ownerId: user?.id,
            organizationId: user?.organizationId,
            initialTeam: Object.keys(initialTeam).filter((userId) => initialTeam[userId]).map((userId) => ({ userId })),
            // Owner ID handled by service/backend
        };

        try {
            // Service call removed to avoid double insertion (App.tsx handles it via onAddProject)
            // await projectService.createProject(newProject);

            // We call onAddProject to update local state in App.tsx and persist
            await onAddProject(newProject);

            setNewProjectName('');
            setNewProjectLocation('');
            setInitialTeam({});
            navigate(buildAppUrl('project', { projectId: newProject.id, tab: 'overview' }));
        } catch (error) {
            console.error('Error creating project:', error);
            setAlertModal({
                isOpen: true,
                title: 'Chyba',
                message: 'Chyba při vytváření projektu.',
                variant: 'error'
            });
        } finally {
            setIsCreating(false);
        }
    };

    const openShareModal = (projectId: string) => {
        navigate(buildAppUrl('project', { projectId, tab: 'settings' }));
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
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.list() });
            setAlertModal({
                isOpen: true,
                title: 'Sdílení',
                message: 'Projekt byl úspěšně nasdílen.',
                variant: 'success'
            });
        } catch (error: any) {
            console.error('Example share error:', error);
            setAlertModal({
                isOpen: true,
                title: 'Chyba',
                message: error.message || 'Chyba při sdílení.',
                variant: 'error'
            });
        } finally {
            setIsSharing(false);
        }
    };

    const handleRemoveShareClick = (userId: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Zrušit sdílení',
            message: 'Opravdu zrušit sdílení tomuto uživateli?',
            confirmLabel: 'Zrušit přístup',
            variant: 'danger',
            onConfirm: () => executeRemoveShare(userId)
        });
    };

    const executeRemoveShare = async (userId: string) => {
        closeConfirmModal();
        if (!sharingProjectId) return;

        try {
            await projectService.removeShare(sharingProjectId, userId);
            setShares(shares.filter(s => s.user_id !== userId));
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.list() });
        } catch (error) {
            console.error('Error removing share:', error);
            setAlertModal({
                isOpen: true,
                title: 'Chyba',
                message: 'Chyba při rušení sdílení.',
                variant: 'error'
            });
        }
    };

    const handleChangePermission = async (userId: string, newPermission: 'view' | 'edit') => {
        if (!sharingProjectId) return;

        try {
            await projectService.updateSharePermission(sharingProjectId, userId, newPermission);
            setShares(shares.map(s =>
                s.user_id === userId ? { ...s, permission: newPermission } : s
            ));
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.list() });
        } catch (error) {
            console.error('Error updating permission:', error);
            setAlertModal({
                isOpen: true,
                title: 'Chyba',
                message: 'Chyba při změně oprávnění.',
                variant: 'error'
            });
        }
    };

    const handleCloneProjectClick = (project: Project) => {
        setConfirmModal({
            isOpen: true,
            title: 'Přepnout do realizace',
            message: `Vytvoří se nová stavba v realizaci jako kopie projektu "${project.name}". Původní soutěž zůstane beze změny. Pokračovat?`,
            confirmLabel: 'Vytvořit realizaci',
            variant: 'info',
            onConfirm: () => executeCloneProject(project),
        });
    };

    const executeCloneProject = async (project: Project) => {
        closeConfirmModal();

        if (isProjectLimitReached) {
            setAlertModal({
                isOpen: true,
                title: 'Limit tarifu Free',
                message: 'Tarif Free umožňuje pouze 1 aktivní stavbu. Pro další stavby prosím upgradujte plán nebo stávající stavbu archivujte.',
                variant: 'info',
            });
            return;
        }

        setCloningProjectId(project.id);
        try {
            await onCloneTenderToRealization(project.id);
            setAlertModal({
                isOpen: true,
                title: 'Realizace vytvořena',
                message: 'Byla vytvořena nová realizační stavba a otevřena v záložce Dokumenty.',
                variant: 'success',
            });
        } catch (error) {
            console.error('Error cloning project to realization:', error);
            setAlertModal({
                isOpen: true,
                title: 'Chyba',
                message: error instanceof Error ? error.message : 'Nepodařilo se vytvořit realizační kopii projektu.',
                variant: 'error',
            });
        } finally {
            setCloningProjectId(null);
        }
    };

    return (
        <div ref={scrollContainer} onScroll={event => {
            const next = { ...currentPortfolio.current, scrollTop: event.currentTarget.scrollTop };
            currentPortfolio.current = next;
            writePortfolioState(portfolioKey, next);
        }} className="tf-project-manager-view flex flex-col h-full bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen overflow-y-auto">
            <Header title="Stavby" subtitle={portfolioStatus === 'all' ? 'Portfolio staveb' : PORTFOLIO_VIEWS.find(view => view.id === portfolioStatus)?.label} helpSlot={<div className="flex items-center gap-1"><TaskCreateButton /><HelpButton /></div>} notificationSlot={<NotificationBell />} skin={skin} />

            <div className="p-4 md:p-6 w-full pb-20">

                <div className="tf-portfolio-toolbar mb-5 flex flex-wrap items-center gap-3 rounded-xl p-3">
                    <input type="search" aria-label="Hledat stavbu" placeholder="Hledat podle názvu nebo čísla…"
                        value={portfolio.query} onChange={event => setPortfolio({ ...currentPortfolio.current, query: event.target.value })}
                        className="w-full min-w-0 sm:w-80 sm:max-w-sm sm:flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm" />
                    <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm"><input type="checkbox" checked={portfolio.ownOnly}
                        onChange={event => setPortfolio({ ...currentPortfolio.current, ownOnly: event.target.checked })} />Moje stavby</label>
                    <button type="button" aria-expanded={showCreate} aria-controls="portfolio-create"
                        onClick={() => setShowCreate(!showCreate)} className="shrink-0 whitespace-nowrap rounded-lg border border-primary px-4 py-2 text-sm text-primary">+ Nová stavba</button>
                </div>
                {/* 1. Create New Project */}
                <section id="portfolio-create" hidden={!showCreate} data-help-id="pm-create-section" className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl mb-8">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-400">add_business</span>
                        Nová stavba
                    </h2>

                    {isProjectLimitReached && (
                        <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
                            Tarif Free umožňuje pouze 1 aktivní stavbu. Pro další stavby prosím upgradujte plán nebo stávající stavbu archivujte.
                        </div>
                    )}

                    <form onSubmit={handleCreateProject} className="bg-slate-50 dark:bg-slate-950/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700/40">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Název projektu</label>
                                <input
                                    type="text"
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    placeholder="Např. Rezidence Park"
                                    disabled={isProjectLimitReached}
                                    className="w-full rounded-lg bg-white dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Lokace</label>
                                <input
                                    type="text"
                                    value={newProjectLocation}
                                    onChange={(e) => setNewProjectLocation(e.target.value)}
                                    placeholder="Např. Plzeň"
                                    disabled={isProjectLimitReached}
                                    className="w-full rounded-lg bg-white dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Typ / Fáze</label>
                                <ThemedNativeSelect
                                    value={newProjectStatus}
                                    onChange={(e) => setNewProjectStatus(e.target.value as ProjectStatus)}
                                    disabled={isProjectLimitReached}
                                    className="w-full rounded-lg bg-white dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                                >
                                    <option value="tender">Soutěž (Příprava)</option>
                                    <option value="realization">Realizace (Výstavba)</option>
                                </ThemedNativeSelect>
                            </div>
                        </div>
                        {createMembers.length > 0 && <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/60">
                            <div className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Realizační tým</div>
                            <div className="space-y-2">
                                {createMembers.map((member) => {
                                    const selected = initialTeam[member.user_id] === true;
                                    return <div key={member.user_id} className="flex items-center gap-3">
                                        <input type="checkbox" aria-label={`Přidat ${member.display_name || member.email} do týmu`} checked={selected} onChange={(event) => setInitialTeam((current) => {
                                            const next = { ...current };
                                            if (event.target.checked) next[member.user_id] = true; else delete next[member.user_id];
                                            return next;
                                        })} />
                                        <span className="min-w-0 flex-1 truncate text-sm">{member.display_name || member.email}{member.user_id === user?.id ? " · systémový vlastník" : ""}</span>
                                        <span className="text-xs text-slate-400">{member.professional_role ? PROJECT_TEAM_ROLE_LABELS[member.professional_role] : "Bez profesní role"}</span>
                                    </div>;
                                })}
                            </div>
                            <p className="mt-3 text-xs text-slate-400">Vybraní členové získají přístup atomicky při uložení stavby. Profesní role se spravuje centrálně v Organizace → Členové.</p>
                        </div>}
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={!newProjectName || !newProjectLocation || isCreating || isProjectLimitReached}
                                className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isCreating && <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>}
                                Vytvořit projekt
                            </button>
                        </div>
                    </form>
                </section>

                {/* 2. Active Project List */}
                {portfolioStatus !== 'archived' && <section data-help-id="pm-project-list" className="tf-portfolio-list mb-5">
                    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Stavby · {displayedProjects.length}
                    </h2>

                    {summaries.isError && <p role="alert" className="mb-3 text-sm">Souhrny VŘ se nepodařilo načíst. <button type="button" className="underline" onClick={() => void summaries.refetch()}>Zkusit znovu</button></p>}
                    <div className="tf-portfolio-table" role="table" aria-label="Stavby v portfoliu">
                        <div className="tf-portfolio-grid tf-portfolio-head" role="row">
                            <span role="columnheader">Stavba</span><span role="columnheader">Stav</span><span role="columnheader">Otevřená VŘ</span><span role="columnheader">Nejbližší termín</span><span role="columnheader" className="sr-only">Akce</span>
                        </div>
                        {displayedProjects.map(project => (
                            <div
                                key={project.id}
                                data-help-id="pm-project-row"
                                role="row"
                                draggable
                                onDragStart={(e) => handleDragStart(e, project.id)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, project.id)}
                                onDragEnd={handleDragEnd}
                                className={`tf-portfolio-grid tf-portfolio-row ${draggedId === project.id ? 'opacity-50' : ''}`}
                            >
                                <div role="cell" className="min-w-0">
                                    <Link to={buildAppUrl('project', { projectId: project.id, tab: 'overview' })} className="tf-portfolio-name block py-2 text-sm font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{project.name}</Link>
                                </div>
                                <span role="cell" data-help-id="pm-project-status-badge" data-status={project.status}
                                    aria-label={project.status === 'realization' ? 'Realizace' : 'Soutěž'} className="tf-portfolio-status text-xs">
                                    {project.status === 'realization' ? 'V realizaci' : 'V soutěži'}
                                </span>
                                <span role="cell" className="text-sm" aria-label={`Otevřená VŘ: ${project.name}`}>
                                    {summaries.data?.[project.id]?.openCount ?? (summaries.isFetching ? 'Načítání…' : '—')}
                                </span>
                                <div role="cell"><PortfolioDeadline summary={summaries.data?.[project.id]} loading={summaries.isFetching} /></div>
                                <div role="cell" className="flex items-center justify-end gap-1">
                                    <details className="tf-portfolio-actions relative">
                                        <summary aria-label={`Spravovat stavbu ${project.name}`} className="cursor-pointer list-none p-2"><span aria-hidden="true" className="material-symbols-outlined text-lg">more_horiz</span></summary>
                                        <div className="tf-portfolio-action-panel absolute right-0 top-full z-20 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                                            <p className="mb-2 break-words text-xs">{project.location}</p>
                                            <div className="mb-2 flex flex-wrap gap-1">
                                            {/* Ownership Badges */}
                                            {project.ownerId && project.ownerId !== user?.id && (
                                                <span className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded-lg border border-blue-500/30">
                                                    Sdíleno od: {project.ownerEmail || 'Uživatel'}
                                                </span>
                                            )}
                                            {!project.ownerId && (
                                                <span className="bg-slate-300 dark:bg-slate-700/50 text-slate-700 dark:text-slate-400 text-[10px] px-2 py-0.5 rounded-lg border border-slate-400 dark:border-slate-600/50">
                                                    Veřejné
                                                </span>
                                            )}

                                            </div>
                                            <p className="mb-2 text-xs text-slate-500">Pořadí změníte přetažením řádku.</p>
                                            <div data-help-id="pm-project-actions" className="tf-portfolio-action-list flex flex-col gap-1">
                                    {/* Edit Button - Only Owner */}
                                    {canAdministerProject(project.id) && (
                                        <button
                                            onClick={() => openEditModal(project)}
                                            className="p-2 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                                            title="Upravit projekt"
                                        >
                                            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">edit</span><span>Upravit stavbu</span>
                                        </button>
                                    )}

                                    {/* Team management is available to project owner/admin. */}
                                    {canAdministerProject(project.id) && (
                                        <button
                                            onClick={() => openShareModal(project.id)}
                                            className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors flex items-center gap-1"
                                            title="Sdílet projekt"
                                        >
                                            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">share</span><span>Sdílet stavbu</span>
                                        </button>
                                    )}

                                    {project.status === 'tender' && (!project.ownerId || project.ownerId === user?.id) && (
                                        <button
                                            onClick={() => handleCloneProjectClick(project)}
                                            disabled={cloningProjectId === project.id}
                                            className="p-2 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Přepnout do realizace"
                                        >
                                            <span aria-hidden="true" className={`material-symbols-outlined text-[20px] ${cloningProjectId === project.id ? 'animate-spin' : ''}`}>
                                                {cloningProjectId === project.id ? 'sync' : 'published_with_changes'}
                                            </span><span>{cloningProjectId === project.id ? 'Přepínání do realizace…' : 'Přepnout do realizace'}</span>
                                        </button>
                                    )}

                                    {/* Transfer Ownership - Only current Owner in an organization */}
                                    {project.ownerId === user?.id && user?.organizationId && (
                                        <button
                                            onClick={() => openTransferModal(project)}
                                            className="p-2 text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors"
                                            title="Předat vlastnictví"
                                        >
                                            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">swap_horiz</span><span>Předat vlastnictví</span>
                                        </button>
                                    )}

                                    {canAdministerProject(project.id) && <button
                                        onClick={() => onArchiveProject(project.id)}
                                        className="p-2 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                                        title="Archivovat"
                                    >
                                        <span aria-hidden="true" className="material-symbols-outlined text-[20px]">archive</span><span>Archivovat stavbu</span>
                                    </button>}

                                    {/* Delete Button - Only Owner */}
                                    {(!project.ownerId || project.ownerId === user?.id) && (
                                        <button
                                            onClick={() => openDeleteModal(project.id, project.name)}
                                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            data-destructive="true"
                                            title="Odstranit"
                                        >
                                            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">delete</span><span>Odstranit stavbu</span>
                                        </button>
                                    )}
                                            </div>
                                        </div>
                                    </details>
                                </div>
                            </div>
                        ))}
                        {displayedProjects.length === 0 && (
                            <p className="text-center text-slate-500 italic py-4">Žádné stavby neodpovídají výběru.</p>
                        )}
                    </div>
                </section>}

                {portfolioStatus !== 'archived' && <ProjectPortfolioCharts projects={displayedProjects} summaries={summaries.data} loading={summaries.isFetching} />}

                {/* 3. Archive Section */}
                {portfolioStatus === 'archived' && (
                    <ArchiveSection
                        projects={projects.filter(p => p.status === 'archived' && (!portfolio.ownOnly || p.ownerId === user?.id) && `${p.name} ${p.location}`.toLocaleLowerCase('cs').includes(portfolio.query.toLocaleLowerCase('cs')))}
                        onRestoreProject={onArchiveProject}
                        canAdminister={canAdministerProject}
                    />
                )}
            </div>

            {/* Edit Modal */}
            {editingProject && (
                <div data-help-id="pm-edit-modal" className="tf-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="tf-modal-panel bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700/50">
                        <div className="tf-modal-header p-4 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-amber-400">edit</span>
                                Upravit projekt
                            </h3>
                            <button onClick={closeEditModal} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Název projektu</label>
                                <input
                                    type="text"
                                    value={editingProject.name}
                                    onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Lokace</label>
                                <input
                                    type="text"
                                    value={editingProject.location}
                                    onChange={(e) => setEditingProject({ ...editingProject, location: e.target.value })}
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Typ / Fáze</label>
                                <ThemedNativeSelect
                                    value={editingProject.status}
                                    onChange={(e) => setEditingProject({ ...editingProject, status: e.target.value as ProjectStatus })}
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                                >
                                    <option value="tender">Soutěž (Příprava)</option>
                                    <option value="realization">Realizace (Výstavba)</option>
                                </ThemedNativeSelect>
                            </div>
                            <div className="tf-modal-footer flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeEditModal}
                                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                >
                                    Zrušit
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingEdit || !editingProject.name || !editingProject.location}
                                    className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isSavingEdit && <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>}
                                    Uložit
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Sharing Modal */}
            {sharingProjectId && (
                <div data-help-id="pm-share-modal" className="tf-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="tf-modal-panel bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700/50">
                        <div className="tf-modal-header p-4 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-400">share</span>
                                Sdílení projektu
                            </h3>
                            <button onClick={closeShareModal} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
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
                                        className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                                    />
                                </div>
                                <div className="w-[140px]">
                                    <label className="block text-xs text-slate-400 mb-1">Oprávnění</label>
                                    <ThemedNativeSelect
                                        value={sharePermission}
                                        onChange={(e) => setSharePermission(e.target.value as 'view' | 'edit')}
                                        className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none h-[42px]"
                                    >
                                        <option value="edit">Úpravy</option>
                                        <option value="view">Pouze čtení</option>
                                    </ThemedNativeSelect>
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
                                            <div key={share.user_id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                                                        {share.email?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-900 dark:text-white">{share.email}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <ThemedNativeSelect
                                                        value={share.permission}
                                                        onChange={(e) => handleChangePermission(share.user_id, e.target.value as 'view' | 'edit')}
                                                        className="rounded-lg bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600/50 px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:border-blue-500/50 focus:outline-none cursor-pointer"
                                                    >
                                                        <option value="edit">Úpravy</option>
                                                        <option value="view">Pouze čtení</option>
                                                    </ThemedNativeSelect>
                                                    <button
                                                        onClick={() => handleRemoveShareClick(share.user_id)}
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

            {/* Transfer Ownership Modal */}
            {transferTarget && (
                <div data-help-id="pm-transfer-modal" className="tf-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="tf-modal-panel bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700/50">
                        <div className="tf-modal-header p-4 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-violet-400">swap_horiz</span>
                                Předat vlastnictví
                            </h3>
                            <button
                                onClick={closeTransferModal}
                                className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50"
                                disabled={isTransferring}
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6">
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                                Vyber nového vlastníka stavby <span className="font-semibold">„{transferTarget.name}"</span>. Dostupní jsou pouze aktivní členové tvé organizace.
                            </p>

                            {isLoadingTransferMembers ? (
                                <div className="flex justify-center py-8">
                                    <span className="material-symbols-outlined animate-spin text-slate-400">sync</span>
                                </div>
                            ) : transferMembers.length === 0 ? (
                                <p className="text-sm text-slate-500 italic py-4 text-center">
                                    V organizaci nejsou žádní další aktivní členové, kterým by bylo možné vlastnictví předat.
                                </p>
                            ) : (
                                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 mb-5">
                                    {transferMembers.map((member) => {
                                        const isSelected = selectedTransferOwnerId === member.user_id;
                                        const label = member.display_name || member.email;
                                        return (
                                            <button
                                                key={member.user_id}
                                                type="button"
                                                onClick={() => setSelectedTransferOwnerId(member.user_id)}
                                                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${isSelected
                                                    ? 'bg-violet-50 dark:bg-violet-500/15 border-violet-400 dark:border-violet-400/60'
                                                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 hover:border-violet-300 dark:hover:border-violet-500/40'
                                                    }`}
                                            >
                                                <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold ${isSelected
                                                    ? 'bg-violet-500 text-white'
                                                    : 'bg-violet-500/20 text-violet-500 dark:text-violet-300'
                                                    }`}>
                                                    {label.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{label}</p>
                                                    {member.display_name && member.email && member.display_name !== member.email && (
                                                        <p className="text-xs text-slate-500 truncate">{member.email}</p>
                                                    )}
                                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">
                                                        {member.role === 'owner' ? 'Vlastník organizace' : member.role === 'admin' ? 'Administrátor' : 'Člen'}
                                                    </p>
                                                </div>
                                                {isSelected && (
                                                    <span className="material-symbols-outlined text-violet-500 text-[22px]">check_circle</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="tf-modal-footer flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeTransferModal}
                                    disabled={isTransferring}
                                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors disabled:opacity-50"
                                >
                                    Zrušit
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmTransfer}
                                    disabled={!selectedTransferOwnerId || isTransferring || isLoadingTransferMembers}
                                    className="bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isTransferring && <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>}
                                    Předat vlastnictví
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <DeleteConfirmationModal
                isOpen={!!deleteTarget}
                projectName={deleteTarget?.name || ''}
                onConfirm={handleConfirmDelete}
                onCancel={closeDeleteModal}
            />

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={closeConfirmModal}
                confirmLabel={confirmModal.confirmLabel || 'OK'}
                variant={confirmModal.variant || 'danger'}
            />

            <AlertModal
                isOpen={alertModal.isOpen}
                onClose={closeAlertModal}
                title={alertModal.title}
                message={alertModal.message}
                variant={alertModal.variant}
            />
        </div>
    );
};
