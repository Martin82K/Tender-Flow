import { dbAdapter } from "@/services/dbAdapter";
import type {
  BreachCase,
  ComplianceChecklistItem,
  DataSubjectRequest,
  RetentionPolicy,
  SubprocessorRecord,
} from "@/shared/types/compliance";

export interface ComplianceOverview {
  checklistItems: ComplianceChecklistItem[];
  retentionPolicies: RetentionPolicy[];
  dsrQueue: DataSubjectRequest[];
  breachCases: BreachCase[];
  subprocessors: SubprocessorRecord[];
}

export interface AdminAuditEvent {
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
}

export interface DataSubjectExportResult {
  query: string;
  generated_at: string;
  user_profiles: unknown[];
  subcontractors: unknown[];
  projects: unknown[];
}

export interface DataSubjectAnonymizeResult {
  query: string;
  anonymized_user_profiles: number;
  anonymized_subcontractors: number;
  anonymized_projects: number;
  completed_at: string;
}

export interface ComplianceRetentionPurgeResult {
  admin_audit_deleted: number;
  dsr_events_deleted: number;
  breach_events_deleted: number;
  completed_at: string;
}

const defaultChecklistItems: ComplianceChecklistItem[] = [
  {
    id: "log-policy",
    area: "Logování",
    title: "Sdílená sanitizace logů",
    description:
      "Citlivé hodnoty se redigují jednotným helperem napříč runtime diagnostics a incident loggerem.",
    status: "implemented",
    priority: "P0",
  },
  {
    id: "breach-register",
    area: "Incidenty",
    title: "Breach register",
    description:
      "Chybí oddělený workflow pro GDPR breach a právní klasifikaci incidentu.",
    status: "missing",
    priority: "P0",
  },
  {
    id: "retention",
    area: "Retence",
    title: "Centrální retention matrix",
    description:
      "Incident logy už mají purge, ale ostatní datové domény zatím ne.",
    status: "partial",
    priority: "P0",
  },
  {
    id: "dsr",
    area: "DSR",
    title: "Subjektové požadavky",
    description:
      "Existují dílčí exporty, ale chybí centrální access/export/delete workflow.",
    status: "partial",
    priority: "P0",
  },
  {
    id: "mfa",
    area: "Přístupy",
    title: "MFA enforcement pro adminy",
    description:
      "Desktop biometrie existuje, ale není to compliance MFA enforcement.",
    status: "partial",
    priority: "P1",
  },
  {
    id: "cookie-consent",
    area: "Souhlasy",
    title: "Cookie consent vrstva",
    description:
      "Cookie policy stránka existuje, ale chybí reálný consent manager.",
    status: "missing",
    priority: "P1",
  },
];

const defaultRetentionPolicies: RetentionPolicy[] = [
  {
    id: "incident-logs",
    category: "Incident logy",
    purpose: "Diagnostika a bezpečnostní dohled",
    retentionDays: 60,
    status: "implemented",
  },
  {
    id: "runtime-diagnostics",
    category: "Runtime diagnostics",
    purpose: "Krátkodobá lokální diagnostika klienta",
    retentionDays: 0,
    status: "partial",
  },
  {
    id: "contacts-projects",
    category: "Kontakty a projektová data",
    purpose: "Obchodní a realizační agenda",
    retentionDays: 0,
    status: "missing",
  },
];

const defaultDsrQueue: DataSubjectRequest[] = [
  {
    id: "DSR-BOOTSTRAP-1",
    requestType: "export",
    subjectLabel: "Připravit centrální export osobních údajů",
    status: "new",
    dueAt: "2026-03-19",
  },
  {
    id: "DSR-BOOTSTRAP-2",
    requestType: "erasure",
    subjectLabel: "Navrhnout delete/anonymize orchestraci",
    status: "in_progress",
    dueAt: "2026-03-22",
  },
];

const defaultBreachCases: BreachCase[] = [
  {
    id: "BREACH-BOOTSTRAP-1",
    title: "Oddělit runtime incidenty od GDPR breach case",
    status: "triage",
    riskLevel: "high",
    linkedIncidentId: null,
  },
];

const defaultSubprocessors: SubprocessorRecord[] = [
  {
    id: "subprocessors-missing",
    name: "Registry zatím není zaveden",
    region: "n/a",
    purpose: "Doplnit v další fázi",
    transferMechanism: "n/a",
  },
];

