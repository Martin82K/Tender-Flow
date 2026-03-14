import type {
  ProcessingActivityRecord,
  RetentionPolicy,
  SubprocessorRecord,
} from "@/shared/types/compliance";

export const COMPLIANCE_PUBLIC_UPDATED_AT = "14. března 2026";

export const complianceBootstrapRetentionPolicies: RetentionPolicy[] = [
  {
    id: "incident-logs",
    category: "Incident logy",
    purpose: "Diagnostika a bezpečnostní dohled",
    retentionDays: 60,
    status: "implemented",
  },
  {
    id: "account-contracts",
    category: "Účet a smluvní agenda",
    purpose: "Správa účtu, smlouvy, fakturace a zákaznická komunikace",
    retentionDays: 3650,
    status: "implemented",
  },
  {
    id: "contacts-projects",
    category: "Kontakty a projektová data",
    purpose: "CRM agenda, příprava staveb a práce s tendry",
    retentionDays: 1095,
    status: "partial",
  },
  {
    id: "support-requests",
    category: "Support a provozní požadavky",
    purpose: "Řešení ticketů, incidentů a provozních dotazů",
    retentionDays: 365,
    status: "implemented",
  },
];

export const complianceBootstrapSubprocessors: SubprocessorRecord[] = [
  {
    id: "subprocessor-supabase",
    name: "Supabase",
    region: "EU",
    purpose: "Databáze, autentizace, storage a backend služby",
    transferMechanism: "EHP / EU hosting",
  },
  {
    id: "subprocessor-stripe",
    name: "Stripe",
    region: "EU / USA",
    purpose: "Platby, billing a související finanční operace",
    transferMechanism: "SCC / doplňkové záruky dodavatele",
  },
  {
    id: "subprocessor-openai",
    name: "OpenAI",
    region: "USA",
    purpose: "Volitelné AI funkce, asistence a generativní zpracování",
    transferMechanism: "SCC / doplňkové záruky dodavatele",
  },
];

export const complianceBootstrapProcessingActivities: ProcessingActivityRecord[] = [
  {
    id: "ropa-account-management",
    activityName: "Správa uživatelských účtů a organizací",
    purpose: "Registrace, autentizace, autorizace a správa přístupů v aplikaci",
    legalBasis: "plnění smlouvy",
    dataCategories: ["jméno", "e-mail", "role", "organizační zařazení"],
    retentionPolicyId: "account-contracts",
    linkedSubprocessorIds: ["subprocessor-supabase"],
  },
  {
    id: "ropa-crm-projects",
    activityName: "CRM agenda, kontakty a projektová příprava",
    purpose: "Evidence kontaktů, projektů, komunikace a podkladů k tendrům",
    legalBasis: "plnění smlouvy",
    dataCategories: ["jméno", "e-mail", "telefon", "firma", "projektové poznámky"],
    retentionPolicyId: "contacts-projects",
    linkedSubprocessorIds: ["subprocessor-supabase"],
  },
  {
    id: "ropa-support-security",
    activityName: "Support, zabezpečení a incident management",
    purpose: "Řešení podpory, prevence zneužití, audit a bezpečnostní dohled",
    legalBasis: "oprávněný zájem",
    dataCategories: ["e-mail", "obsah support komunikace", "IP adresa", "technické logy"],
    retentionPolicyId: "support-requests",
    linkedSubprocessorIds: ["subprocessor-supabase"],
  },
  {
    id: "ropa-billing",
    activityName: "Billing a fakturační agenda",
    purpose: "Platby, fakturace, vedení účetních a daňových podkladů",
    legalBasis: "právní povinnost",
    dataCategories: ["jméno", "fakturační údaje", "platební reference", "stav předplatného"],
    retentionPolicyId: "account-contracts",
    linkedSubprocessorIds: ["subprocessor-stripe"],
  },
  {
    id: "ropa-ai-assistance",
    activityName: "Volitelné AI asistované funkce",
    purpose: "Zpracování uživatelských promptů a asistence při práci v aplikaci",
    legalBasis: "souhlas / pokyn zákazníka",
    dataCategories: ["obsah promptu", "metadatové identifikátory požadavku"],
    retentionPolicyId: "support-requests",
    linkedSubprocessorIds: ["subprocessor-openai"],
  },
];

export const getBootstrapSubprocessorsForActivity = (
  activity: ProcessingActivityRecord,
): SubprocessorRecord[] =>
  complianceBootstrapSubprocessors.filter((subprocessor) =>
    activity.linkedSubprocessorIds.includes(subprocessor.id),
  );

