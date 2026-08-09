import type { ProjectTeamRole } from "@/types";

export type ProjectPermissionLevel = "none" | "read" | "write";

export const PROJECT_TEAM_ROLE_LABELS: Record<ProjectTeamRole, string> = {
  deputy: "Náměstek",
  lead_site_manager: "Hlavní stavbyvedoucí / vedoucí projektu",
  site_manager: "Stavbyvedoucí",
  preconstruction: "Přípravář",
  technician: "Technik",
  contracts_department: "Smluvní oddělení",
  economist: "Ekonom",
};

export const PROJECT_TEAM_ROLES = Object.keys(PROJECT_TEAM_ROLE_LABELS) as ProjectTeamRole[];

export interface ProjectPermissionActionDefinition {
  key: string;
  label: string;
  hint?: string;
  supportsApproval?: boolean;
  allowedLevels?: ProjectPermissionLevel[];
}

export interface ProjectPermissionSectionDefinition {
  key: string;
  label: string;
  actions: ProjectPermissionActionDefinition[];
}

export interface ProjectPermissionAreaDefinition {
  key: string;
  label: string;
  sections: ProjectPermissionSectionDefinition[];
}

export const PROJECT_PERMISSION_AREAS: ProjectPermissionAreaDefinition[] = [
  {
    key: "project",
    label: "Stavba",
    sections: [
      { key: "overview", label: "Přehled", actions: [
        { key: "project.overview.details", label: "Základní údaje stavby" },
        { key: "project.overview.investor_finance", label: "Finance investora" },
        { key: "project.overview.internal_budget", label: "Interní rozpočet" },
      ] },
      { key: "team", label: "Realizační tým", actions: [
        { key: "project.team.roster", label: "Seznam realizačního týmu" },
        { key: "project.team.manage", label: "Správa členství ve stavbě" },
      ] },
    ],
  },
  {
    key: "tenders",
    label: "Výběrová řízení",
    sections: [
      { key: "plan", label: "Plán VŘ", actions: [
        { key: "tenders.plan", label: "Plán výběrových řízení" },
      ] },
      { key: "workspace", label: "Konkrétní VŘ", actions: [
        { key: "tenders.details", label: "Údaje výběrového řízení" },
        { key: "tenders.bids", label: "Nabídky dodavatelů" },
        { key: "tenders.communication", label: "Poptávky a komunikace" },
        { key: "tenders.selection", label: "Výběr dodavatele", supportsApproval: true },
        { key: "tenders.folder_link", label: "Odkaz na související složku" },
      ] },
    ],
  },
  {
    key: "planning",
    label: "Plánování",
    sections: [
      { key: "schedule", label: "Harmonogram", actions: [{ key: "planning.schedule", label: "Harmonogram stavby" }] },
      { key: "map", label: "Mapa", actions: [{ key: "planning.map", label: "Poloha stavby" }] },
    ],
  },
  {
    key: "documents",
    label: "Dokumenty",
    sections: [
      { key: "links", label: "Projektová dokumentace", actions: [
        { key: "documents.links", label: "Evidence odkazů a cest" },
        { key: "documents.external_open", label: "Otevření externího odkazu" },
      ] },
      { key: "templates", label: "Šablony", actions: [{ key: "documents.templates", label: "Projektové šablony" }] },
      { key: "price_lists", label: "Ceníky", actions: [{ key: "documents.price_lists", label: "Odkazy na ceníky" }] },
      { key: "dochub", label: "Složkomat", actions: [
        { key: "documents.dochub_content", label: "Odkazy na složky" },
        { key: "documents.dochub_settings", label: "Nastavení a struktura Složkomatu" },
      ] },
    ],
  },
  {
    key: "contracts",
    label: "Smlouvy",
    sections: [
      { key: "records", label: "Evidence smluv", actions: [
        { key: "contracts.records", label: "Smlouvy a jejich parametry" },
        { key: "contracts.signed_document", label: "Přiřazení podepsané smlouvy" },
        { key: "contracts.amendments", label: "Dodatky" },
        { key: "contracts.billing", label: "Fakturace a čerpání" },
      ] },
    ],
  },
  {
    key: "contract_overview",
    label: "Smluvní přehled",
    sections: [
      { key: "visibility_scope", label: "Rozsah viditelnosti", actions: [
        {
          key: "contract_overview.organization",
          label: "Čtení napříč organizací",
          hint: "Smlouvy všech aktivních staveb. Tento širší rozsah má přednost.",
          allowedLevels: ["none", "read"],
        },
        {
          key: "contract_overview.project_team",
          label: "Čtení smluv přiřazených staveb",
          hint: "Pouze stavby, kde je uživatel členem realizačního týmu.",
          allowedLevels: ["none", "read"],
        },
      ] },
    ],
  },
];

export const PROJECT_PERMISSION_LEVEL_LABELS: Record<ProjectPermissionLevel, string> = {
  none: "Bez přístupu",
  read: "Jen čtení",
  write: "Zápis",
};