const normalizeChecklistItems = (rows: unknown): ComplianceChecklistItem[] => {
  if (!Array.isArray(rows) || rows.length === 0) return defaultChecklistItems;
  return rows.map((row, index) => {
    const item = row as Record<string, unknown>;
    return {
      id: String(item.id || `check-${index}`),
      area: String(item.area || "Compliance"),
      title: String(item.title || "Checklist položka"),
      description: String(item.description || ""),
      status:
        item.status === "implemented" || item.status === "partial" || item.status === "missing"
          ? item.status
          : "missing",
      priority: item.priority === "P1" || item.priority === "P2" ? item.priority : "P0",
    };
  });
};

const normalizeRetentionPolicies = (rows: unknown): RetentionPolicy[] => {
  if (!Array.isArray(rows) || rows.length === 0) return defaultRetentionPolicies;
  return rows.map((row, index) => {
    const item = row as Record<string, unknown>;
    return {
      id: String(item.id || `retention-${index}`),
      category: String(item.category || "Neznámá kategorie"),
      purpose: String(item.purpose || ""),
      retentionDays: Number(item.retention_days || 0),
      status:
        item.status === "implemented" || item.status === "partial" || item.status === "missing"
          ? item.status
          : "missing",
    };
  });
};

const normalizeDsrQueue = (rows: unknown): DataSubjectRequest[] => {
  if (!Array.isArray(rows) || rows.length === 0) return defaultDsrQueue;
  return rows.map((row, index) => {
    const item = row as Record<string, unknown>;
    const requestType =
      item.request_type === "access" ||
      item.request_type === "export" ||
      item.request_type === "rectification" ||
      item.request_type === "erasure"
        ? item.request_type
        : "access";
    const status =
      item.status === "new" || item.status === "in_progress" || item.status === "completed"
        ? item.status
        : "new";

    return {
      id: String(item.id || `dsr-${index}`),
      requestType,
      subjectLabel: String(item.subject_label || "Požadavek subjektu"),
      status,
      dueAt: String(item.due_at || ""),
    };
  });
};

const normalizeBreachCases = (rows: unknown): BreachCase[] => {
  if (!Array.isArray(rows) || rows.length === 0) return defaultBreachCases;
  return rows.map((row, index) => {
    const item = row as Record<string, unknown>;
    const status =
      item.status === "triage" ||
      item.status === "assessment" ||
      item.status === "reported" ||
      item.status === "closed"
        ? item.status
        : "triage";
    const riskLevel =
      item.risk_level === "low" || item.risk_level === "medium" || item.risk_level === "high"
        ? item.risk_level
        : "medium";

    return {
      id: String(item.id || `breach-${index}`),
      title: String(item.title || "Breach case"),
      status,
      riskLevel,
      linkedIncidentId:
        item.linked_incident_id === null || item.linked_incident_id === undefined
          ? null
          : String(item.linked_incident_id),
    };
  });
};

const normalizeSubprocessors = (rows: unknown): SubprocessorRecord[] => {
  if (!Array.isArray(rows) || rows.length === 0) return defaultSubprocessors;
  return rows.map((row, index) => {
    const item = row as Record<string, unknown>;
    return {
      id: String(item.id || `subprocessor-${index}`),
      name: String(item.name || "Subprocessor"),
      region: String(item.region || "n/a"),
      purpose: String(item.purpose || ""),
      transferMechanism: String(item.transfer_mechanism || "n/a"),
    };
  });
};

export const getComplianceOverviewAdmin = async (): Promise<ComplianceOverview> => {
  try {
    const checklistResult = await dbAdapter
      .from("compliance_checklist_items")
      .select("*")
      .order("priority")
      .order("title");

    if (checklistResult.error) {
      throw checklistResult.error;
    }

    const retentionResult = await dbAdapter
      .from("compliance_retention_policies")
      .select("*")
      .order("retention_days", { ascending: false });
    const dsrResult = await dbAdapter.from("data_subject_requests").select("*").order("due_at");
    const breachResult = await dbAdapter
      .from("breach_cases")
      .select("*")
      .order("created_at", { ascending: false });
    const subprocessorsResult = await dbAdapter.from("subprocessors").select("*").order("name");

    if (
      retentionResult.error ||
      dsrResult.error ||
      breachResult.error ||
      subprocessorsResult.error
    ) {
      throw (
        retentionResult.error ||
        dsrResult.error ||
        breachResult.error ||
        subprocessorsResult.error
      );
    }

    return {
      checklistItems: normalizeChecklistItems(checklistResult.data),
      retentionPolicies: normalizeRetentionPolicies(retentionResult.data),
      dsrQueue: normalizeDsrQueue(dsrResult.data),
      breachCases: normalizeBreachCases(breachResult.data),
      subprocessors: normalizeSubprocessors(subprocessorsResult.data),
    };
  } catch {
    return {
      checklistItems: defaultChecklistItems,
      retentionPolicies: defaultRetentionPolicies,
      dsrQueue: defaultDsrQueue,
      breachCases: defaultBreachCases,
      subprocessors: defaultSubprocessors,
    };
  }
};

