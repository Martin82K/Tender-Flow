import { dbAdapter } from "@/services/dbAdapter";
import type {
  BreachCase,
  BreachCaseEvent,
  ComplianceChecklistItem,
  DataSubjectRequest,
  ProcessingActivityRecord,
  RetentionPolicy,
  SubprocessorRecord,
} from "@/shared/types/compliance";

export interface ComplianceOverview {
  checklistItems: ComplianceChecklistItem[];
  retentionPolicies: RetentionPolicy[];
  dsrQueue: DataSubjectRequest[];
  breachCases: BreachCase[];
  breachCaseEvents: BreachCaseEvent[];
  subprocessors: SubprocessorRecord[];
  processingActivities: ProcessingActivityRecord[];
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
    id: "ropa",
    area: "ROPA",
    title: "Záznamy o činnostech zpracování",
    description:
      "Je potřeba centrální evidence účelů, právních titulů, kategorií dat a vazeb na retenci.",
    status: "partial",
    priority: "P1",
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
    assessmentSummary: "Zatím chybí workflow pro formální posouzení a 72h evidenci.",
    authorityNotifiedAt: null,
    dataSubjectsNotifiedAt: null,
    createdAt: "2026-03-12T09:00:00.000Z",
  },
];

const defaultBreachCaseEvents: BreachCaseEvent[] = [
  {
    id: "breach-event-bootstrap-1",
    breachCaseId: "BREACH-BOOTSTRAP-1",
    eventType: "created",
    summary: "Bootstrap breach case založen pro dokončení GDPR workflow.",
    actor: "system",
    createdAt: "2026-03-12T09:00:00.000Z",
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

const defaultProcessingActivities: ProcessingActivityRecord[] = [
  {
    id: "processing-activities-missing",
    activityName: "Registr činností zatím není doplněn",
    purpose: "Doplnit v další fázi",
    legalBasis: "n/a",
    dataCategories: ["n/a"],
    retentionPolicyId: null,
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
      assessmentSummary: String(item.assessment_summary || ""),
      authorityNotifiedAt:
        item.authority_notified_at === null || item.authority_notified_at === undefined
          ? null
          : String(item.authority_notified_at),
      dataSubjectsNotifiedAt:
        item.data_subjects_notified_at === null || item.data_subjects_notified_at === undefined
          ? null
          : String(item.data_subjects_notified_at),
      createdAt: String(item.created_at || new Date().toISOString()),
    };
  });
};

