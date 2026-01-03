/**
 * Application Constants
 * Centralized configuration values extracted from App.tsx
 */

import { StatusConfig } from "../types";

/**
 * Admin email addresses with highest privileges
 */
export const ADMIN_EMAILS: readonly string[] = [
    "martinkalkus82@gmail.com",
    "kalkus@baustav.cz",
];

/**
 * Default contact status configuration
 */
export const DEFAULT_STATUSES: StatusConfig[] = [
    { id: "available", label: "K dispozici", color: "green" },
    { id: "busy", label: "Zaneprázdněn", color: "red" },
    { id: "waiting", label: "Čeká", color: "yellow" },
];