const writeAdminAuditEvent = async (event: AdminAuditEvent): Promise<void> => {
  await dbAdapter.from("admin_audit_events").insert({
    actor: event.actor,
    action: event.action,
    target_type: event.targetType,
    target_id: event.targetId,
    summary: event.summary,
  });
};

const writeDataSubjectRequestEvent = async (input: {
  requestId: string;
  eventType: string;
  summary: string;
  actor?: string;
}): Promise<void> => {
  await dbAdapter.from("data_subject_request_events").insert({
    request_id: input.requestId,
    event_type: input.eventType,
    summary: input.summary,
    actor: input.actor ?? "admin",
  });
};

const writeBreachCaseEvent = async (input: {
  breachCaseId: string;
  eventType: string;
  summary: string;
  actor?: string;
}): Promise<void> => {
  await dbAdapter.from("breach_case_events").insert({
    breach_case_id: input.breachCaseId,
    event_type: input.eventType,
    summary: input.summary,
    actor: input.actor ?? "admin",
  });
};

export const createDataSubjectRequestAdmin = async (input: {
  id: string;
  requestType: DataSubjectRequest["requestType"];
  subjectLabel: string;
  dueAt: string;
  actor?: string;
}): Promise<void> => {
  const { error } = await dbAdapter.from("data_subject_requests").insert({
    id: input.id,
    request_type: input.requestType,
    subject_label: input.subjectLabel,
    status: "new",
    due_at: input.dueAt,
  });

  if (error) throw error;

  await writeAdminAuditEvent({
    actor: input.actor ?? "admin",
    action: "create_dsr_request",
    targetType: "data_subject_request",
    targetId: input.id,
    summary: `Vytvořen DSR request ${input.requestType} pro ${input.subjectLabel}`,
  });
  await writeDataSubjectRequestEvent({
    requestId: input.id,
    eventType: "created",
    summary: `Požadavek založen jako ${input.requestType}`,
    actor: input.actor,
  });
};

export const updateDataSubjectRequestStatusAdmin = async (input: {
  id: string;
  status: DataSubjectRequest["status"];
  actor?: string;
}): Promise<void> => {
  const { error } = await dbAdapter
    .from("data_subject_requests")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.id);

  if (error) throw error;

  await writeAdminAuditEvent({
    actor: input.actor ?? "admin",
    action: "update_dsr_status",
    targetType: "data_subject_request",
    targetId: input.id,
    summary: `DSR request ${input.id} změněn na stav ${input.status}`,
  });
  await writeDataSubjectRequestEvent({
    requestId: input.id,
    eventType: "status_changed",
    summary: `Stav změněn na ${input.status}`,
    actor: input.actor,
  });
};

export const createBreachCaseAdmin = async (input: {
  id: string;
  title: string;
  riskLevel: BreachCase["riskLevel"];
  linkedIncidentId?: string | null;
  actor?: string;
}): Promise<void> => {
  const { error } = await dbAdapter.from("breach_cases").insert({
    id: input.id,
    title: input.title,
    status: "triage",
    risk_level: input.riskLevel,
    linked_incident_id: input.linkedIncidentId ?? null,
  });

  if (error) throw error;

  await writeAdminAuditEvent({
    actor: input.actor ?? "admin",
    action: "create_breach_case",
    targetType: "breach_case",
    targetId: input.id,
    summary: `Vytvořen breach case ${input.title}`,
  });
  await writeBreachCaseEvent({
    breachCaseId: input.id,
    eventType: "created",
    summary: "Breach case založen",
    actor: input.actor,
  });
};