const normalizeBreachCaseEvents = (rows: unknown): BreachCaseEvent[] => {
  if (!Array.isArray(rows) || rows.length === 0) return defaultBreachCaseEvents;
  return rows.map((row, index) => {
    const item = row as Record<string, unknown>;
    return {
      id: String(item.id || `breach-event-${index}`),
      breachCaseId: String(item.breach_case_id || ""),
      eventType: String(item.event_type || "note"),
      summary: String(item.summary || ""),
      actor: String(item.actor || "admin"),
      createdAt: String(item.created_at || new Date().toISOString()),
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

const normalizeProcessingActivities = (rows: unknown): ProcessingActivityRecord[] => {
  if (!Array.isArray(rows) || rows.length === 0) return defaultProcessingActivities;
  return rows.map((row, index) => {
    const item = row as Record<string, unknown>;
    const dataCategories = Array.isArray(item.data_categories)
      ? item.data_categories.map((value) => String(value))
      : typeof item.data_categories === "string" && item.data_categories.length > 0
        ? item.data_categories.split(",").map((value) => value.trim()).filter(Boolean)
        : ["n/a"];

    return {
      id: String(item.id || `processing-activity-${index}`),
      activityName: String(item.activity_name || "Činnost zpracování"),
      purpose: String(item.purpose || ""),
      legalBasis: String(item.legal_basis || "n/a"),
      dataCategories,
      retentionPolicyId:
        item.retention_policy_id === null || item.retention_policy_id === undefined
          ? null
          : String(item.retention_policy_id),
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
    const breachEventsResult = await dbAdapter
      .from("breach_case_events")
      .select("*")
      .order("created_at", { ascending: false });
    const subprocessorsResult = await dbAdapter.from("subprocessors").select("*").order("name");
    const processingActivitiesResult = await dbAdapter
      .from("processing_activities")
      .select("*")
      .order("activity_name");

    if (
      retentionResult.error ||
      dsrResult.error ||
      breachResult.error ||
      breachEventsResult.error ||
      subprocessorsResult.error ||
      processingActivitiesResult.error
    ) {
      throw (
        retentionResult.error ||
        dsrResult.error ||
        breachResult.error ||
        breachEventsResult.error ||
        subprocessorsResult.error ||
        processingActivitiesResult.error
      );
    }

    return {
      checklistItems: normalizeChecklistItems(checklistResult.data),
      retentionPolicies: normalizeRetentionPolicies(retentionResult.data),
      dsrQueue: normalizeDsrQueue(dsrResult.data),
      breachCases: normalizeBreachCases(breachResult.data),
      breachCaseEvents: normalizeBreachCaseEvents(breachEventsResult.data),
      subprocessors: normalizeSubprocessors(subprocessorsResult.data),
      processingActivities: normalizeProcessingActivities(processingActivitiesResult.data),
    };
  } catch {
    return {
      checklistItems: defaultChecklistItems,
      retentionPolicies: defaultRetentionPolicies,
      dsrQueue: defaultDsrQueue,
      breachCases: defaultBreachCases,
      breachCaseEvents: defaultBreachCaseEvents,
      subprocessors: defaultSubprocessors,
      processingActivities: defaultProcessingActivities,
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
    assessment_summary: "",
    authority_notified_at: null,
    data_subjects_notified_at: null,
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

export const saveBreachAssessmentAdmin = async (input: {
  id: string;
  assessmentSummary: string;
  actor?: string;
}): Promise<void> => {
  const { error } = await dbAdapter
    .from("breach_cases")
    .update({
      assessment_summary: input.assessmentSummary,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) throw error;

  await writeAdminAuditEvent({
    actor: input.actor ?? "admin",
    action: "save_breach_assessment",
    targetType: "breach_case",
    targetId: input.id,
    summary: `Uloženo posouzení breach case ${input.id}`,
  });
  await writeBreachCaseEvent({
    breachCaseId: input.id,
    eventType: "assessment_saved",
    summary: input.assessmentSummary,
    actor: input.actor,
  });
};

export const addBreachCaseTimelineEventAdmin = async (input: {
  breachCaseId: string;
  summary: string;
  actor?: string;
}): Promise<void> => {
  await writeAdminAuditEvent({
    actor: input.actor ?? "admin",
    action: "add_breach_timeline_event",
    targetType: "breach_case",
    targetId: input.breachCaseId,
    summary: `Doplněn timeline krok pro breach case ${input.breachCaseId}`,
  });
  await writeBreachCaseEvent({
    breachCaseId: input.breachCaseId,
    eventType: "note",
    summary: input.summary,
    actor: input.actor,
  });
};

export const markBreachNotificationAdmin = async (input: {
  id: string;
  target: "authority" | "data_subjects";
  actor?: string;
}): Promise<void> => {
  const nowIso = new Date().toISOString();
  const patch =
    input.target === "authority"
      ? { authority_notified_at: nowIso, updated_at: nowIso }
      : { data_subjects_notified_at: nowIso, updated_at: nowIso };

  const { error } = await dbAdapter.from("breach_cases").update(patch).eq("id", input.id);

  if (error) throw error;

  await writeAdminAuditEvent({
    actor: input.actor ?? "admin",
    action:
      input.target === "authority"
        ? "mark_breach_authority_notification"
        : "mark_breach_data_subject_notification",
    targetType: "breach_case",
    targetId: input.id,
    summary:
      input.target === "authority"
        ? `Zapsáno hlášení ÚOOÚ pro breach case ${input.id}`
        : `Zapsáno informování subjektů pro breach case ${input.id}`,
  });
  await writeBreachCaseEvent({
    breachCaseId: input.id,
    eventType: input.target === "authority" ? "authority_notified" : "data_subjects_notified",
    summary:
      input.target === "authority"
        ? "Zapsáno hlášení ÚOOÚ"
        : "Zapsáno informování dotčených subjektů",
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

export const saveProcessingActivityAdmin = async (input: {
  id: string;
  activityName: string;
  purpose: string;
  legalBasis: string;
  dataCategories: string[];
  retentionPolicyId?: string | null;
  notes?: string;
  actor?: string;
}): Promise<void> => {
  const { error } = await dbAdapter.from("processing_activities").upsert(
    {
      id: input.id,
      activity_name: input.activityName,
      purpose: input.purpose,
      legal_basis: input.legalBasis,
      data_categories: input.dataCategories,
      retention_policy_id: input.retentionPolicyId ?? null,
      notes: input.notes ?? "",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) throw error;

  await writeAdminAuditEvent({
    actor: input.actor ?? "admin",
    action: "save_processing_activity",
    targetType: "processing_activity",
    targetId: input.id,
    summary: `Uložena činnost zpracování ${input.activityName}`,
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
