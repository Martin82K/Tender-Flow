/**
 * Routing Utility Functions
 * Extracted from App.tsx for better modularity
 */

import { View, ProjectTab } from "../../types";
import { APP_BASE, isProjectTab } from "./routes";

// Re-export for convenience
export { APP_BASE, isProjectTab };

/**
 * Build a URL for navigating within the app
 */
export const buildAppUrl = (
    view: View,
    opts?: {
        projectId?: string;
        tab?: ProjectTab;
        categoryId?: string | null;
        settingsTab?: 'user' | 'admin';
        settingsSubTab?: 'profile' | 'contacts' | 'tools' | 'excelMerger';
    }
): string => {
    switch (view) {
        case "dashboard":
            return `${APP_BASE}/dashboard`;
        case "contacts":
            return `${APP_BASE}/contacts`;
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

/**
 * Parse result type for app routes
 */
export type ParsedAppRoute =
    | { isApp: false }
    | { isApp: true; redirectTo: string }
    | { isApp: true; view: "dashboard" | "contacts" | "settings" | "project-management" | "project-overview" }
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
