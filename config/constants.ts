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
 * Czech regions (kraje ČR) - abbreviation, full name
 * Used for subcontractor region coverage filtering
 */
export const CZ_REGIONS = [
    { code: "PHA", label: "Praha" },
    { code: "STC", label: "Středočeský" },
    { code: "JHC", label: "Jihočeský" },
    { code: "PLK", label: "Plzeňský" },
    { code: "KVK", label: "Karlovarský" },
    { code: "ULK", label: "Ústecký" },
    { code: "LBK", label: "Liberecký" },
    { code: "HKK", label: "Královéhradecký" },
    { code: "PAK", label: "Pardubický" },
    { code: "VYS", label: "Vysočina" },
    { code: "JHM", label: "Jihomoravský" },
    { code: "OLK", label: "Olomoucký" },
    { code: "ZLK", label: "Zlínský" },
    { code: "MSK", label: "Moravskoslezský" },
] as const;

export type CzRegionCode = (typeof CZ_REGIONS)[number]["code"];

/**
 * Default contact status configuration
 */
export const DEFAULT_STATUSES: StatusConfig[] = [
    { id: "available", label: "K dispozici", color: "green" },
    { id: "busy", label: "Zaneprázdněn", color: "red" },
    { id: "waiting", label: "Čeká", color: "yellow" },
];
