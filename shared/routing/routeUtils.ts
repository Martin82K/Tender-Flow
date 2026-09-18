/**
 * Routing Utility Functions
 * Extracted from App.tsx for better modularity
 */

import { View, ProjectTab } from "../../types";
import { APP_BASE, isProjectTab } from "./routes";

// Re-export for convenience
export { APP_BASE, isProjectTab };

export const DEFAULT_APP_VIEW: View = "project-management";
export const DEFAULT_APP_URL = `${APP_BASE}/projects?status=all`;

/**
 * Build a URL for navigating within the app
 */
export const buildAppUrl = (
    view: View,
    opts?: {
        projectId?: string;
        taskId?: string;
        tab?: ProjectTab;
        categoryId?: string | null;
        contractId?: string | null;
        bidId?: string | null;
        documentsSubTab?: "pd" | "templates" | "dochub" | "ceniky" | "investor" | "subcontractor" | "association" | "claims";
        documentsView?: "overview" | "protocols" | "other";
        documentId?: string | null;
        settingsTab?: 'user' | 'tools' | 'organization' | 'admin';
        settingsSubTab?: 'profile' | 'security' | 'notifications' | 'backup' | 'mcp' | 'contacts' | 'excelUnlocker' | 'excelMerger' | 'excelIndexer' | 'registration' | 'users' | 'organizations' | 'subscriptions' | 'ai' | 'incidents' | 'compliance' | 'tools' | 'overview' | 'members' | 'rolePermissions' | 'billing' | 'branding';
    }
): string => {
    switch (view) {
        case "contacts":
            return `${APP_BASE}/contacts`;
        case "todo": {
            const params = new URLSearchParams();
            if (opts?.taskId) params.set("taskId", opts.taskId);
            const qs = params.toString();
            return `${APP_BASE}/todo${qs ? `?${qs}` : ""}`;
        }
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
        case "contract-overview":
            return `${APP_BASE}/contract-overview`;
        case "project": {
            if (!opts?.projectId) return DEFAULT_APP_URL;
            const params = new URLSearchParams();
            if (opts.tab) params.set("tab", opts.tab);
            if (opts.categoryId) params.set("categoryId", opts.categoryId);
            if (opts.bidId) params.set("bidId", opts.bidId);
            if (opts.contractId) params.set("contractId", opts.contractId);
            if (opts.documentsSubTab) params.set("documentsSubTab", opts.documentsSubTab);
            if (opts.documentsView) params.set("documentsView", opts.documentsView);
            if (opts.documentId) params.set("documentId", opts.documentId);
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
    | { isApp: true; view: "todo"; taskId?: string }
    | { isApp: true; view: "contacts" | "settings" | "project-management" | "project-overview" | "contract-overview" }
    | {
        isApp: true;
        view: "project";
        projectId: string;
        tab?: ProjectTab;
        categoryId?: string;
        contractId?: string;
        bidId?: string;
        documentId?: string;
        documentsSubTab?: string;
        documentsView?: string;
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
    if (sub === "command-center") return { isApp: true as const, redirectTo: DEFAULT_APP_URL };
    if (sub === "contacts") return { isApp: true as const, view: "contacts" as const };
    if (sub === "todo") {
        const taskId = new URLSearchParams(search).get("taskId");
        return { isApp: true as const, view: "todo" as const, ...(taskId ? { taskId } : {}) };
    }
    if (sub === "settings") return { isApp: true as const, view: "settings" as const };
    if (sub === "projects") return { isApp: true as const, view: "project-management" as const };
    if (sub === "project-overview") return { isApp: true as const, view: "project-overview" as const };
    if (sub === "contract-overview") return { isApp: true as const, view: "contract-overview" as const };

    if (sub === "project") {
        const projectId = parts[2] ? decodeURIComponent(parts[2]) : "";
        const params = new URLSearchParams(search);
        const tabParam = params.get("tab");
        const categoryIdParam = params.get("categoryId");
        const contractIdParam = params.get("contractId");
        return {
            isApp: true as const,
            view: "project" as const,
            projectId,
            tab: isProjectTab(tabParam) ? tabParam : undefined,
            categoryId: categoryIdParam || undefined,
            contractId: contractIdParam || undefined,
            bidId: params.get("bidId") || undefined,
            ...(params.get("documentId") ? { documentId: params.get("documentId")! } : {}),
            ...(params.get("documentsSubTab") ? { documentsSubTab: params.get("documentsSubTab")! } : {}),
            ...(params.get("documentsView") ? { documentsView: params.get("documentsView")! } : {}),
        };
    }

    return { isApp: true as const, redirectTo: DEFAULT_APP_URL };
};
