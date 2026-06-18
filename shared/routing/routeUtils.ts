/**
 * Routing Utility Functions
 * Extracted from App.tsx for better modularity
 */

import { View, ProjectTab } from "../../types";
import { APP_BASE, isProjectTab } from "./routes";

// Re-export for convenience
export { APP_BASE, isProjectTab };

export const DEFAULT_APP_VIEW: View = "todo";
export const DEFAULT_APP_URL = `${APP_BASE}/todo`;

/**
 * Build a URL for navigating within the app
 */
export const buildAppUrl = (
    view: View,
    opts?: {
        projectId?: string;
        tab?: ProjectTab;
        categoryId?: string | null;
        documentsSubTab?: "pd" | "templates" | "dochub" | "ceniky";
        settingsTab?: 'user' | 'tools' | 'organization' | 'admin';
        settingsSubTab?: 'profile' | 'security' | 'notifications' | 'backup' | 'contacts' | 'excelUnlocker' | 'excelMerger' | 'excelIndexer' | 'urlShortener' | 'bidComparison' | 'registration' | 'users' | 'organizations' | 'subscriptions' | 'ai' | 'incidents' | 'compliance' | 'tools' | 'overview' | 'members' | 'billing' | 'branding';
    }
): string => {
    switch (view) {
        case "command-center":
            return `${APP_BASE}/command-center`;
        case "contacts":
            return `${APP_BASE}/contacts`;
        case "todo":
            return `${APP_BASE}/todo`;
        case "settings": {
            const params = new URLSearchParams();
            if (opts?.settingsTab) params.set("tab", opts.settingsTab);
            if (opts?.settingsSubTab) params.set("subTab", opts.settingsSubTab);
            const qs = params.toString();
            return `${APP_BASE}/settings${qs ? `?${qs}` : ""}`;
        }
        case "project-management":
            return `${APP_BASE}/projects`;
        case "project-overview":
            return `${APP_BASE}/project-overview`;
        case "url-shortener":
            return `${APP_BASE}/url-shortener`;
        case "project": {
            if (!opts?.projectId) return DEFAULT_APP_URL;
            const params = new URLSearchParams();
            if (opts.tab) params.set("tab", opts.tab);
            if (opts.categoryId) params.set("categoryId", opts.categoryId);
            if (opts.documentsSubTab) params.set("documentsSubTab", opts.documentsSubTab);
            const qs = params.toString();
            return `${APP_BASE}/project/${encodeURIComponent(opts.projectId)}${qs ? `?${qs}` : ""}`;
        }
        default:
            return DEFAULT_APP_URL;
    }
};

/**
 * Parse result type for app routes
 */
export type ParsedAppRoute =
    | { isApp: false }
    | { isApp: true; redirectTo: string }
    | { isApp: true; view: "command-center" | "contacts" | "todo" | "settings" | "project-management" | "project-overview" | "url-shortener" }
    | {
        isApp: true;
        view: "project";
        projectId: string;
        tab?: ProjectTab;
        categoryId?: string;
    };

/**
 * Parse the current URL pathname and search to determine the app route
 */
export const parseAppRoute = (pathname: string, search: string): ParsedAppRoute => {
    const parts = pathname.split("/").filter(Boolean);
    if (parts[0] !== "app") return { isApp: false as const };

    if (parts.length === 1) {
        return { isApp: true as const, redirectTo: DEFAULT_APP_URL };
    }

    const sub = parts[1];
    if (sub === "command-center") return { isApp: true as const, view: "command-center" as const };
    if (sub === "contacts") return { isApp: true as const, view: "contacts" as const };
    if (sub === "todo") return { isApp: true as const, view: "todo" as const };
    if (sub === "settings") return { isApp: true as const, view: "settings" as const };
    if (sub === "projects") return { isApp: true as const, view: "project-management" as const };
    if (sub === "project-overview") return { isApp: true as const, view: "project-overview" as const };
    if (sub === "url-shortener") return { isApp: true as const, view: "url-shortener" as const };

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

    return { isApp: true as const, redirectTo: DEFAULT_APP_URL };
};
