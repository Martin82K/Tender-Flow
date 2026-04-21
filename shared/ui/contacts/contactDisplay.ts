import { StatusConfig, Subcontractor } from "@/types";
import { CZ_REGIONS, CzRegionCode } from "@/config/constants";

export type StatusColor =
  | "green"
  | "red"
  | "yellow"
  | "blue"
  | "purple"
  | "slate"
  | string;

export function getStatusConfig(
  statuses: StatusConfig[],
  id: string,
): StatusConfig {
  return statuses.find((s) => s.id === id) || { id, label: id, color: "slate" };
}

export function getStatusTextClasses(color: StatusColor): string {
  switch (color) {
    case "green":
      return "text-green-600 dark:text-green-400";
    case "red":
      return "text-red-600 dark:text-red-400";
    case "yellow":
      return "text-yellow-600 dark:text-yellow-400";
    case "blue":
      return "text-blue-600 dark:text-blue-400";
    case "purple":
      return "text-purple-600 dark:text-purple-400";
    default:
      return "text-slate-600 dark:text-slate-400";
  }
}

export function getStatusBgClasses(color: StatusColor): string {
  switch (color) {
    case "green":
      return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
    case "red":
      return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";
    case "yellow":
      return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300";
    case "blue":
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300";
    case "purple":
      return "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300";
    default:
      return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300";
  }
}

export function getStatusDotClass(color: StatusColor): string {
  switch (color) {
    case "green":
      return "bg-green-500";
    case "red":
      return "bg-red-500";
    case "yellow":
      return "bg-yellow-500";
    case "blue":
      return "bg-blue-500";
    case "purple":
      return "bg-purple-500";
    default:
      return "bg-slate-500";
  }
}

export function formatSpecializations(
  specializations: string[],
  separator = " • ",
): string {
  return specializations.filter(Boolean).join(separator);
}

export function formatRegionCoverage(
  regions: string[] | undefined | null,
): string {
  if (!regions || regions.length === 0) return "—";
  if (regions.length >= CZ_REGIONS.length) return "Celá ČR";
  const map = new Map(CZ_REGIONS.map((r) => [r.code, r.label]));
  return regions
    .map((code) => map.get(code as CzRegionCode) || code)
    .filter(Boolean)
    .join(", ");
}

export function contactInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function primaryContact(contact: Subcontractor) {
  return contact.contacts?.[0] || null;
}
