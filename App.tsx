import React, { useState, useEffect, useRef, Suspense } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LandingPage } from './components/LandingPage';
import { Sidebar } from "./components/Sidebar";
import { useLocation, navigate } from "./components/routing/router";
import { LoginPage } from "./components/auth/LoginPage";
import { RegisterPage } from "./components/auth/RegisterPage";
import { ForgotPasswordPage } from "./components/auth/ForgotPasswordPage";
import { PublicLayout } from "./components/public/PublicLayout";
import { PublicHeader } from "./components/public/PublicHeader";
import { FeatureProvider } from "./context/FeatureContext";
import { RequireFeature } from "./components/routing/RequireFeature";
import { FEATURES } from "./config/features";
import { ConfirmationModal } from "./components/ConfirmationModal";

// Lazy load heavy components for better code splitting
const ProjectManager = React.lazy(() => import('./components/ProjectManager').then(m => ({ default: m.ProjectManager })));
const Dashboard = React.lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const ProjectLayout = React.lazy(() => import('./components/ProjectLayout').then(m => ({ default: m.ProjectLayout })));
const Contacts = React.lazy(() => import('./components/Contacts').then(m => ({ default: m.Contacts })));
const Settings = React.lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const ProjectOverview = React.lazy(() => import('./components/ProjectOverview').then(m => ({ default: m.ProjectOverview })));
import {
  View,
  ProjectTab,
  Project,
  ProjectStatus,
  DemandCategory,
  ProjectDetails,
  Subcontractor,
  StatusConfig,
  Bid,
} from "./types";
import { supabase } from "./services/supabase";
import {
  mergeContacts,
  syncContactsFromUrl,
} from "./services/contactsImportService";
import { loadContactStatuses } from "./services/contactStatusService";
import { 
  getDemoData, 
  saveDemoData, 
  DEMO_PROJECT, 
  DEMO_PROJECT_DETAILS, 
  DEMO_CONTACTS, 
  DEMO_STATUSES 
} from "./services/demoData";

// Default statuses (keep these as they're configuration)
const DEFAULT_STATUSES: StatusConfig[] = [
  { id: "available", label: "K dispozici", color: "green" },
  { id: "busy", label: "Zaneprázdněn", color: "red" },
  { id: "waiting", label: "Čeká", color: "yellow" },
];

// Admin role configuration (highest role in app)
const ADMIN_EMAILS = ["martinkalkus82@gmail.com", "kalkus@baustav.cz"];

// Helper function to check admin status
const isUserAdmin = (email: string | undefined): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email);
};

