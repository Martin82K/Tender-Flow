import type { Severity } from "./signal";

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Urgentní",
  warning: "Pozornost",
  info: "Informace",
};

export const SEVERITY_CARD_CLASSES: Record<Severity, string> = {
  critical:
    "border-red-500/40 bg-red-500/5 hover:bg-red-500/10 dark:border-red-500/30 dark:bg-red-500/10",
  warning:
    "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 dark:border-amber-500/30 dark:bg-amber-500/10",
  info:
    "border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 dark:border-blue-500/30 dark:bg-blue-500/10",
};

export const SEVERITY_DOT_CLASSES: Record<Severity, string> = {
  critical: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
};

export const SEVERITY_ICON_CLASSES: Record<Severity, string> = {
  critical: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-blue-600 dark:text-blue-400",
};

export const SEVERITY_ICON_NAME: Record<Severity, string> = {
  critical: "error",
  warning: "warning",
  info: "info",
};
