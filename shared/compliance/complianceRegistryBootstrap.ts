import type {
  CrmRetentionReview,
  ProcessingActivityRecord,
  RetentionPolicy,
  SubprocessorRecord,
} from "@/shared/types/compliance";

export const COMPLIANCE_PUBLIC_UPDATED_AT = "15. března 2026";

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
  {
    id: "notifications",
    category: "Uživatelské notifikace",
    purpose: "Krátkodobé produktové notifikace a provozní upozornění v aplikaci",
    retentionDays: 5,
    status: "implemented",
  },
  {
    id: "password-reset-tokens",
    category: "Password reset tokeny",
    purpose: "Jednorázové tokeny pro reset hesla a související bezpečnostní workflow",
    retentionDays: 2,
    status: "implemented",
  },
  {
    id: "feature-usage-events",
    category: "Feature usage telemetry",
    purpose: "Agregace využití funkcí po organizacích pro produktové a billing rozhodování",
    retentionDays: 180,
    status: "implemented",
  },
  {
    id: "ai-agent-usage-events",
    category: "AI agent telemetry",
    purpose: "Provozní a nákladová telemetry AI asistenta včetně tokenů a guard rozhodnutí",
    retentionDays: 180,
    status: "implemented",
  },
  {
    id: "ai-voice-usage-events",
    category: "AI voice telemetry",
    purpose: "Provozní a nákladová telemetry speech/transcribe funkcí",
    retentionDays: 180,
    status: "implemented",
  },
  {
    id: "document-storage",
    category: "Nahrané dokumenty a DocHub vazby",
    purpose: "Uživatelské dokumenty, odkazy na dokumentové struktury a související metadata",
    retentionDays: 1095,
    status: "partial",
  },
  {
    id: "generated-exports",
    category: "Generované exporty a dočasné artefakty",
    purpose: "Dočasné exportní soubory, JSON/PDF/XLSX artefakty a lokální přechodné výstupy",
    retentionDays: 30,
    status: "partial",
  },
  {
    id: "backup-artifacts",
    category: "Zálohy a archivní artefakty",
    purpose: "Ruční zálohy, archivní kopie a dlouhodobě držené exportní snapshoty mimo hlavní runtime",
    retentionDays: 30,
    status: "partial",
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

export const complianceBootstrapCrmRetentionReviews: CrmRetentionReview[] = [
  {
    id: "crm-retention-projects",
    domainKey: "projects",
    domainLabel: "Projekty a projektové poznámky",
    retentionPolicyId: "contacts-projects",
    reviewStatus: "planned",
    manualWorkflowSummary:
      "Ruční retenční review nad dokončenými a archivovanými projekty. Bez automatického mazání; nejdřív ověřit smluvní, účetní a realizační důvody pro další držení dat.",
    nextReviewAt: "2026-04-15",
  },
  {
    id: "crm-retention-subcontractors",
    domainKey: "subcontractors",
    domainLabel: "Subdodavatelé a kontaktní osoby",
    retentionPolicyId: "contacts-projects",
    reviewStatus: "planned",
    manualWorkflowSummary:
      "Ruční review kontaktů a firem bez aktivní vazby na běžící zakázky. Před případnou anonymizací zkontrolovat obchodní historii a otevřené smlouvy.",
    nextReviewAt: "2026-04-15",
  },
  {
    id: "crm-retention-contracts",
    domainKey: "contracts",
    domainLabel: "Smlouvy, dodatky a čerpání",
    retentionPolicyId: "account-contracts",
    reviewStatus: "approved",
    manualWorkflowSummary:
      "Smluvní a účetní agenda se drží podle zákonné a smluvní retence. Po uplynutí lhůty má následovat ruční právní kontrola před jakýmkoli odstraněním.",
    nextReviewAt: "2026-06-30",
  },
  {
    id: "crm-retention-project-shares",
    domainKey: "project_shares",
    domainLabel: "Sdílení projektů a přístupy třetích stran",
    retentionPolicyId: "support-requests",
    reviewStatus: "planned",
    manualWorkflowSummary:
      "Ruční kontrola sdílení a přístupů po ukončení spolupráce. Cílem je včas stáhnout neaktivní sdílení bez zásahu do samotného projektu.",
    nextReviewAt: "2026-04-01",
  },
  {
    id: "crm-retention-tender-plans",
    domainKey: "tender_plans",
    domainLabel: "Tender plány a harmonogramy",
    retentionPolicyId: "contacts-projects",
    reviewStatus: "planned",
    manualWorkflowSummary:
      "Ruční review plánovacích dat navázaných na uzavřené nebo zrušené zakázky. Automatické mazání je vypnuté, zůstává jen evidenční plán ručního postupu.",
    nextReviewAt: "2026-04-15",
  },
  {
    id: "crm-retention-dochub-links",
    domainKey: "dochub_project_folders",
    domainLabel: "DocHub projektové složky a vazby na dokumenty",
    retentionPolicyId: "document-storage",
    reviewStatus: "planned",
    manualWorkflowSummary:
      "Ruční retenční review vazeb na externí dokumentová úložiště po archivaci nebo smazání projektu. Automatické odpojování je vypnuté, nejdřív se má ověřit, zda dokumenty nejsou stále potřeba pro smluvní nebo realizační účely.",
    nextReviewAt: "2026-04-20",
  },
  {
    id: "crm-retention-uploaded-documents",
    domainKey: "uploaded_documents",
    domainLabel: "Nahrané dokumenty v úložišti",
    retentionPolicyId: "document-storage",
    reviewStatus: "planned",
    manualWorkflowSummary:
      "Ruční kontrola nahraných dokumentů a jejich vazby na aktivní zakázky. Bez automatického mazání; po retenční lhůtě má následovat ruční rozhodnutí nad konkrétní složkou nebo projektem.",
    nextReviewAt: "2026-04-20",
  },
  {
    id: "crm-retention-generated-exports",
    domainKey: "generated_exports",
    domainLabel: "Generované exporty a dočasné soubory",
    retentionPolicyId: "generated-exports",
    reviewStatus: "planned",
    manualWorkflowSummary:
      "Ruční review exportních artefaktů vytvářených při DSR, reportingu a kancelářských exportech. Cílem je omezit dlouhodobé držení kopií mimo hlavní datový model, ale mazání zůstává výhradně ruční.",
    nextReviewAt: "2026-03-31",
  },
  {
    id: "crm-retention-backup-artifacts",
    domainKey: "backup_artifacts",
    domainLabel: "Zálohy a archivní artefakty mimo hlavní runtime",
    retentionPolicyId: "backup-artifacts",
    reviewStatus: "blocked",
    manualWorkflowSummary:
      "Ruční retenční plán je připraven, ale finální rozhodování blokuje chybějící provozní směrnice k zálohám a obnově. Bez jejich schválení se žádné mazání ani rotace automaticky nespouští.",
    nextReviewAt: "2026-04-30",
  },
];

export const getBootstrapSubprocessorsForActivity = (
  activity: ProcessingActivityRecord,
): SubprocessorRecord[] =>
  complianceBootstrapSubprocessors.filter((subprocessor) =>
    activity.linkedSubprocessorIds.includes(subprocessor.id),
  );
