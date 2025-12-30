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
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleNavigateToProject = (projectId: string, tab: string, categoryId?: string) => {
    // 1. Set Project
    setSelectedProjectId(projectId);
    
    // 2. Set View to Project
    setCurrentView('project');

    // 3. Set Tab (assuming 'pipeline' is mapped to ProjectTab type correctly, otherwise handle mapping)
    if (tab === 'pipeline') {
      setActiveProjectTab('pipeline');
    } else {
      setActiveProjectTab('overview');
    }

    // 4. Set Category if provided
    if (categoryId) {
      setActivePipelineCategoryId(categoryId);
    } else {
      setActivePipelineCategoryId(null);
    }
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

  // Load data from Supabase on mount
  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const load = async () => {
      if (isAuthenticated) {
        // Set a timeout to detect hanging
        timeoutId = setTimeout(() => {
          if (mounted && isDataLoading) {
            setLoadingError(
              "Načítání dat trvá příliš dlouho. Zkontrolujte připojení k internetu nebo zkuste stránku obnovit."
            );
            setIsDataLoading(false);
          }
        }, 15000); // 15 seconds timeout

        await loadInitialData();

        if (mounted) clearTimeout(timeoutId);
      } else if (!authLoading) {
        setIsDataLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
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
      const safeNext = nextParam?.startsWith("/") ? nextParam : "/app";
      navigate(safeNext, { replace: true });
      return;
    }

    if (isAuthenticated && !isAppPath) {
      navigate("/app", { replace: true });
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
    if (!silent) {
      setIsDataLoading(true);
      setLoadingError(null);
    }
    console.log("Starting loadInitialData...", { silent });
    try {
      // Load projects
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        // Admin check (highest role)
        setIsAdmin(user?.role === 'demo' || isUserAdmin(session.user.email));
      }

      // Handle Demo Mode Data Loading
      if (user?.role === 'demo') {
        let demoData = getDemoData();
        
        // If no demo data in localStorage, initialize with defaults
        if (!demoData) {
          demoData = {
            projects: [DEMO_PROJECT],
            projectDetails: { [DEMO_PROJECT.id]: DEMO_PROJECT_DETAILS },
            contacts: DEMO_CONTACTS,
            statuses: DEMO_STATUSES
          };
          saveDemoData(demoData);
        }

        setProjects(demoData.projects);
        setAllProjectDetails(demoData.projectDetails);
        setContacts(demoData.contacts);
        setContactStatuses(demoData.statuses);
        
        if (demoData.projects.length > 0 && !selectedProjectId) {
          setSelectedProjectId(demoData.projects[0].id);
        }
        
        if (!silent) setIsDataLoading(false);
        lastRefreshTime.current = Date.now();
        return;
      }

      const [projectsResponse, metadataResponse] = await Promise.all([
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.rpc("get_projects_metadata")
      ]);

      const projectsData = projectsResponse.data;
      const projectsError = projectsResponse.error;
      const metadata = metadataResponse.data as { project_id: string, owner_email: string, shared_with_emails: string[] }[] || [];

      if (projectsError) throw projectsError;

      const metadataMap = new Map<string, { owner: string, shared: string[] }>();
      metadata.forEach(m => metadataMap.set(m.project_id, { owner: m.owner_email, shared: m.shared_with_emails || [] }));

      const loadedProjects: Project[] = (projectsData || []).map((p) => {
        const meta = metadataMap.get(p.id);
        return {
          id: p.id,
          name: p.name,
          location: p.location || "",
          status: p.status || "realization",
          isDemo: p.is_demo,
          ownerId: p.owner_id,
          ownerEmail: meta?.owner,
          sharedWith: meta?.shared
        };
      });

      setProjects(loadedProjects);

      // Set first project as selected if available
      if (loadedProjects.length > 0 && !selectedProjectId) {
        setSelectedProjectId(loadedProjects[0].id);
      }

      // Load project details for all projects
      const detailsMap: Record<string, ProjectDetails> = {};

      for (const project of projectsData || []) {
        // Load categories for this project
        const { data: categoriesData } = await supabase
          .from("demand_categories")
          .select("*")
          .eq("project_id", project.id);

        const categories: DemandCategory[] = (categoriesData || []).map(
          (c) => ({
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
          })
        );

        // Load contract details
        const { data: contractData } = await supabase
          .from("project_contracts")
          .select("*")
          .eq("project_id", project.id)
          .maybeSingle();

        // Load investor financials
        const { data: financialsData } = await supabase
          .from("project_investor_financials")
          .select("*")
          .eq("project_id", project.id)
          .maybeSingle();

        // Load amendments
        const { data: amendmentsData } = await supabase
          .from("project_amendments")
          .select("*")
          .eq("project_id", project.id);

        detailsMap[project.id] = {
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
              amendments: (amendmentsData || []).map((a) => ({
                id: a.id,
                label: a.label,
                price: a.price || 0,
              })),
            }
            : undefined,
        };
      }

      setAllProjectDetails(detailsMap);

      // Load all bids
      const { data: bidsData } = await supabase.from("bids").select("*");

      // Distribute bids to projects
      if (bidsData) {
        const bidsByProject: Record<string, Record<string, Bid[]>> = {};

        // We need to map bids to projects via categories.
        // Since we don't have a direct link in the bids table (it links to demand_categories),
        // we need to know which project a category belongs to.
        // We already loaded categories for each project in the loop above.

        // Create a map of categoryId -> projectId
        const categoryProjectMap: Record<string, string> = {};
        Object.entries(detailsMap).forEach(([projectId, details]) => {
          details.categories.forEach((cat) => {
            categoryProjectMap[cat.id] = projectId;
          });
        });

        bidsData.forEach((bid) => {
          const projectId = categoryProjectMap[bid.demand_category_id];
          if (projectId) {
            if (!bidsByProject[projectId]) bidsByProject[projectId] = {};
            if (!bidsByProject[projectId][bid.demand_category_id])
              bidsByProject[projectId][bid.demand_category_id] = [];

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
          }
        });

        // Update project details with bids
        setAllProjectDetails((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((pid) => {
            if (bidsByProject[pid]) {
              next[pid] = { ...next[pid], bids: bidsByProject[pid] };
            }
          });
          return next;
        });
      }

      // Load all subcontractors
      const { data: subcontractorsData, error: subcontractorsError } =
        await supabase.from("subcontractors").select("*").order("company_name");

      if (subcontractorsError) throw subcontractorsError;

      const loadedContacts: Subcontractor[] = (subcontractorsData || []).map(
        (s) => {
          // Database stores specialization as text[] array
          const specArray = Array.isArray(s.specialization)
            ? s.specialization
            : s.specialization ? [s.specialization] : ["Ostatní"];

          // Support for multiple contacts
          let contactsArray: any[] = Array.isArray(s.contacts) ? s.contacts : [];

          // Migration/Fallback: if no contacts array but legacy fields exist
          if (contactsArray.length === 0 && (s.contact_person_name || s.phone || s.email)) {
            contactsArray = [{
              id: crypto.randomUUID(),
              name: s.contact_person_name || "-",
              phone: s.phone || "-",
              email: s.email || "-",
              position: "Hlavní kontakt"
            }];
          }

          return {
            id: s.id,
            company: s.company_name,
            specialization: specArray.length > 0 ? specArray : ["Ostatní"],
            contacts: contactsArray,
            ico: s.ico || "-",
            region: s.region || "-",
            status: s.status_id || "available",
            // Keep legacy for UI compatibility during transition
            name: s.contact_person_name || "-",
            phone: s.phone || "-",
            email: s.email || "-",
          };
        }
      );

      setContacts(loadedContacts);

      // Load contact statuses from database
      const statuses = await loadContactStatuses();
      setContactStatuses(statuses);
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

        setLoadingError(
          detailParts.length > 0
            ? `Nepodařilo se načíst data (${detailParts.join(", ")}).`
            : "Nepodařilo se načíst data. Zkuste obnovit stránku."
        );
      }
    } finally {
      if (!silent) setIsDataLoading(false);
      lastRefreshTime.current = Date.now();
    }
  };

  const handleProjectSelect = (id: string) => {
    setSelectedProjectId(id);
    setCurrentView("project");
    setActiveProjectTab("overview");
  };

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
      setCurrentView("dashboard");
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
        alert(
          `Demo synchronizace dokončena: \n - Přidáno nových: ${addedCount} \n - Aktualizováno: ${updatedCount} \n(Data uložena v prohlížeči)`
        );
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
          alert(`Chyba při vkládání kontaktů: ${insertError.message} `);
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
      alert(
        `Synchronizace dokončena: \n - Přidáno nových: ${addedCount} \n - Aktualizováno: ${updatedCount} `
      );
    } catch (error: any) {
      console.error("Unexpected error persisting contacts:", error);
      alert(`Neočekávaná chyba při ukládání: ${error.message || error} `);
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
              onTabChange={setActiveProjectTab}
              contacts={contacts}
              statuses={contactStatuses}
              initialPipelineCategoryId={activePipelineCategoryId ?? undefined}
              onNavigateToPipeline={(categoryId) => setActivePipelineCategoryId(categoryId)}
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
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <p>
          Načítám aplikaci... {authLoading ? "(Ověřování)" : ""}{" "}
          {isDataLoading ? "(Data)" : ""}
        </p>
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
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
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
