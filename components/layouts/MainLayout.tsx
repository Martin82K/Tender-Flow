import React, { Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { Sidebar } from '../Sidebar';
import { ConfirmationModal } from '@shared/ui/ConfirmationModal';
import { navigate } from '@/shared/routing/router';
import { buildAppUrl } from '@/shared/routing/routeUtils';
import { AccountMenuProvider } from '@/shared/ui/AccountMenuContext';
import { UserAccountMenu } from '@/shared/ui/UserAccountMenu';
import { SpaceBackdrop } from '@/shared/ui/SpaceShellDecor';
import { Project, View, User } from '../../types';
import { normalizeUiScale } from '@/hooks/useTheme';
import type { ThemeMode, ThemeSkin } from '@/shared/types/theme';

const MOBILE_NAVIGATION_QUERY = '(max-width: 767px)';
const subscribeMobileNavigation = (onChange: () => void) => {
    const media = window.matchMedia?.(MOBILE_NAVIGATION_QUERY);
    media?.addEventListener('change', onChange);
    return () => media?.removeEventListener('change', onChange);
};
const getMobileNavigation = () => window.matchMedia?.(MOBILE_NAVIGATION_QUERY).matches ?? false;
const getServerMobileNavigation = () => false;

interface MainLayoutProps {
    children: React.ReactNode;
    // UI State
    uiModal: {
        isOpen: boolean;
        title: string;
        message: string;
        messageNode?: React.ReactNode;
        variant: 'danger' | 'info' | 'success';
        confirmLabel?: string;
        cancelLabel?: string;
        onConfirm?: () => void;
        onCancel?: () => void;
    };
    closeUiModal: () => void;
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;

    // Navigation & Data
    currentView: View;
    projects: Project[];
    selectedProjectId: string;
    onProjectSelect: (id: string, tab?: string) => void;
    activeProjectTab?: string; // Needed for Sidebar navigation logic

    // Status
    user: User | null;
    theme: ThemeMode;
    skin: ThemeSkin;
    onSetTheme: (theme: ThemeMode) => void;
    onSetSkin: (skin: ThemeSkin) => void;
    uiScale: number;
    onSetUiScale: (scale: number) => void;
    onResetUiScale: () => void;
    onLogout: () => void | Promise<void>;
    isBackgroundLoading: boolean;
    backgroundWarning: {
        message: string;
        type: "warning" | "error" | "info";
    } | null;
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
    theme,
    skin,
    onSetTheme,
    onSetSkin,
    uiScale,
    onSetUiScale,
    onResetUiScale,
    onLogout,
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
                navigate(buildAppUrl("project-management"));
            }
            return;
        }
        if (view === "settings") {
            navigate(buildAppUrl("settings", opts));
            return;
        }
        navigate(buildAppUrl(view));
    };

    const accountMenu = (
        <UserAccountMenu
            user={user}
            theme={theme}
            skin={skin}
            onSetTheme={onSetTheme}
            onSetSkin={onSetSkin}
            uiScale={uiScale}
            onSetUiScale={onSetUiScale}
            onResetUiScale={onResetUiScale}
            onLogout={onLogout}
        />
    );

    const normalizedUiScale = normalizeUiScale(uiScale);
    const inverseUiScale = Number((100 / normalizedUiScale).toFixed(4));
    const appShellStyle: React.CSSProperties = {
        width: `${inverseUiScale}vw`,
        height: `${inverseUiScale}dvh`,
        zoom: normalizedUiScale,
    };
    const isMobile = useSyncExternalStore(subscribeMobileNavigation, getMobileNavigation, getServerMobileNavigation);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    useEffect(() => { setMobileMenuOpen(false); }, [isMobile]);
    const mobileMenuVisible = isMobile && mobileMenuOpen;
    const sidebar = <Sidebar
        currentView={currentView}
        onViewChange={handleViewChange}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectSelect={onProjectSelect}
        isOpen={isMobile ? mobileMenuOpen : isSidebarOpen}
        onToggle={() => isMobile ? setMobileMenuOpen(open => !open) : setIsSidebarOpen(!isSidebarOpen)}
        isMobile={isMobile}
        skin={skin}
    />;

    return (
        <div className="tf-app-viewport fixed inset-0 overflow-hidden bg-background-light dark:bg-background-dark">
        <div
            className="tf-app-shell relative flex flex-row overflow-hidden bg-background-light dark:bg-background-dark"
            style={appShellStyle}
            inert={mobileMenuVisible}
        >
            <ConfirmationModal
                isOpen={uiModal.isOpen}
                title={uiModal.title}
                message={uiModal.message}
                messageNode={uiModal.messageNode}
                variant={uiModal.variant}
                confirmLabel={uiModal.confirmLabel}
                cancelLabel={uiModal.cancelLabel}
                onConfirm={uiModal.onConfirm ?? closeUiModal}
                onCancel={uiModal.onCancel}
            />
            {!isMobile && sidebar}
            <AccountMenuProvider accountMenu={accountMenu}>
                <main
                    id="main-scroll-container" // Replaces mainScrollRef usage with ID or pass ref? Pass ref is better but ID is easier for decoupled components
                    className={`tf-app-main flex-1 flex flex-col h-full min-w-0 min-h-0 overflow-x-hidden relative ${mobileMenuVisible ? 'overflow-y-hidden' : 'overflow-y-auto'}`}
                >
                    {skin === 'space' && <SpaceBackdrop />}
                    {/* Toggle Button for Mobile/Hidden Sidebar */}

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
                                        {backgroundWarning.message}
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

                    {isMobile && (
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen(true)}
                            className="fixed left-2 top-2 z-40 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white/95 text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-200 dark:hover:bg-slate-700"
                            title="Zobrazit sidebar"
                            aria-label="Zobrazit sidebar"
                            aria-controls="app-sidebar"
                            aria-expanded={mobileMenuVisible}
                        >
                            <span
                                className="material-symbols-outlined text-[22px]"
                                aria-hidden="true"
                            >
                                menu
                            </span>
                        </button>
                    )}

                    <Suspense fallback={
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
                        </div>
                    }>
                        {children}
                    </Suspense>
                </main>
            </AccountMenuProvider>
        </div>
        {isMobile && sidebar}
        </div>
    );
};