// Helper to convert Hex to RGB for Tailwind
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(
      result[3],
      16
    )
    } `
    : "96 122 251"; // Default Fallback
};

const APP_BASE = "/app";

const isProjectTab = (val: string | null): val is ProjectTab => {
  return val === "overview" || val === "tender-plan" || val === "pipeline" || val === "documents";
};

const buildAppUrl = (view: View, opts?: { projectId?: string; tab?: ProjectTab; categoryId?: string | null }) => {
  switch (view) {
    case "dashboard":
      return `${APP_BASE}/dashboard`;
    case "contacts":
      return `${APP_BASE}/contacts`;
    case "settings":
      return `${APP_BASE}/settings`;
    case "project-management":
      return `${APP_BASE}/projects`;
    case "project-overview":
      return `${APP_BASE}/project-overview`;
    case "project": {
      if (!opts?.projectId) return `${APP_BASE}/dashboard`;
      const params = new URLSearchParams();
      if (opts.tab) params.set("tab", opts.tab);
      if (opts.categoryId) params.set("categoryId", opts.categoryId);
      const qs = params.toString();
      return `${APP_BASE}/project/${encodeURIComponent(opts.projectId)}${qs ? `?${qs}` : ""}`;
    }
    default:
      return `${APP_BASE}/dashboard`;
  }
};

const parseAppRoute = (pathname: string, search: string) => {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "app") return { isApp: false as const };

  if (parts.length === 1) {
    return { isApp: true as const, redirectTo: `${APP_BASE}/dashboard` };
  }

  const sub = parts[1];
  if (sub === "dashboard") return { isApp: true as const, view: "dashboard" as const };
  if (sub === "contacts") return { isApp: true as const, view: "contacts" as const };
  if (sub === "settings") return { isApp: true as const, view: "settings" as const };
  if (sub === "projects") return { isApp: true as const, view: "project-management" as const };
  if (sub === "project-overview") return { isApp: true as const, view: "project-overview" as const };

  if (sub === "project") {
    const projectId = parts[2] ? decodeURIComponent(parts[2]) : "";
    const params = new URLSearchParams(search);
    const tabParam = params.get("tab");
    const categoryIdParam = params.get("categoryId");
    return {
      isApp: true as const,
      view: "project" as const,
      projectId,
      tab: isProjectTab(tabParam) ? tabParam : undefined,
      categoryId: categoryIdParam || undefined,
    };
  }

  return { isApp: true as const, redirectTo: `${APP_BASE}/dashboard` };
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const withTimeout = async <T,>(promise: PromiseLike<T>, ms: number, message?: string): Promise<T> => {
  let timeoutId: number | null = null;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error(message || `Timeout after ${ms}ms`));
        }, ms);
      }),
    ]);
  } finally {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  }
};

const withRetry = async <T,>(
  fn: () => Promise<T>,
  opts?: { retries?: number; baseDelayMs?: number }
): Promise<T> => {
  const retries = opts?.retries ?? 1;
  const baseDelayMs = opts?.baseDelayMs ?? 300;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= retries) break;
      await sleep(baseDelayMs * Math.pow(2, attempt));
    }
  }
  throw lastError;
};

const AppContent: React.FC = () => {
  const {
    isAuthenticated,
    updatePreferences,
    user,
    isLoading: authLoading,
  } = useAuth();
  const { pathname, search } = useLocation();
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const lastRefreshTime = useRef<number>(Date.now());
  const loadSeqRef = useRef(0);

  // Data States
  const [projects, setProjects] = useState<Project[]>([]);
  const [allProjectDetails, setAllProjectDetails] = useState<
    Record<string, ProjectDetails>
  >({});
  const [contacts, setContacts] = useState<Subcontractor[]>([]);
  const [contactStatuses, setContactStatuses] =
    useState<StatusConfig[]>(DEFAULT_STATUSES);

  // UI States
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [activeProjectTab, setActiveProjectTab] =
    useState<ProjectTab>("overview");
  const [activePipelineCategoryId, setActivePipelineCategoryId] = useState<string | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [appLoadProgress, setAppLoadProgress] = useState<{ percent: number; label?: string } | null>(null);
  const [slowLoadWarning, setSlowLoadWarning] = useState(false);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [backgroundWarning, setBackgroundWarning] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [uiModal, setUiModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'danger' | 'info' | 'success';
    confirmLabel?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info',
    confirmLabel: 'Zavřít',
  });

  const showUiModal = (opts: {
    title: string;
    message: string;
    variant?: 'danger' | 'info' | 'success';
    confirmLabel?: string;
  }) => {
    setUiModal({
      isOpen: true,
      title: opts.title,
      message: opts.message,
      variant: opts.variant ?? 'info',
      confirmLabel: opts.confirmLabel ?? 'Zavřít',
    });
  };

  const handleNavigateToProject = (projectId: string, tab: string, categoryId?: string) => {
    const nextTab: ProjectTab = tab === "pipeline" ? "pipeline" : "overview";
    navigate(buildAppUrl("project", { projectId, tab: nextTab, categoryId: categoryId ?? null }));
  };

  // Theme Management
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window !== "undefined") {
      const storedTheme = localStorage.getItem('theme');
      if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
        return storedTheme;
      }
      // Fallback for migration: check old darkMode key
      const oldDarkMode = localStorage.getItem('darkMode');
      if (oldDarkMode !== null) {
        return oldDarkMode === 'true' ? 'dark' : 'light';
      }
      return 'system';
    }
    return 'system';
  });

  // Theme Color Management
  const [primaryColor, setPrimaryColor] = useState("#607AFB");
  const [backgroundColor, setBackgroundColor] = useState("#f5f6f8");

  // Responsive Sidebar Management
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync preferences from user profile
  useEffect(() => {
    console.log("[App.tsx] User preferences changed:", user?.preferences);
    if (user?.preferences) {
      console.log("[App.tsx] Applying preferences:", {
        theme: user.preferences.theme,
        primaryColor: user.preferences.primaryColor,
        backgroundColor: user.preferences.backgroundColor,
      });
      // Handle legacy user preferences if they exist
      if ((user.preferences as any).darkMode !== undefined && !user.preferences.theme) {
         setTheme((user.preferences as any).darkMode ? 'dark' : 'light');
      } else {
         setTheme(user.preferences.theme || 'system');
      }
      setPrimaryColor(user.preferences.primaryColor);
      setBackgroundColor(user.preferences.backgroundColor);
      console.log("[App.tsx] Preferences applied successfully");
    } else {
      console.log("[App.tsx] No user preferences to apply");
    }
  }, [user]);

  useEffect(() => {
    const applyTheme = () => {
      const isDark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    applyTheme();

    // Listen for system changes if theme is system
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme();
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
      }
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, [theme]);

  // Update CSS Variable when color changes
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--color-primary",
      hexToRgb(primaryColor)
    );
  }, [primaryColor]);

  // Update Background CSS Variable
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--color-background",
      backgroundColor
    );
  }, [backgroundColor]);

  // Sync internal state from URL (enables refresh + back button navigation inside the app)
  useEffect(() => {
    if (!isAuthenticated) return;

    const parsed = parseAppRoute(pathname, search);
    if (!parsed.isApp) return;
    if ("redirectTo" in parsed) {
      navigate(parsed.redirectTo, { replace: true });
      return;
    }

    if (parsed.view && parsed.view !== currentView) {
      setCurrentView(parsed.view);
    }

    if (parsed.view === "project") {
      if (!parsed.projectId) {
        navigate(buildAppUrl("dashboard"), { replace: true });
        return;
      }
      if (parsed.projectId !== selectedProjectId) setSelectedProjectId(parsed.projectId);
      const nextTab = parsed.tab ?? "overview";
      if (nextTab !== activeProjectTab) setActiveProjectTab(nextTab);
      const nextCategoryId = parsed.categoryId ?? null;
      if (nextCategoryId !== activePipelineCategoryId) setActivePipelineCategoryId(nextCategoryId);
    }
  }, [activePipelineCategoryId, activeProjectTab, currentView, isAuthenticated, pathname, search, selectedProjectId]);

  // Load data from Supabase on mount
  useEffect(() => {
    let slowTimerId: number | null = null;

    const load = async () => {
      if (isAuthenticated) {
        setSlowLoadWarning(false);
        slowTimerId = window.setTimeout(() => {
          setSlowLoadWarning(true);
        }, 12000);
        await loadInitialData();
        if (slowTimerId !== null) window.clearTimeout(slowTimerId);
      } else if (!authLoading) {
        setIsDataLoading(false);
      }
    };

    load();

    return () => {
      if (slowTimerId !== null) window.clearTimeout(slowTimerId);
    };
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (authLoading) return;

    const isAppPath = pathname === "/app" || pathname.startsWith("/app/");
    const isAuthPath =
      pathname === "/login" ||
      pathname === "/register" ||
      pathname === "/forgot-password";

    const decodeNext = (val: string | null) => {
      if (!val) return null;
      try {
        const once = decodeURIComponent(val);
        if (once.startsWith("%2F")) return decodeURIComponent(once);
        return once;
      } catch {
        return val;
      }
    };

    if (!isAuthenticated && isAppPath) {
      const next = encodeURIComponent(`${pathname}${search || ""}`);
      navigate(`/login?next=${next}`, { replace: true });
      return;
    }

    if (isAuthenticated && (pathname === "/" || isAuthPath)) {
      const nextParam = decodeNext(new URLSearchParams(search).get("next"));
      const safeNext = nextParam?.startsWith("/") ? nextParam : buildAppUrl("dashboard");
      navigate(safeNext, { replace: true });
      return;
    }

    if (isAuthenticated && !isAppPath) {
      navigate(buildAppUrl("dashboard"), { replace: true });
    }
  }, [authLoading, isAuthenticated, pathname, search]);

  // Smart Data Refresh on Visibility Change - DISABLED due to auth instability
  // useEffect(() => {
  //   const handleVisibilityChange = async () => {
  //     if (document.visibilityState === 'visible' && isAuthenticated) {
  //       const now = Date.now();
  //       // 1 minute threshold to refresh data if tab was backgrounded
  //       if (now - lastRefreshTime.current > 60 * 1000) {
  //           console.log('[App] Returning to active tab, refreshing data silently...');
  //           await loadInitialData(true); // silent refresh
  //           lastRefreshTime.current = now;
  //       }
  //     }
  //   };
  // 
  //   document.addEventListener('visibilitychange', handleVisibilityChange);
  //   return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  // }, [isAuthenticated]);

  const loadInitialData = async (silent = false) => {
    const seq = ++loadSeqRef.current;
    const isCurrent = () => loadSeqRef.current === seq;
    const safe = (fn: () => void) => {
      if (!isCurrent()) return;
      fn();
    };

    safe(() => {
      setBackgroundWarning(null);
    });

    if (!silent) {
      safe(() => {
        setIsDataLoading(true); // bootstrap loader only
        setLoadingError(null);
        setAppLoadProgress({ percent: 0, label: "Připravuji…" });
      });
    }

    console.log("Starting loadInitialData...", { silent, seq });

    const progress = (() => {
      let totalOps = 1;
      let completedOps = 0;
      const setTotalOps = (n: number) => {
        totalOps = Math.max(1, n);
        if (!silent) {
          safe(() =>
            setAppLoadProgress((prev) =>
              prev
                ? {
                    ...prev,
                    percent: Math.min(99, Math.round((completedOps / totalOps) * 100)),
                  }
                : prev
            )
          );
        }
      };
      const tick = (label?: string, inc = 1) => {
        completedOps += inc;
        if (!silent) {
          safe(() =>
            setAppLoadProgress({
              percent: Math.min(99, Math.round((completedOps / totalOps) * 100)),
              label,
            })
          );
        }
      };
      const done = () => {
        if (!silent) safe(() => setAppLoadProgress({ percent: 100, label: "Hotovo" }));
      };
      const track = async <T,>(promise: PromiseLike<T>, label?: string): Promise<T> => {
        const result = await promise;
        tick(label);
        return result;
      };
      return { setTotalOps, tick, done, track };
    })();

    const backgroundWarn = (message: string, err: unknown) => {
      console.error(message, err);
      safe(() => setBackgroundWarning(message));
    };

    try {
      progress.setTotalOps(3);

      const sessionResult = await progress.track(
        withRetry(
          () =>
            withTimeout(
              Promise.resolve(supabase.auth.getSession()),
              8000,
              "Ověření přihlášení vypršelo"
            ),
          { retries: 1 }
        ),
        "Ověřuji přihlášení…"
      );

      if (sessionResult?.data?.session?.user) {
        safe(() => setIsAdmin(user?.role === "demo" || isUserAdmin(sessionResult.data.session.user.email)));
      }

      // Demo mode is instant (no network)
      if (user?.role === "demo") {
        let demoData = getDemoData();
        if (!demoData) {
          demoData = {
            projects: [DEMO_PROJECT],
            projectDetails: { [DEMO_PROJECT.id]: DEMO_PROJECT_DETAILS },
            contacts: DEMO_CONTACTS,
            statuses: DEMO_STATUSES,
          };
          saveDemoData(demoData);
        }

        safe(() => {
          setProjects(demoData.projects);
          setAllProjectDetails(demoData.projectDetails);
          setContacts(demoData.contacts);
          setContactStatuses(demoData.statuses);
          if (demoData.projects.length > 0 && !selectedProjectId) setSelectedProjectId(demoData.projects[0].id);
        });

        progress.done();
        return;
      }

      // ---- BOOTSTRAP PHASE (fast): projects list + permissions ----
      const [projectsResponse, metadataResponse] = await Promise.all([
        progress.track(
          withRetry(
            () =>
              withTimeout(
                Promise.resolve(
                  supabase.from("projects").select("*").order("created_at", { ascending: false })
                ),
                12000,
                "Načtení projektů vypršelo"
              ),
            { retries: 1 }
          ),
          "Načítám projekty…"
        ),
        progress.track(
          withRetry(
            () =>
              withTimeout(
                Promise.resolve(supabase.rpc("get_projects_metadata")),
                12000,
                "Načtení oprávnění vypršelo"
              ),
            { retries: 1 }
          ),
          "Načítám oprávnění…"
        ),
      ]);

      if (projectsResponse.error) throw projectsResponse.error;

      const projectsData = (projectsResponse.data || []) as any[];
      const metadata =
        (metadataResponse.data as { project_id: string; owner_email: string; shared_with_emails: string[] }[]) ||
        [];

      const metadataMap = new Map<string, { owner: string; shared: string[] }>();
      metadata.forEach((m) => metadataMap.set(m.project_id, { owner: m.owner_email, shared: m.shared_with_emails || [] }));

      const loadedProjects: Project[] = projectsData.map((p) => {
        const meta = metadataMap.get(p.id);
        return {
          id: p.id,
          name: p.name,
          location: p.location || "",
          status: p.status || "realization",
          isDemo: p.is_demo,
          ownerId: p.owner_id,
          ownerEmail: meta?.owner,
          sharedWith: meta?.shared,
        };
      });

      safe(() => {
        setProjects(loadedProjects);
        if (!silent) {
          // Clear old heavy data; it will hydrate progressively again.
          setAllProjectDetails({});
        }
        if (loadedProjects.length > 0 && !selectedProjectId) setSelectedProjectId(loadedProjects[0].id);
      });

      // Unblock the app UI as soon as the project list is available.
      progress.done();
      safe(() => {
        if (!silent) {
          setIsDataLoading(false);
          setAppLoadProgress(null);
        }
      });

      // ---- BACKGROUND PHASE (slow): hydrate details + bids + contacts + statuses ----
      safe(() => {
        setIsBackgroundLoading(true);
        setBackgroundWarning(null);
      });

      const fetchProjectDetails = async (project: any): Promise<ProjectDetails> => {
        const [
          categoriesRes,
          contractRes,
          financialsRes,
          amendmentsRes,
        ] = await Promise.all([
          withRetry(
            () =>
              withTimeout(
                Promise.resolve(
                  supabase.from("demand_categories").select("*").eq("project_id", project.id)
                ),
                12000,
                `Načtení kategorií vypršelo (${project.name})`
              ),
            { retries: 1 }
          ),
          withRetry(
            () =>
              withTimeout(
                Promise.resolve(
                  supabase.from("project_contracts").select("*").eq("project_id", project.id).maybeSingle()
                ),
                12000,
                `Načtení smlouvy vypršelo (${project.name})`
              ),
            { retries: 1 }
          ),
          withRetry(
            () =>
              withTimeout(
                Promise.resolve(
                  supabase
                    .from("project_investor_financials")
                    .select("*")
                    .eq("project_id", project.id)
                    .maybeSingle()
                ),
                12000,
                `Načtení financí vypršelo (${project.name})`
              ),
            { retries: 1 }
          ),
          withRetry(
            () =>
              withTimeout(
                Promise.resolve(
                  supabase.from("project_amendments").select("*").eq("project_id", project.id)
                ),
                12000,
                `Načtení dodatků vypršelo (${project.name})`
              ),
            { retries: 1 }
          ),
        ]);

        if (categoriesRes.error) throw categoriesRes.error;
        if (contractRes.error) throw contractRes.error;
        if (financialsRes.error) throw financialsRes.error;
        if (amendmentsRes.error) throw amendmentsRes.error;

        const categories: DemandCategory[] = (categoriesRes.data || []).map((c: any) => ({
          id: c.id,
          title: c.title,
          budget: c.budget_display || "",
          sodBudget: c.sod_budget || 0,
          planBudget: c.plan_budget || 0,
          status: c.status || "open",
          subcontractorCount: 0,
          description: c.description || "",
          deadline: c.deadline || undefined,
          realizationStart: c.realization_start || undefined,
          realizationEnd: c.realization_end || undefined,
        }));

        const contractData = contractRes.data as any | null;
        const financialsData = financialsRes.data as any | null;
        const amendmentsData = (amendmentsRes.data || []) as any[];

        return {
          id: project.id,
          title: project.name,
          status: project.status || "realization",
          investor: project.investor || "",
          technicalSupervisor: project.technical_supervisor || "",
          location: project.location || "",
          finishDate: project.finish_date || "",
          siteManager: project.site_manager || "",
          constructionManager: project.construction_manager || "",
          constructionTechnician: project.construction_technician || "",
          plannedCost: project.planned_cost || 0,
          documentationLink: project.documentation_link,
          inquiryLetterLink: project.inquiry_letter_link,
          docHubEnabled: project.dochub_enabled ?? false,
          docHubRootLink: project.dochub_root_link ?? "",
          docHubProvider: project.dochub_provider ?? null,
          docHubMode: project.dochub_mode ?? null,
          docHubRootId: project.dochub_root_id ?? null,
          docHubRootName: project.dochub_root_name ?? null,
          docHubDriveId: project.dochub_drive_id ?? null,
          docHubSiteId: project.dochub_site_id ?? null,
          docHubRootWebUrl: project.dochub_root_web_url ?? null,
          docHubStatus: project.dochub_status ?? (project.dochub_root_link ? "connected" : "disconnected"),
          docHubLastError: project.dochub_last_error ?? null,
          docHubStructureV1: project.dochub_structure_v1 ?? null,
          docHubStructureVersion: project.dochub_structure_version ?? 1,
          docHubAutoCreateEnabled: project.dochub_autocreate_enabled ?? false,
          docHubAutoCreateLastRunAt: project.dochub_autocreate_last_run_at ?? null,
          docHubAutoCreateLastError: project.dochub_autocreate_last_error ?? null,
          categories,
          contract: contractData
            ? {
                maturity: contractData.maturity_days ?? 30,
                warranty: contractData.warranty_months ?? 60,
                retention: contractData.retention_terms || "",
                siteFacilities: contractData.site_facilities_percent ?? 0,
                insurance: contractData.insurance_percent ?? 0,
              }
            : undefined,
          investorFinancials: financialsData
            ? {
                sodPrice: financialsData.sod_price || 0,
                amendments: amendmentsData.map((a) => ({
                  id: a.id,
                  label: a.label,
                  price: a.price || 0,
                })),
              }
            : undefined,
        };
      };

      const projectsToHydrate = [...projectsData];
      if (selectedProjectId) {
        projectsToHydrate.sort((a, b) => (a.id === selectedProjectId ? -1 : b.id === selectedProjectId ? 1 : 0));
      }

      // Hydrate project details progressively (so UI fills in quickly)
      for (const project of projectsToHydrate) {
        if (!isCurrent()) return;
        try {
          const details = await fetchProjectDetails(project);
          safe(() =>
            setAllProjectDetails((prev) => ({
              ...prev,
              [project.id]: details,
            }))
          );
        } catch (err) {
          backgroundWarn(`Nepodařilo se načíst detail projektu (${project.name}).`, err);
        }
      }

      // Load bids (single request) and merge into already loaded details
      try {
        const bidsRes = await withRetry(
          () =>
            withTimeout(Promise.resolve(supabase.from("bids").select("*")), 15000, "Načtení nabídek vypršelo"),
          { retries: 1 }
        );
        if (bidsRes.error) throw bidsRes.error;
        const bidsData = (bidsRes.data || []) as any[];

        safe(() => {
          setAllProjectDetails((prev) => {
            const bidsByProject: Record<string, Record<string, Bid[]>> = {};
            const categoryProjectMap: Record<string, string> = {};
            Object.entries(prev).forEach(([projectId, details]) => {
              details.categories.forEach((cat) => {
                categoryProjectMap[cat.id] = projectId;
              });
            });

            bidsData.forEach((bid) => {
              const projectId = categoryProjectMap[bid.demand_category_id];
              if (!projectId) return;
              if (!bidsByProject[projectId]) bidsByProject[projectId] = {};
              if (!bidsByProject[projectId][bid.demand_category_id]) bidsByProject[projectId][bid.demand_category_id] = [];

              bidsByProject[projectId][bid.demand_category_id].push({
                id: bid.id,
                subcontractorId: bid.subcontractor_id,
                companyName: bid.company_name,
                contactPerson: bid.contact_person,
                email: bid.email,
                phone: bid.phone,
                price: bid.price_display || (bid.price ? bid.price.toString() : null),
                priceHistory: bid.price_history || undefined,
                notes: bid.notes,
                tags: bid.tags,
                status: bid.status,
                updateDate: bid.update_date,
                selectionRound: bid.selection_round,
                contracted: bid.contracted || false,
              });
            });

            const next = { ...prev };
            Object.keys(next).forEach((pid) => {
              if (bidsByProject[pid]) {
                next[pid] = { ...next[pid], bids: bidsByProject[pid] };
              }
            });
            return next;
          });
        });
      } catch (err) {
        backgroundWarn("Nepodařilo se načíst nabídky.", err);
      }

      // Load subcontractors (contacts) + statuses in parallel
      await Promise.all([
        (async () => {
          try {
            const subcontractorsRes = await withRetry(
              () =>
                withTimeout(
                  Promise.resolve(supabase.from("subcontractors").select("*").order("company_name")),
                  15000,
                  "Načtení dodavatelů vypršelo"
                ),
              { retries: 1 }
            );
            if (subcontractorsRes.error) throw subcontractorsRes.error;

            const subcontractorsData = (subcontractorsRes.data || []) as any[];
            const loadedContacts: Subcontractor[] = subcontractorsData.map((s) => {
              const specArray = Array.isArray(s.specialization)
                ? s.specialization
                : s.specialization
                  ? [s.specialization]
                  : ["Ostatní"];

              let contactsArray: any[] = Array.isArray(s.contacts) ? s.contacts : [];
              if (contactsArray.length === 0 && (s.contact_person_name || s.phone || s.email)) {
                contactsArray = [
                  {
                    id: crypto.randomUUID(),
                    name: s.contact_person_name || "-",
                    phone: s.phone || "-",
                    email: s.email || "-",
                    position: "Hlavní kontakt",
                  },
                ];
              }

              return {
                id: s.id,
                company: s.company_name,
                specialization: specArray.length > 0 ? specArray : ["Ostatní"],
                contacts: contactsArray,
                ico: s.ico || "-",
                region: s.region || "-",
                status: s.status_id || "available",
                name: s.contact_person_name || "-",
                phone: s.phone || "-",
                email: s.email || "-",
              };
            });

            safe(() => setContacts(loadedContacts));
          } catch (err) {
            backgroundWarn("Nepodařilo se načíst dodavatele.", err);
          }
        })(),
        (async () => {
          try {
            const statuses = await withRetry(
              () => withTimeout(loadContactStatuses(), 12000, "Načtení stavů kontaktů vypršelo"),
              { retries: 1 }
            );
            safe(() => setContactStatuses(statuses));
          } catch (err) {
            backgroundWarn("Nepodařilo se načíst stavy kontaktů.", err);
          }
        })(),
      ]);
    } catch (error) {
      console.error("Error loading initial data:", error);
      if (!silent) {
        const anyError = error as any;
        const detailParts = [
          anyError?.message ? `message=${anyError.message}` : null,
          anyError?.code ? `code=${anyError.code}` : null,
          anyError?.details ? `details=${anyError.details}` : null,
          anyError?.hint ? `hint=${anyError.hint}` : null,
        ].filter(Boolean);

        safe(() =>
          setLoadingError(
            detailParts.length > 0
              ? `Nepodařilo se načíst data (${detailParts.join(", ")}).`
              : "Nepodařilo se načíst data. Zkuste obnovit stránku."
          )
        );
      } else {
        backgroundWarn("Nepodařilo se obnovit data na pozadí.", error);
      }
    } finally {
      safe(() => {
        if (!silent) {
          setIsDataLoading(false);
          setAppLoadProgress(null);
        }
        setIsBackgroundLoading(false);
      });
      lastRefreshTime.current = Date.now();
    }
  };

  const handleProjectSelect = (id: string) => {
    navigate(buildAppUrl("project", { projectId: id, tab: "overview" }));
  };

  // If the URL points to a project that doesn't exist (or was deleted), fall back safely.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (currentView !== "project") return;
    if (!projects.length) return;
    if (selectedProjectId && projects.some((p) => p.id === selectedProjectId)) return;

    const fallbackId = (projects.find((p) => p.status !== "archived") || projects[0]).id;
    navigate(buildAppUrl("project", { projectId: fallbackId, tab: activeProjectTab }), { replace: true });
  }, [activeProjectTab, currentView, isAuthenticated, projects, selectedProjectId]);

  const handleAddProject = async (newProject: Project) => {
    // Optimistic update
    setProjects((prev) => [newProject, ...prev]);

    // Initialize details
    setAllProjectDetails((prev) => ({
      ...prev,
      [newProject.id]: {
        title: newProject.name,
        investor: "",
        technicalSupervisor: "",
        location: newProject.location,
        finishDate: "TBD",
        siteManager: "TBD",
        constructionManager: "",
        constructionTechnician: "",
        plannedCost: 0,
        categories: [],
        contract: {
          maturity: 30,
          warranty: 60,
          retention: "0 %",
          siteFacilities: 0,
          insurance: 0,
        },
        investorFinancials: {
          sodPrice: 0,
          amendments: [],
        },
        bids: {},
      },
    }));

    // Persist to Supabase or Demo Storage
    try {
      if (user?.role === 'demo') {
        const demoData = getDemoData();
        if (demoData) {
          demoData.projects = [newProject, ...demoData.projects];
          demoData.projectDetails[newProject.id] = {
            title: newProject.name,
            investor: "",
            technicalSupervisor: "",
            location: newProject.location,
            finishDate: "TBD",
            siteManager: "TBD",
            constructionManager: "",
            constructionTechnician: "",
            plannedCost: 0,
            categories: [],
            contract: {
              maturity: 30,
              warranty: 60,
              retention: "0 %",
              siteFacilities: 0,
              insurance: 0,
            },
            investorFinancials: {
              sodPrice: 0,
              amendments: [],
            },
            bids: {},
          };
          saveDemoData(demoData);
        }
        return;
      }

      const { error } = await supabase.from("projects").insert({
        id: newProject.id,
        name: newProject.name,
        location: newProject.location,
        status: newProject.status,
        owner_id: user?.id
      });

      if (error) {
        console.error("Error creating project:", error);
        // Revert optimistic update?
      }
    } catch (err) {
      console.error("Unexpected error creating project:", err);
    }
  };

  const handleDeleteProject = async (id: string) => {
    // Optimistic update
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (selectedProjectId === id) {
      navigate(buildAppUrl("dashboard"), { replace: true });
    }

    // Persist to Supabase or Demo Storage
    try {
      if (user?.role === 'demo') {
        const demoData = getDemoData();
        if (demoData) {
          demoData.projects = demoData.projects.filter((p: Project) => p.id !== id);
          delete demoData.projectDetails[id];
          saveDemoData(demoData);
        }
        return;
      }

      const projectToDelete = projects.find(p => p.id === id);

      if (projectToDelete?.isDemo) {
        // For Demo projects, we don't delete, we hide them for this user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase.from("user_hidden_projects").insert({
            user_id: user.id,
            project_id: id
          });
          if (error) console.error("Error hiding demo project:", error);
        }
      } else {
        // Normal delete
        const { error } = await supabase.from("projects").delete().eq("id", id);
        if (error) console.error("Error deleting project:", error);
      }
    } catch (err) {
      console.error("Unexpected error deleting project:", err);
    }
  };

  const handleArchiveProject = async (id: string) => {
    // Find the project to determine current status
    const project = projects.find(p => p.id === id);
    if (!project) return;

    // Toggle: if archived, restore to 'realization'; otherwise archive
    const newStatus = project.status === 'archived' ? 'realization' : 'archived';

    // Optimistic update
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
    );

    // Persist to Supabase or Demo Storage
    try {
      if (user?.role === 'demo') {
        const demoData = getDemoData();
        if (demoData) {
          demoData.projects = demoData.projects.map((p: Project) => 
            p.id === id ? { ...p, status: newStatus } : p
          );
          if (demoData.projectDetails[id]) {
            demoData.projectDetails[id].status = newStatus;
          }
          saveDemoData(demoData);
        }
        return;
      }

      const { error } = await supabase
        .from("projects")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) console.error("Error updating project status:", error);
    } catch (err) {
      console.error("Unexpected error updating project status:", err);
    }
  };

  const handleUpdateProjectDetails = async (
    id: string,
    updates: Partial<ProjectDetails>
  ) => {
    // Optimistic update
    setAllProjectDetails((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...updates },
    }));

    // Persist to Supabase or Demo Storage
    try {
      if (user?.role === "demo") {
        const demoData = getDemoData();
        if (demoData) {
          demoData.projectDetails[id] = { ...demoData.projectDetails[id], ...updates };
          if (updates.title || updates.location || updates.status) {
            demoData.projects = demoData.projects.map((p: Project) =>
              p.id === id
                ? {
                  ...p,
                  name: updates.title ?? p.name,
                  location: updates.location ?? p.location,
                  status: updates.status ?? p.status
                }
                : p
            );
          }
          saveDemoData(demoData);
        }
        return;
      }

      // Update main project fields
      const projectUpdates: any = {};
      if (updates.investor !== undefined)
        projectUpdates.investor = updates.investor;
      if (updates.technicalSupervisor !== undefined)
        projectUpdates.technical_supervisor = updates.technicalSupervisor;
      if (updates.siteManager !== undefined)
        projectUpdates.site_manager = updates.siteManager;
      if (updates.constructionManager !== undefined)
        projectUpdates.construction_manager = updates.constructionManager;
      if (updates.constructionTechnician !== undefined)
        projectUpdates.construction_technician = updates.constructionTechnician;
      if (updates.location !== undefined)
        projectUpdates.location = updates.location;
      if (updates.finishDate !== undefined)
        projectUpdates.finish_date = updates.finishDate;
      if (updates.plannedCost !== undefined)
        projectUpdates.planned_cost = updates.plannedCost;
      if (updates.documentationLink !== undefined)
        projectUpdates.documentation_link = updates.documentationLink;
      if (updates.inquiryLetterLink !== undefined)
        projectUpdates.inquiry_letter_link = updates.inquiryLetterLink;
      if (updates.docHubEnabled !== undefined)
        projectUpdates.dochub_enabled = updates.docHubEnabled;
      if (updates.docHubRootLink !== undefined)
        projectUpdates.dochub_root_link = updates.docHubRootLink;
      if (updates.docHubProvider !== undefined)
        projectUpdates.dochub_provider = updates.docHubProvider;
      if (updates.docHubMode !== undefined)
        projectUpdates.dochub_mode = updates.docHubMode;
      if (updates.docHubRootId !== undefined)
        projectUpdates.dochub_root_id = updates.docHubRootId;
      if (updates.docHubRootName !== undefined)
        projectUpdates.dochub_root_name = updates.docHubRootName;
      if (updates.docHubDriveId !== undefined)
        projectUpdates.dochub_drive_id = updates.docHubDriveId;
      if (updates.docHubSiteId !== undefined)
        projectUpdates.dochub_site_id = updates.docHubSiteId;
      if (updates.docHubRootWebUrl !== undefined)
        projectUpdates.dochub_root_web_url = updates.docHubRootWebUrl;
      if (updates.docHubStatus !== undefined)
        projectUpdates.dochub_status = updates.docHubStatus;
      if (updates.docHubLastError !== undefined)
        projectUpdates.dochub_last_error = updates.docHubLastError;
      if (updates.docHubStructureV1 !== undefined)
        projectUpdates.dochub_structure_v1 = updates.docHubStructureV1;
      if (updates.docHubStructureVersion !== undefined)
        projectUpdates.dochub_structure_version = updates.docHubStructureVersion;
      if (updates.docHubAutoCreateEnabled !== undefined)
        projectUpdates.dochub_autocreate_enabled = updates.docHubAutoCreateEnabled;
      if (updates.docHubAutoCreateLastRunAt !== undefined)
        projectUpdates.dochub_autocreate_last_run_at = updates.docHubAutoCreateLastRunAt;
      if (updates.docHubAutoCreateLastError !== undefined)
        projectUpdates.dochub_autocreate_last_error = updates.docHubAutoCreateLastError;

      if (Object.keys(projectUpdates).length > 0) {
        const { error } = await supabase
          .from("projects")
          .update(projectUpdates)
          .eq("id", id);

        if (error) console.error("Error updating project:", error);
      }

      // Update contract if provided
      if (updates.contract) {
        console.log('[App] Saving contract updates:', updates.contract);
        const { error: contractError } = await supabase
          .from("project_contracts")
          .upsert({
            project_id: id,
            maturity_days: updates.contract.maturity,
            warranty_months: updates.contract.warranty,
            retention_terms: updates.contract.retention,
            site_facilities_percent: updates.contract.siteFacilities,
            insurance_percent: updates.contract.insurance,
          });

        if (contractError)
          console.error("Error updating contract:", contractError);
      }

      // Update investor financials if provided
      if (updates.investorFinancials) {
        const { error: financialsError } = await supabase
          .from("project_investor_financials")
          .upsert({
            project_id: id,
            sod_price: updates.investorFinancials.sodPrice,
          });

        if (financialsError)
          console.error("Error updating financials:", financialsError);

        // Handle amendments (delete and re-insert for simplicity)
        if (updates.investorFinancials.amendments) {
          await supabase
            .from("project_amendments")
            .delete()
            .eq("project_id", id);

          if (updates.investorFinancials.amendments.length > 0) {
            const { error: amendmentsError } = await supabase
              .from("project_amendments")
              .insert(
                updates.investorFinancials.amendments.map((a) => ({
                  id: a.id,
                  project_id: id,
                  label: a.label,
                  price: a.price,
                }))
              );

            if (amendmentsError)
              console.error("Error updating amendments:", amendmentsError);
          }
        }
      }
    } catch (error) {
      console.error("Unexpected error updating project details:", error);
    }
  };

  const handleAddCategory = async (
    projectId: string,
    newCategory: DemandCategory
  ) => {
    // Optimistic update to local state
    setAllProjectDetails((prev) => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        categories: [...prev[projectId].categories, newCategory],
      },
    }));

    // Persist to Supabase or Demo Storage
    try {
      if (user?.role === 'demo') {
        const demoData = getDemoData();
        if (demoData && demoData.projectDetails[projectId]) {
          demoData.projectDetails[projectId].categories = [
            ...demoData.projectDetails[projectId].categories,
            newCategory,
          ];
          saveDemoData(demoData);
        }
        return;
      }

      const { error } = await supabase.from("demand_categories").insert({
        id: newCategory.id,
        project_id: projectId,
        title: newCategory.title,
        budget_display: newCategory.budget,
        sod_budget: newCategory.sodBudget,
        plan_budget: newCategory.planBudget,
        status: newCategory.status,
        description: newCategory.description,
        deadline: newCategory.deadline || null,
        realization_start: newCategory.realizationStart || null,
        realization_end: newCategory.realizationEnd || null,
      });

      if (error) {
        console.error("Error saving category to Supabase:", error);
        // Optionally revert local state on error
      }
    } catch (err) {
      console.error("Unexpected error saving category:", err);
    }
  };

  const handleEditCategory = async (
    projectId: string,
    updatedCategory: DemandCategory
  ) => {
    // Optimistic update to local state
    setAllProjectDetails((prev) => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        categories: prev[projectId].categories.map((cat) =>
          cat.id === updatedCategory.id ? updatedCategory : cat
        ),
      },
    }));

    // Persist to Supabase or Demo Storage
    try {
      if (user?.role === 'demo') {
        const demoData = getDemoData();
        if (demoData && demoData.projectDetails[projectId]) {
          demoData.projectDetails[projectId].categories = demoData.projectDetails[projectId].categories.map(
            (cat: DemandCategory) => (cat.id === updatedCategory.id ? updatedCategory : cat)
          );
          saveDemoData(demoData);
        }
        return;
      }

      const { error } = await supabase
        .from("demand_categories")
        .update({
          title: updatedCategory.title,
          budget_display: updatedCategory.budget,
          sod_budget: updatedCategory.sodBudget,
          plan_budget: updatedCategory.planBudget,
          status: updatedCategory.status,
          description: updatedCategory.description,
          deadline: updatedCategory.deadline || null,
          realization_start: updatedCategory.realizationStart || null,
          realization_end: updatedCategory.realizationEnd || null,
        })
        .eq("id", updatedCategory.id);

      if (error) {
        console.error("Error updating category in Supabase:", error);
      }
    } catch (err) {
      console.error("Unexpected error updating category:", err);
    }
  };

  const handleDeleteCategory = async (
    projectId: string,
    categoryId: string
  ) => {
    // Optimistic update to local state
    setAllProjectDetails((prev) => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        categories: prev[projectId].categories.filter(
          (cat) => cat.id !== categoryId
        ),
      },
    }));

    // Persist to Supabase or Demo Storage
    try {
      if (user?.role === 'demo') {
        const demoData = getDemoData();
        if (demoData && demoData.projectDetails[projectId]) {
          demoData.projectDetails[projectId].categories = demoData.projectDetails[projectId].categories.filter(
            (cat: DemandCategory) => cat.id !== categoryId
          );
          saveDemoData(demoData);
        }
        return;
      }

      const { error } = await supabase
        .from("demand_categories")
        .delete()
        .eq("id", categoryId);

      if (error) {
        console.error("Error deleting category from Supabase:", error);
      }
    } catch (err) {
      console.error("Unexpected error deleting category:", err);
    }
  };

  const handleImportContacts = async (
    newContacts: Subcontractor[],
    onProgress?: (percent: number) => void
  ) => {
    const pickPrimaryContact = (c: Subcontractor) => {
      const list = c.contacts || [];
      const firstNonEmpty = list.find(
        (p) =>
          (p.email && p.email !== "-") ||
          (p.phone && p.phone !== "-") ||
          (p.name && p.name !== "-")
      );
      return firstNonEmpty || list[0] || null;
    };

    // Use the merge logic from service
    const { mergedContacts, added, updated, addedCount, updatedCount } =
      mergeContacts(contacts, newContacts);

    // Optimistic update
    setContacts(mergedContacts);

    const totalOps = (added.length > 0 ? 1 : 0) + updated.length; // 1 batch insert + N updates
    let completedOps = 0;

    const reportProgress = () => {
      if (onProgress && totalOps > 0) {
        onProgress(Math.round((completedOps / totalOps) * 100));
      }
    };

    // Persist to Supabase or Demo Storage
    try {
      if (user?.role === 'demo') {
        const demoData = getDemoData();
        if (demoData) {
          demoData.contacts = mergedContacts;
          saveDemoData(demoData);
        }
        showUiModal({
          title: "Synchronizace dokončena",
          message: `Demo režim:\n- Přidáno nových: ${addedCount}\n- Aktualizováno: ${updatedCount}\n\n(Data uložena v prohlížeči)`,
          variant: "success",
        });
        return;
      }

      console.log("Starting contact import persistence...", {
        addedCount: added.length,
        updatedCount: updated.length,
      });

      // 1. Insert new contacts
      if (added.length > 0) {
        const payload = added.map((c) => ({
          // NOTE: `c` might be a delta object from the import wizard.
          // We still persist the full merged state via `mergeContacts` and the subsequent inserts/updates.
          id: c.id,
          company_name: (c.company || "-").substring(0, 255),
          contact_person_name: (pickPrimaryContact(c)?.name || c.name || "-").substring(0, 255),
          specialization: c.specialization,
          phone: (pickPrimaryContact(c)?.phone || c.phone || "-").substring(0, 50),
          email: (pickPrimaryContact(c)?.email || c.email || "-").substring(0, 255),
          contacts: c.contacts || [],
          ico: (c.ico || "-").substring(0, 50),
          region: (c.region || "-").substring(0, 100),
          status_id: c.status,
          owner_id: user?.id,
        }));
        console.log("Inserting payload:", payload);

        const { data, error: insertError } = await supabase
          .from("subcontractors")
          .insert(payload)
          .select();

        if (insertError) {
          console.error("Error inserting contacts:", insertError);
          showUiModal({
            title: "Import selhal",
            message: `Chyba při vkládání kontaktů: ${insertError.message}`,
            variant: "danger",
          });
        } else {
          console.log("Successfully inserted contacts:", data);
          completedOps++;
          reportProgress();
        }
      }

      // 2. Update existing contacts
      if (updated.length > 0) {
        for (const contact of updated) {
          const { error: updateError } = await supabase
            .from("subcontractors")
            .update({
              company_name: contact.company,
              contact_person_name: pickPrimaryContact(contact)?.name || contact.name || "-",
              specialization: contact.specialization,
              phone: pickPrimaryContact(contact)?.phone || contact.phone || "-",
              email: pickPrimaryContact(contact)?.email || contact.email || "-",
              contacts: contact.contacts || [],
              ico: contact.ico || "-",
              region: contact.region || "-",
              status_id: contact.status,
            })
            .eq("id", contact.id);

          if (updateError) {
            console.error(
              `Error updating contact ${contact.company}: `,
              updateError
            );
          } else {
            completedOps++;
            reportProgress();
          }
        }
      }

      console.log("Import persistence completed.");
      showUiModal({
        title: "Synchronizace dokončena",
        message: `- Přidáno nových: ${addedCount}\n- Aktualizováno: ${updatedCount}`,
        variant: "success",
      });
    } catch (error: any) {
      console.error("Unexpected error persisting contacts:", error);
      showUiModal({
        title: "Import selhal",
        message: `Neočekávaná chyba při ukládání: ${error.message || error}`,
        variant: "danger",
      });
    }
  };

  const handleDeleteContacts = async (idsToDelete: string[]) => {
    if (idsToDelete.length === 0) return;

    // Optimistic update
    setContacts((prev) => prev.filter((c) => !idsToDelete.includes(c.id)));

    // Persist to Supabase or Demo Storage
    try {
      if (user?.role === 'demo') {
        const demoData = getDemoData();
        if (demoData) {
          demoData.contacts = demoData.contacts.filter((c: Subcontractor) => !idsToDelete.includes(c.id));
          saveDemoData(demoData);
        }
        return;
      }

      const { error } = await supabase
        .from("subcontractors")
        .delete()
        .in("id", idsToDelete);

      if (error) {
        console.error("Error deleting contacts:", error);
        alert("Chyba při mazání kontaktů z databáze.");
        // Revert optimistic update by reloading contacts from DB
        const { data } = await supabase.from("subcontractors").select("*");
        if (data) {
          setContacts(
            data.map((row) => ({
              id: row.id,
              company: row.company_name,
              name: row.contact_person_name,
              specialization: row.specialization || [],
              phone: row.phone,
              email: row.email,
              ico: row.ico,
              region: row.region,
              status: row.status_id,
            }))
          );
        }
      }
    } catch (error) {
      console.error("Unexpected error deleting contacts:", error);
    }
  };

  const handleAddContact = async (contact: Subcontractor) => {
    // Optimistic update
    setContacts((prev) => [contact, ...prev]);

    // Persist to Supabase or Demo Storage
    try {
      if (user?.role === 'demo') {
        const demoData = getDemoData();
        if (demoData) {
          demoData.contacts = [contact, ...demoData.contacts];
          saveDemoData(demoData);
        }
        return;
      }

      const { error } = await supabase.from("subcontractors").insert({
        id: contact.id,
        company_name: contact.company,
        contact_person_name: contact.contacts[0]?.name || "-", // Mirror for legacy DB
        specialization: contact.specialization,
        phone: contact.contacts[0]?.phone || "-", // Mirror for legacy DB
        email: contact.contacts[0]?.email || "-", // Mirror for legacy DB
        contacts: contact.contacts, // Save new JSONB array
        ico: contact.ico,
        region: contact.region,
        status_id: contact.status,
        owner_id: user?.id
      });

      if (error) {
        console.error("Error adding contact:", error);
        alert("Chyba při přidávání kontaktu do databáze.");
        alert("Chyba při přidávání kontaktu do databáze.");
        loadInitialData(true); // Revert silently
      }
    } catch (err) {
      console.error("Unexpected error adding contact:", err);
    }
  };

  const handleUpdateContact = async (contact: Subcontractor) => {
    // Optimistic update
    setContacts((prev) => prev.map((c) => (c.id === contact.id ? contact : c)));

    // Persist to Supabase or Demo Storage
    try {
      if (user?.role === 'demo') {
        const demoData = getDemoData();
        if (demoData) {
          demoData.contacts = demoData.contacts.map((c: Subcontractor) => 
            c.id === contact.id ? contact : c
          );
          saveDemoData(demoData);
        }
        return;
      }

      const { error } = await supabase
        .from("subcontractors")
        .update({
          company_name: contact.company,
          contact_person_name: contact.contacts[0]?.name || "-",
          specialization: contact.specialization,
          phone: contact.contacts[0]?.phone || "-",
          email: contact.contacts[0]?.email || "-",
          contacts: contact.contacts,
          ico: contact.ico,
          region: contact.region,
          status_id: contact.status,
        })
        .eq("id", contact.id);

      if (error) {
        console.error("Error updating contact:", error);
        alert(`Chyba při aktualizaci kontaktu: ${error.message}`);
        loadInitialData(true); // Revert silently
      }
    } catch (err) {
      console.error("Unexpected error updating contact:", err);
    }
  };

  const handleBulkUpdateContacts = async (updatedContacts: Subcontractor[]) => {
    // Optimistic update
    setContacts((prev) => {
      const newContacts = [...prev];
      updatedContacts.forEach((updated) => {
        const index = newContacts.findIndex((c) => c.id === updated.id);
        if (index !== -1) {
          newContacts[index] = updated;
        }
      });
      return newContacts;
    });

    // Persist to Supabase or Demo Storage
    try {
      if (user?.role === 'demo') {
        const demoData = getDemoData();
        if (demoData) {
          updatedContacts.forEach((updated) => {
            const index = demoData.contacts.findIndex((c: Subcontractor) => c.id === updated.id);
            if (index !== -1) {
              demoData.contacts[index] = updated;
            }
          });
          saveDemoData(demoData);
        }
        return;
      }

      // Process updates in parallel
      const updates = updatedContacts.map((contact) =>
        supabase
          .from("subcontractors")
          .update({
            company_name: contact.company,
            contact_person_name: contact.contacts[0]?.name || "-",
            specialization: contact.specialization,
            phone: contact.contacts[0]?.phone || "-",
            email: contact.contacts[0]?.email || "-",
            contacts: contact.contacts,
            ico: contact.ico,
            region: contact.region,
            status_id: contact.status,
          })
          .eq("id", contact.id)
      );

      await Promise.all(updates);
    } catch (err) {
      console.error("Unexpected error bulk updating contacts:", err);
      alert("Chyba při hromadné aktualizaci kontaktů.");
      alert("Chyba při hromadné aktualizaci kontaktů.");
      loadInitialData(true); // Revert silently
    }
  };

  const handleSyncContacts = async (
    url: string,
    onProgress?: (percent: number) => void
  ) => {
    // We don't want to block the UI with a global loading screen anymore
    // setIsDataLoading(true);
    try {
      const result = await syncContactsFromUrl(url);
      if (result.success) {
        await handleImportContacts(result.contacts, onProgress);
      } else {
        alert(`Chyba synchronizace: ${result.error} `);
      }
    } catch (error) {
      console.error("Sync error:", error);
      alert("Nepodařilo se synchronizovat kontakty.");
    } finally {
      // setIsDataLoading(false);
    }
  };

  const handleBidsChange = React.useCallback((projectId: string, bids: Record<string, Bid[]>) => {
    // Update bids in project details for real-time overview sync
    setAllProjectDetails(prev => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        bids
      }
    }));
  }, []);

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        return (
          <Dashboard
            projects={projects}
            projectDetails={allProjectDetails}
            onUpdateProjectDetails={(id, updates) => handleUpdateProjectDetails(id, updates)}
            onNavigateToProject={handleNavigateToProject}
          />
        );
      case "project":
        if (!selectedProjectId) {
          return (
            <div className="flex items-center justify-center h-full text-slate-600 dark:text-slate-300">
              Vyberte projekt…
            </div>
          );
        }

        if (!allProjectDetails[selectedProjectId]) {
          return (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-4">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
              <p className="text-slate-700 dark:text-slate-200">
                Načítám detail projektu…
              </p>
              <button
                onClick={() => navigate(buildAppUrl("dashboard"), { replace: true })}
                className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                Zpět na dashboard
              </button>
            </div>
          );
        }

        return (
          <RequireFeature feature={FEATURES.MODULE_PROJECTS}>
            <ProjectLayout
              projectId={selectedProjectId}
              projectDetails={allProjectDetails[selectedProjectId]}
              onUpdateDetails={(updates) =>
                handleUpdateProjectDetails(selectedProjectId, updates)
              }
              onAddCategory={(category) =>
                handleAddCategory(selectedProjectId, category)
              }
              onEditCategory={(category) =>
                handleEditCategory(selectedProjectId, category)
              }
              onDeleteCategory={(categoryId) =>
                handleDeleteCategory(selectedProjectId, categoryId)
              }
              onBidsChange={handleBidsChange}
              activeTab={activeProjectTab}
              onTabChange={(tab) => {
                setActiveProjectTab(tab);
                navigate(
                  buildAppUrl("project", {
                    projectId: selectedProjectId,
                    tab,
                    categoryId: activePipelineCategoryId,
                  }),
                  { replace: true }
                );
              }}
              contacts={contacts}
              statuses={contactStatuses}
              initialPipelineCategoryId={activePipelineCategoryId ?? undefined}
              onNavigateToPipeline={(categoryId) => {
                setActiveProjectTab("pipeline");
                setActivePipelineCategoryId(categoryId);
                navigate(
                  buildAppUrl("project", {
                    projectId: selectedProjectId,
                    tab: "pipeline",
                    categoryId,
                  }),
                  { replace: true }
                );
              }}
            />
          </RequireFeature>
        );
      case "contacts":
        return (
          <RequireFeature feature={FEATURES.MODULE_CONTACTS}>
            <Contacts
              statuses={contactStatuses}
              contacts={contacts}
              onContactsChange={setContacts}
              onAddContact={handleAddContact}
              onUpdateContact={handleUpdateContact}
              onBulkUpdateContacts={handleBulkUpdateContacts}
              onDeleteContacts={handleDeleteContacts}
              isAdmin={isAdmin}
            />
          </RequireFeature>
        );
      case "settings":
        return (
          <Settings
            theme={theme}
            onSetTheme={(newTheme) => {
              setTheme(newTheme);
              localStorage.setItem('theme', newTheme);
              // Convert trinary theme to legacy boolean for backward compat if needed, or just remove legacy key
              localStorage.removeItem('darkMode');
              
              if (user) {
                updatePreferences({ theme: newTheme });
              }
            }}
            primaryColor={primaryColor}
            onSetPrimaryColor={(color) => {
              setPrimaryColor(color);
              if (user) {
                updatePreferences({ primaryColor: color });
              }
            }}
            backgroundColor={backgroundColor}
            onSetBackgroundColor={(color) => {
              setBackgroundColor(color);
              if (user) {
                updatePreferences({ backgroundColor: color });
              }
            }}
            contactStatuses={contactStatuses}
            onUpdateStatuses={setContactStatuses}
            onImportContacts={handleImportContacts}
            onDeleteContacts={async (ids) => {
                const { error } = await supabase.from('subcontractors').delete().in('id', ids);
                if (error) {
                  console.error("Error deleting contacts:", error);
                  alert("Chyba při mazání kontaktů: " + error.message);
                } else {
                  setContacts(prev => prev.filter(c => !ids.includes(c.id)));
                }
            }}
            contacts={contacts}
            isAdmin={isAdmin}
            onSaveSettings={async () => {
              // Manual save trigger if needed, mostly changes are auto-saved via handlers above
              // Checking if explicit save is needed for some features
            }}
            user={user}
          />
        );
      case "project-management":
        return (
          <ProjectManager
            projects={projects}
            onAddProject={handleAddProject}
            onDeleteProject={handleDeleteProject}
            onArchiveProject={handleArchiveProject}
          />
        );
      case "project-overview":
        return (
          <RequireFeature feature={FEATURES.FEATURE_ADVANCED_REPORTING}>
            <ProjectOverview
              projects={projects}
              projectDetails={allProjectDetails}
            />
          </RequireFeature>
        );
      default:
        return (
          <Dashboard
            projects={projects}
            projectDetails={allProjectDetails}
            onUpdateProjectDetails={(id, updates) => handleUpdateProjectDetails(id, updates)}
            onNavigateToProject={handleNavigateToProject}
          />
        );
    }
  };

  const isAppPath = pathname === "/app" || pathname.startsWith("/app/");
  const shouldShowLoader = (authLoading && isAppPath) || (isAuthenticated && isDataLoading);

  if (shouldShowLoader) {
    const percent = appLoadProgress?.percent;
    const label = appLoadProgress?.label;
    
    // Determine current loading phase
    let loadingMessage = "Načítám aplikaci...";
    if (authLoading && isDataLoading) {
      loadingMessage = "Načítám aplikaci a data...";
    } else if (authLoading) {
      loadingMessage = "Ověřování přihlášení...";
    } else if (isDataLoading) {
      loadingMessage = "Načítám data...";
    }
    
    // Calculate progress percentage
    const displayPercent = typeof percent === "number" ? percent : (authLoading ? 30 : isDataLoading ? 60 : 0);
    
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white gap-4 px-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <div className="w-full max-w-sm">
          <p className="text-lg font-medium mb-4">
            {loadingMessage}
          </p>
          <div className="mt-4">
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-primary transition-[width] duration-300"
                style={{ width: `${Math.max(0, Math.min(100, displayPercent))}%` }}
              />
            </div>
            {label && (
              <div className="mt-3 text-sm text-white/70">
                <span className="truncate">{label}</span>
              </div>
            )}
            {typeof percent === "number" && (
              <div className="mt-2 text-sm text-white/50 tabular-nums">
                {percent}%
              </div>
            )}
          </div>
          {slowLoadWarning && (
            <div className="mt-6 text-sm text-white/80">
              <p>Načítání trvá déle než obvykle. Zkontrolujte připojení nebo zkuste znovu.</p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  onClick={() => {
                    setSlowLoadWarning(false);
                    loadInitialData(true);
                  }}
                  className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/20 border border-white/20 transition-colors"
                >
                  Zkusit znovu
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 transition-colors"
                >
                  Obnovit stránku
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loadingError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white gap-6 p-4 text-center">
        <div className="text-red-500 text-5xl">
          <span className="material-symbols-outlined text-6xl">error</span>
        </div>
        <h1 className="text-2xl font-bold">Chyba při načítání</h1>
        <p className="text-gray-400 max-w-md">{loadingError}</p>
        <div className="flex gap-4">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-primary hover:bg-primary/90 rounded-lg font-bold transition-colors"
          >
            Obnovit stránku
          </button>
          <button
            onClick={() =>
              supabase.auth.signOut().then(() => window.location.reload())
            }
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors"
          >
            Odhlásit se
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    switch (pathname) {
      case "/":
        return <LandingPage />;
      case "/login":
        return <LoginPage />;
      case "/register":
        return <RegisterPage />;
      case "/forgot-password":
        return <ForgotPasswordPage />;
      default:
        return (
          <PublicLayout>
            <PublicHeader variant="auth" />
            <div className="mx-auto max-w-2xl px-4 py-16 text-center">
              <h1 className="text-2xl font-semibold text-white">Stránka nenalezena</h1>
              <p className="mt-2 text-white/60">Zkontrolujte adresu nebo se vraťte na landing.</p>
              <div className="mt-6">
                <button
                  onClick={() => navigate("/", { replace: true })}
                  className="px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors shadow-lg shadow-orange-500/20"
                >
                  Zpět na landing
                </button>
              </div>
            </div>
          </PublicLayout>
        );
    }
  }

  return (
    <div className="relative flex h-screen w-full flex-row overflow-hidden bg-background-light dark:bg-background-dark">
      <ConfirmationModal
        isOpen={uiModal.isOpen}
        title={uiModal.title}
        message={uiModal.message}
        variant={uiModal.variant}
        confirmLabel={uiModal.confirmLabel}
        onConfirm={() => setUiModal((prev) => ({ ...prev, isOpen: false }))}
      />
      <Sidebar
        currentView={currentView}
        onViewChange={(view) => {
          if (view === "project") {
            const targetId =
              selectedProjectId || projects.find((p) => p.status !== "archived")?.id;
            if (targetId) {
              navigate(buildAppUrl("project", { projectId: targetId, tab: activeProjectTab }));
            } else {
              navigate(buildAppUrl("dashboard"));
            }
            return;
          }
          navigate(buildAppUrl(view));
        }}
        projects={projects.filter((p) => p.status !== "archived")}
        selectedProjectId={selectedProjectId}
        onProjectSelect={handleProjectSelect}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
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
                onClick={() => loadInitialData(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 dark:bg-white/15 dark:hover:bg-white/20 transition-colors"
              >
                Aktualizovat
              </button>
              {backgroundWarning && (
                <button
                  onClick={() => setBackgroundWarning(null)}
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
          {renderView()}
        </Suspense>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <FeatureProvider>
        <AppContent />
      </FeatureProvider>
    </AuthProvider>
  );
};

export default App;
