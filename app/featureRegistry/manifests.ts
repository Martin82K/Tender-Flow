import { FEATURES } from "@/config/features";
import type { View } from "@/types";
import type { FeatureModuleManifest } from "./types";

const emptyChecks = () => [] as string[];

const viewToManifest = <T extends View>(view: T, manifest: FeatureModuleManifest) => ({
  [view]: manifest,
}) as Record<T, FeatureModuleManifest>;

export const featureModuleRegistry: Record<View, FeatureModuleManifest> = {
  ...viewToManifest("dashboard", {
    id: "projects.dashboard",
    routes: [{ path: "/app/dashboard", view: "dashboard" }],
    navItems: [{ id: "dashboard", label: "Přehled" }],
    requiredCapabilities: [FEATURES.MODULE_PROJECTS],
    mount: () =>
      import("@/features/dashboard").then((m) => ({ default: m.DashboardView })),
    unmountSafeChecks: emptyChecks,
  }),
  ...viewToManifest("command-center", {
    id: "command-center.main",
    routes: [{ path: "/app/command-center", view: "command-center" }],
    navItems: [{ id: "command-center", label: "Command Center" }],
    requiredCapabilities: [FEATURES.MODULE_COMMAND_CENTER],
    mount: () =>
      import("@/features/command-center").then((m) => ({ default: m.CommandCenter })),
    unmountSafeChecks: emptyChecks,
  }),
  ...viewToManifest("project", {
    id: "projects.layout",
    routes: [{ path: "/app/project/:projectId", view: "project" }],
    navItems: [{ id: "project", label: "Projekt" }],
    requiredCapabilities: [FEATURES.MODULE_PROJECTS],
    mount: () =>
      import("@/features/projects/ProjectLayout").then((m) => ({
        default: m.ProjectLayout,
      })),
    unmountSafeChecks: emptyChecks,
  }),
  ...viewToManifest("contacts", {
    id: "contacts.main",
    routes: [{ path: "/app/contacts", view: "contacts" }],
    navItems: [{ id: "contacts", label: "Kontakty" }],
    requiredCapabilities: [FEATURES.MODULE_CONTACTS],
    mount: () =>
      import("@/features/contacts/Contacts").then((m) => ({ default: m.Contacts })),
    unmountSafeChecks: emptyChecks,
  }),
  ...viewToManifest("settings", {
    id: "settings.main",
    routes: [{ path: "/app/settings", view: "settings" }],
    navItems: [{ id: "settings", label: "Nastavení" }],
    requiredCapabilities: [],
    mount: () =>
      import("@/features/settings/Settings").then((m) => ({
        default: m.Settings,
      })),
    unmountSafeChecks: emptyChecks,
  }),
  ...viewToManifest("project-management", {
    id: "projects.management",
    routes: [{ path: "/app/project-management", view: "project-management" }],
    navItems: [{ id: "project-management", label: "Správa projektů" }],
    requiredCapabilities: [FEATURES.MODULE_PROJECTS],
    mount: () =>
      import("@/features/projects/ProjectManager").then((m) => ({
        default: m.ProjectManager,
      })),
    unmountSafeChecks: emptyChecks,
  }),
  ...viewToManifest("project-overview", {
    id: "projects.overview",
    routes: [{ path: "/app/project-overview", view: "project-overview" }],
    navItems: [{ id: "project-overview", label: "Přehled projektů" }],
    requiredCapabilities: [FEATURES.FEATURE_ADVANCED_REPORTING],
    mount: () =>
      import("@/features/projects/ProjectOverview").then((m) => ({
        default: m.ProjectOverview,
      })),
    unmountSafeChecks: emptyChecks,
  }),
  ...viewToManifest("url-shortener", {
    id: "tools.url-shortener",
    routes: [{ path: "/app/url-shortener", view: "url-shortener" }],
    navItems: [{ id: "url-shortener", label: "URL zkracovač" }],
    requiredCapabilities: [FEATURES.URL_SHORTENER],
    mount: () =>
      import("@/features/tools/UrlShortener").then((m) => ({
        default: m.UrlShortener,
      })),
    unmountSafeChecks: emptyChecks,
  }),
};