export const updateBreachCaseStatusAdmin = async (input: {
  id: string;
  status: BreachCase["status"];
  actor?: string;
}): Promise<void> => {
  const { error } = await dbAdapter
    .from("breach_cases")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.id);

  if (error) throw error;

  await writeAdminAuditEvent({
    actor: input.actor ?? "admin",
    action: "update_breach_status",
    targetType: "breach_case",
    targetId: input.id,
    summary: `Breach case ${input.id} změněn na stav ${input.status}`,
  });
  await writeBreachCaseEvent({
    breachCaseId: input.id,
    eventType: "status_changed",
    summary: `Stav změněn na ${input.status}`,
    actor: input.actor,
  });
};

export const exportDataSubjectAdmin = async (input: {
  query: string;
  actor?: string;
}): Promise<DataSubjectExportResult> => {
  const { data, error } = await dbAdapter.rpc<DataSubjectExportResult>(
    "get_data_subject_export_admin",
    {
      subject_query: input.query,
    },
  );

  if (error) throw error;

  await writeAdminAuditEvent({
    actor: input.actor ?? "admin",
    action: "export_dsr_data",
    targetType: "data_subject",
    targetId: input.query,
    summary: `Vygenerován export osobních údajů pro dotaz ${input.query}`,
  });

  return (data ?? {
    query: input.query,
    generated_at: new Date().toISOString(),
    user_profiles: [],
    subcontractors: [],
    projects: [],
  }) as DataSubjectExportResult;
};

export const anonymizeDataSubjectAdmin = async (input: {
  query: string;
  actor?: string;
}): Promise<DataSubjectAnonymizeResult> => {
  const { data, error } = await dbAdapter.rpc<DataSubjectAnonymizeResult>(
    "anonymize_data_subject_admin",
    {
      subject_query: input.query,
    },
  );

  if (error) throw error;

  await writeAdminAuditEvent({
    actor: input.actor ?? "admin",
    action: "anonymize_dsr_data",
    targetType: "data_subject",
    targetId: input.query,
    summary: `Spuštěna anonymizace osobních údajů pro dotaz ${input.query}`,
  });

  return (data ?? {
    query: input.query,
    anonymized_user_profiles: 0,
    anonymized_subcontractors: 0,
    anonymized_projects: 0,
    completed_at: new Date().toISOString(),
  }) as DataSubjectAnonymizeResult;
};

export const saveComplianceRetentionPolicyAdmin = async (input: {
  id: string;
  category: string;
  purpose: string;
  retentionDays: number;
  status: RetentionPolicy["status"];
  notes?: string;
  actor?: string;
}): Promise<void> => {
  const { error } = await dbAdapter.from("compliance_retention_policies").upsert(
    {
      id: input.id,
      category: input.category,
      purpose: input.purpose,
      retention_days: input.retentionDays,
      status: input.status,
      notes: input.notes ?? "",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) throw error;

  await writeAdminAuditEvent({
    actor: input.actor ?? "admin",
    action: "save_retention_policy",
    targetType: "retention_policy",
    targetId: input.id,
    summary: `Uložena retention policy ${input.id} na ${input.retentionDays} dní`,
  });
};

export const saveSubprocessorAdmin = async (input: {
  id: string;
  name: string;
  region: string;
  purpose: string;
  transferMechanism: string;
  notes?: string;
  actor?: string;
}): Promise<void> => {
  const { error } = await dbAdapter.from("subprocessors").upsert(
    {
      id: input.id,
      name: input.name,
      region: input.region,
      purpose: input.purpose,
      transfer_mechanism: input.transferMechanism,
      notes: input.notes ?? "",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) throw error;

  await writeAdminAuditEvent({
    actor: input.actor ?? "admin",
    action: "save_subprocessor",
    targetType: "subprocessor",
    targetId: input.id,
    summary: `Uložen subprocessor ${input.name} (${input.region})`,
  });
};

export const runComplianceRetentionPurgeAdmin =
  async (): Promise<ComplianceRetentionPurgeResult> => {
    const { data, error } = await dbAdapter.rpc<ComplianceRetentionPurgeResult>(
      "run_compliance_retention_purge_admin",
    );

    if (error) throw error;

    return (data ?? {
      admin_audit_deleted: 0,
      dsr_events_deleted: 0,
      breach_events_deleted: 0,
      completed_at: new Date().toISOString(),
    }) as ComplianceRetentionPurgeResult;
  };
