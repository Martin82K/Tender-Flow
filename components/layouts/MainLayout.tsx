import React, { Suspense } from 'react';
import { Sidebar } from '../Sidebar';
import { ConfirmationModal } from '../ConfirmationModal';
import { navigate, buildAppUrl } from '../routing/router'; // Assuming router.tsx is in components/routing/
import { Project, View, User } from '../../types';

interface MainLayoutProps {
    children: React.ReactNode;
    // UI State
    uiModal: {
        isOpen: boolean;
        title: string;
        message: string;
        variant: 'danger' | 'info' | 'success';
        confirmLabel?: string;
    };
    closeUiModal: () => void;
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;

    // Navigation & Data
    currentView: View;
    projects: Project[];
    selectedProjectId: string;
    onProjectSelect: (id: string) => void;
    activeProjectTab?: string; // Needed for Sidebar navigation logic

    // Status
    user: User | null;
    isBackgroundLoading: boolean;
    backgroundWarning: string | null;
    onReloadData: (force: boolean) => void;
    onHideBackgroundWarning: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    uiModal,
    closeUiModal,
    isSidebarOpen,
    setIsSidebarOpen,
    currentView,
    projects,
    selectedProjectId,
    onProjectSelect,
    activeProjectTab = 'overview',
    user,
    isBackgroundLoading,
    backgroundWarning,
    onReloadData,
    onHideBackgroundWarning
}) => {

    const handleViewChange = (view: View, opts?: any) => {
        if (view === "project") {
            const targetId = selectedProjectId || projects.find((p) => p.status !== "archived")?.id;
            if (targetId) {
                navigate(buildAppUrl("project", { projectId: targetId, tab: activeProjectTab as any }));
            } else {
                navigate(buildAppUrl("dashboard"));
            }
            return;
        }
        if (view === "settings") {
            navigate(buildAppUrl("settings", opts));
            return;
        }
        navigate(buildAppUrl(view));
    };

    return (
        <div className="relative flex h-screen w-full flex-row overflow-hidden bg-background-light dark:bg-background-dark">
            <ConfirmationModal
                isOpen={uiModal.isOpen}
                title={uiModal.title}
                message={uiModal.message}
                variant={uiModal.variant}
                confirmLabel={uiModal.confirmLabel}
                onConfirm={closeUiModal}
            />
            <Sidebar
                currentView={currentView}
                onViewChange={handleViewChange}
                projects={projects.filter((p) => p.status !== "archived")}
                selectedProjectId={selectedProjectId}
                onProjectSelect={onProjectSelect}
                isOpen={isSidebarOpen}
                onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            />
            <main
                id="main-scroll-container" // Replaces mainScrollRef usage with ID or pass ref? Pass ref is better but ID is easier for decoupled components
                className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto overflow-x-hidden relative"
            >
                {/* Toggle Button for Mobile/Hidden Sidebar */}
                {user?.role === 'demo' && (
                    <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white px-4 py-2 flex items-center justify-between shadow-lg z-50">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined animate-pulse">auto_awesome</span>
                            <div>
                                <span className="font-bold">DEMO REŽIM</span>
                                <span className="hidden sm:inline ml-2 text-orange-100 text-sm">— Data jsou uložena pouze v tomto prohlížeči a po odhlášení budou smazána.</span>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/register')}
                            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs font-bold transition-colors border border-white/20"
                        >
                            Vytvořit plný účet
                        </button>
                    </div>
                )}

                {(isBackgroundLoading || backgroundWarning) && (
                    <div className="mx-4 mt-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/60 backdrop-blur px-4 py-3 flex items-start gap-3">
                        {isBackgroundLoading ? (
                            <span className="material-symbols-outlined animate-spin text-primary mt-0.5">progress_activity</span>
                        ) : (
                            <span className="material-symbols-outlined text-amber-500 mt-0.5">warning</span>
                        )}
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                                {isBackgroundLoading ? "Dotažuji data na pozadí…" : "Některá data se nepodařilo načíst"}
                            </div>
                            {backgroundWarning && (
                                <div className="mt-1 text-xs text-slate-600 dark:text-slate-300 break-words">
                                    {backgroundWarning}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => onReloadData(true)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 dark:bg-white/15 dark:hover:bg-white/20 transition-colors"
                            >
                                Aktualizovat
                            </button>
                            {backgroundWarning && (
                                <button
                                    onClick={onHideBackgroundWarning}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200 hover:bg-slate-300 text-slate-900 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white transition-colors"
                                >
                                    Skrýt
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className={`fixed top-24 left-4 z-30 flex items-center justify-center p-1.5 rounded-lg bg-slate-800/80 text-white border border-slate-700/50 shadow-lg transition-all hover:bg-slate-700 md:hidden ${isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                    title={isSidebarOpen ? "Schovat sidebar" : "Zobrazit sidebar"}
                >
                    <span className="material-symbols-outlined text-[20px]">menu</span>
                </button>

                {/* Toggle Button for Desktop when Sidebar is hidden */}
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className={`hidden md:flex fixed top-24 left-4 z-30 items-center justify-center p-1.5 rounded-lg bg-slate-800/80 text-white border border-slate-700/50 shadow-lg transition-all hover:bg-slate-700 ${isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                    title="Zobrazit sidebar"
                >
                    <span className="material-symbols-outlined text-[20px]">menu</span>
                </button>

                <Suspense fallback={
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
                    </div>
                }>
                    {children}
                </Suspense>
            </main>
        </div>
    );
};
