import { dbAdapter } from "@/services/dbAdapter";
import {
  complianceBootstrapCrmRetentionReviews,
  complianceBootstrapProcessingActivities,
  complianceBootstrapRetentionPolicies,
  complianceBootstrapSubprocessors,
} from "@/shared/compliance/complianceRegistryBootstrap";
import type {
  AccessAuditEntry,
  AccessReviewReport,
  AccessReviewUser,
  BreachCase,
  BreachCaseEvent,
  ComplianceChecklistItem,
  CrmRetentionReview,
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
  crmRetentionReviews: CrmRetentionReview[];
  accessReviewUsers: AccessReviewUser[];
  accessAuditEntries: AccessAuditEntry[];
  accessReviewReports: AccessReviewReport[];
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
  notifications_deleted: number;
  password_reset_tokens_deleted: number;
  feature_usage_deleted: number;
  ai_agent_usage_deleted: number;
  ai_voice_usage_deleted: number;
  completed_at: string;
}

export interface BreachAuthorityReportResult {
  fileName: string;
  mimeType: string;
  content: string;
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

const defaultRetentionPolicies: RetentionPolicy[] = complianceBootstrapRetentionPolicies;

const defaultDsrQueue: DataSubjectRequest[] = [
  {
    id: "DSR-BOOTSTRAP-1",
    requestType: "export",
    subjectLabel: "Připravit centrální export osobních údajů",
    requesterLabel: "Zatím neurčeno",
    intakeChannel: "internal",
    verificationStatus: "not_required",
    resolutionSummary: "Doplnit provozní pravidla pro export a doložení identity žadatele.",
    status: "new",
    dueAt: "2026-03-19",
  },
  {
    id: "DSR-BOOTSTRAP-2",
    requestType: "erasure",
    subjectLabel: "Navrhnout delete/anonymize orchestraci",
    requesterLabel: "Zatím neurčeno",
    intakeChannel: "internal",
    verificationStatus: "not_required",
    resolutionSummary: "Výmaz zůstává evidenční; produkční mazání není z UI povolené.",
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
    affectedDataCategories: ["n/a"],
    affectedSubjectTypes: ["n/a"],
    estimatedSubjectCount: null,
    notificationRationale: "Zatím není doplněné rozhodnutí o hlášení nebo nehlášení.",
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

const defaultSubprocessors: SubprocessorRecord[] = complianceBootstrapSubprocessors;

const defaultProcessingActivities: ProcessingActivityRecord[] = complianceBootstrapProcessingActivities;
const defaultCrmRetentionReviews: CrmRetentionReview[] = complianceBootstrapCrmRetentionReviews;

const defaultAccessReviewUsers: AccessReviewUser[] = [];
const defaultAccessAuditEntries: AccessAuditEntry[] = [];
const defaultAccessReviewReports: AccessReviewReport[] = [];
const missingComplianceResources = new Set<string>();

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return "";
};

const getErrorCode = (error: unknown): string => {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code ?? "");
  }
  return "";
};

const isMissingSupabaseResourceError = (error: unknown): boolean => {
  const code = getErrorCode(error).toUpperCase();
  const message = getErrorMessage(error).toLowerCase();

  return (
    code === "PGRST202" ||
    code === "PGRST205" ||
    message.includes("could not find the function") ||
    message.includes("could not find the table") ||
    message.includes("relation") && message.includes("does not exist")
  );
};

const loadResourceOrDefault = async <T>(
  resourceKey: string,
  loader: () => Promise<{ data: T | null; error: unknown }>,
  fallback: T,
): Promise<T> => {
  if (missingComplianceResources.has(resourceKey)) {
    return fallback;
  }

  const result = await loader();

  if (result.error) {
    if (isMissingSupabaseResourceError(result.error)) {
      missingComplianceResources.add(resourceKey);
      return fallback;
    }
    throw result.error;
  }

  return (result.data ?? fallback) as T;
};

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
      requesterLabel: String(item.requester_label || "Neuvedeno"),
      intakeChannel:
        item.intake_channel === "email" ||
        item.intake_channel === "form" ||
        item.intake_channel === "phone" ||
        item.intake_channel === "support" ||
        item.intake_channel === "internal"
          ? item.intake_channel
          : "email",
      verificationStatus:
        item.verification_status === "pending" ||
        item.verification_status === "verified" ||
        item.verification_status === "not_required"
          ? item.verification_status
          : "pending",
      resolutionSummary: String(item.resolution_summary || ""),
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
      affectedDataCategories: Array.isArray(item.affected_data_categories)
        ? item.affected_data_categories.map((value) => String(value))
        : typeof item.affected_data_categories === "string" && item.affected_data_categories.length > 0
          ? item.affected_data_categories.split(",").map((value) => value.trim()).filter(Boolean)
          : [],
      affectedSubjectTypes: Array.isArray(item.affected_subject_types)
        ? item.affected_subject_types.map((value) => String(value))
        : typeof item.affected_subject_types === "string" && item.affected_subject_types.length > 0
          ? item.affected_subject_types.split(",").map((value) => value.trim()).filter(Boolean)
          : [],
      estimatedSubjectCount:
        item.estimated_subject_count === null || item.estimated_subject_count === undefined
          ? null
          : Number(item.estimated_subject_count),
      notificationRationale: String(item.notification_rationale || ""),
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

const normalizeProcessingActivities = (
  rows: unknown,
  links: unknown,
): ProcessingActivityRecord[] => {
  if (!Array.isArray(rows) || rows.length === 0) return defaultProcessingActivities;

  const linksByActivity = new Map<string, string[]>();
  if (Array.isArray(links)) {
    for (const row of links) {
      const item = row as Record<string, unknown>;
      const activityId = String(item.processing_activity_id || "");
      const subprocessorId = String(item.subprocessor_id || "");
      if (!activityId || !subprocessorId) continue;
      const existing = linksByActivity.get(activityId) ?? [];
      existing.push(subprocessorId);
      linksByActivity.set(activityId, existing);
    }
  }

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
      linkedSubprocessorIds: linksByActivity.get(String(item.id || `processing-activity-${index}`)) ?? [],
    };
  });
};

const normalizeAccessReviewUsers = (rows: unknown): AccessReviewUser[] => {
  if (!Array.isArray(rows) || rows.length === 0) return defaultAccessReviewUsers;
  return rows.map((row, index) => {
    const item = row as Record<string, unknown>;
    return {
      userId: String(item.user_id || `access-user-${index}`),
      email: String(item.email || ""),
      displayName: String(item.display_name || ""),
      appRoleId:
        item.app_role_id === null || item.app_role_id === undefined ? null : String(item.app_role_id),
      appRoleLabel:
        item.app_role_label === null || item.app_role_label === undefined
          ? null
          : String(item.app_role_label),
      orgRoles: Array.isArray(item.org_roles) ? item.org_roles.map((value) => String(value)) : [],
      lastSignIn:
        item.last_sign_in === null || item.last_sign_in === undefined ? null : String(item.last_sign_in),
      riskFlags: Array.isArray(item.risk_flags) ? item.risk_flags.map((value) => String(value)) : [],
    };
  });
};

const normalizeCrmRetentionReviews = (rows: unknown): CrmRetentionReview[] => {
  if (!Array.isArray(rows) || rows.length === 0) return defaultCrmRetentionReviews;
  return rows.map((row, index) => {
    const item = row as Record<string, unknown>;
    return {
      id: String(item.id || `crm-retention-${index}`),
      domainKey: String(item.domain_key || `domain-${index}`),
      domainLabel: String(item.domain_label || "CRM datová doména"),
      retentionPolicyId:
        item.retention_policy_id === null || item.retention_policy_id === undefined
          ? null
          : String(item.retention_policy_id),
      reviewStatus:
        item.review_status === "approved" || item.review_status === "blocked"
          ? item.review_status
          : "planned",
      manualWorkflowSummary: String(item.manual_workflow_summary || ""),
      nextReviewAt:
        item.next_review_at === null || item.next_review_at === undefined
          ? null
          : String(item.next_review_at),
    };
  });
};

const normalizeAccessAuditEntries = (rows: unknown): AccessAuditEntry[] => {
  if (!Array.isArray(rows) || rows.length === 0) return defaultAccessAuditEntries;
  return rows.map((row, index) => {
    const item = row as Record<string, unknown>;
    return {
      id: String(item.id || `access-audit-${index}`),
      eventType: String(item.event_type || "unknown"),
      actorEmail:
        item.actor_email === null || item.actor_email === undefined ? null : String(item.actor_email),
      targetUserEmail:
        item.target_user_email === null || item.target_user_email === undefined
          ? null
          : String(item.target_user_email),
      targetRoleId:
        item.target_role_id === null || item.target_role_id === undefined
          ? null
          : String(item.target_role_id),
      permissionKey:
        item.permission_key === null || item.permission_key === undefined
          ? null
          : String(item.permission_key),
      oldValue: item.old_value === null || item.old_value === undefined ? null : String(item.old_value),
      newValue: item.new_value === null || item.new_value === undefined ? null : String(item.new_value),
      summary: String(item.summary || ""),
      createdAt: String(item.created_at || new Date().toISOString()),
    };
  });
};

const normalizeAccessReviewReports = (rows: unknown): AccessReviewReport[] => {
  if (!Array.isArray(rows) || rows.length === 0) return defaultAccessReviewReports;
  return rows.map((row, index) => {
    const item = row as Record<string, unknown>;
    return {
      id: String(item.id || `access-review-${index}`),
      reviewScope: String(item.review_scope || "all_admin_access"),
      summary: String(item.summary || ""),
      reviewedByEmail:
        item.reviewed_by_email === null || item.reviewed_by_email === undefined
          ? null
          : String(item.reviewed_by_email),
      totalUsers: Number(item.total_users || 0),
      adminUsers: Number(item.admin_users || 0),
      staleUsers: Number(item.stale_users || 0),
      createdAt: String(item.created_at || new Date().toISOString()),
    };
  });
};

export const getComplianceOverviewAdmin = async (): Promise<ComplianceOverview> => {
  try {
    const checklistRows = await loadResourceOrDefault(
      "table:compliance_checklist_items",
      () =>
        dbAdapter
          .from("compliance_checklist_items")
          .select("*")
          .order("priority")
          .order("title"),
      defaultChecklistItems,
    );
    const retentionRows = await loadResourceOrDefault(
      "table:compliance_retention_policies",
      () =>
        dbAdapter
          .from("compliance_retention_policies")
          .select("*")
          .order("retention_days", { ascending: false }),
      defaultRetentionPolicies,
    );
    const dsrRows = await loadResourceOrDefault(
      "table:data_subject_requests",
      () => dbAdapter.from("data_subject_requests").select("*").order("due_at"),
      defaultDsrQueue,
    );
    const breachRows = await loadResourceOrDefault(
      "table:breach_cases",
      () =>
        dbAdapter
          .from("breach_cases")
          .select("*")
          .order("created_at", { ascending: false }),
      defaultBreachCases,
    );
    const breachEventRows = await loadResourceOrDefault(
      "table:breach_case_events",
      () =>
        dbAdapter
          .from("breach_case_events")
          .select("*")
          .order("created_at", { ascending: false }),
      defaultBreachCaseEvents,
    );
    const subprocessorRows = await loadResourceOrDefault(
      "table:subprocessors",
      () => dbAdapter.from("subprocessors").select("*").order("name"),
      defaultSubprocessors,
    );
    const processingActivityRows = await loadResourceOrDefault(
      "table:processing_activities",
      () => dbAdapter.from("processing_activities").select("*").order("activity_name"),
      defaultProcessingActivities,
    );
    const processingActivityLinkRows = await loadResourceOrDefault(
      "table:processing_activity_subprocessors",
      () => dbAdapter.from("processing_activity_subprocessors").select("*").order("processing_activity_id"),
      [] as unknown[],
    );
    const crmRetentionReviewRows = await loadResourceOrDefault(
      "table:compliance_crm_retention_reviews",
      () => dbAdapter.from("compliance_crm_retention_reviews").select("*").order("domain_label"),
      defaultCrmRetentionReviews,
    );
    const accessReviewData = await loadResourceOrDefault(
      "rpc:get_access_review_overview_admin",
      () =>
        dbAdapter.rpcRest<{
          users: unknown[];
          audit_entries: unknown[];
          review_reports: unknown[];
        }>("get_access_review_overview_admin"),
      {
        users: [],
        audit_entries: [],
        review_reports: [],
      },
    );

    return {
      checklistItems: normalizeChecklistItems(checklistRows),
      retentionPolicies: normalizeRetentionPolicies(retentionRows),
      dsrQueue: normalizeDsrQueue(dsrRows),
      breachCases: normalizeBreachCases(breachRows),
      breachCaseEvents: normalizeBreachCaseEvents(breachEventRows),
      subprocessors: normalizeSubprocessors(subprocessorRows),
      processingActivities: normalizeProcessingActivities(
        processingActivityRows,
        processingActivityLinkRows,
      ),
      crmRetentionReviews: normalizeCrmRetentionReviews(crmRetentionReviewRows),
      accessReviewUsers: normalizeAccessReviewUsers(accessReviewData.users),
      accessAuditEntries: normalizeAccessAuditEntries(accessReviewData.audit_entries),
      accessReviewReports: normalizeAccessReviewReports(accessReviewData.review_reports),
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
      crmRetentionReviews: defaultCrmRetentionReviews,
      accessReviewUsers: defaultAccessReviewUsers,
      accessAuditEntries: defaultAccessAuditEntries,
      accessReviewReports: defaultAccessReviewReports,
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
  requesterLabel?: string;
  intakeChannel?: DataSubjectRequest["intakeChannel"];
  verificationStatus?: DataSubjectRequest["verificationStatus"];
  resolutionSummary?: string;
  dueAt: string;
  actor?: string;
}): Promise<void> => {
  const { error } = await dbAdapter.from("data_subject_requests").insert({
    id: input.id,
    request_type: input.requestType,
    subject_label: input.subjectLabel,
    requester_label: input.requesterLabel ?? "",
    intake_channel: input.intakeChannel ?? "email",
    verification_status: input.verificationStatus ?? "pending",
    resolution_summary: input.resolutionSummary ?? "",
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

export const saveDataSubjectRequestHandlingAdmin = async (input: {
  id: string;
  requesterLabel: string;
  intakeChannel: DataSubjectRequest["intakeChannel"];
  verificationStatus: DataSubjectRequest["verificationStatus"];
  resolutionSummary: string;
  actor?: string;
}): Promise<void> => {
  const { error } = await dbAdapter
    .from("data_subject_requests")
    .update({
      requester_label: input.requesterLabel,
      intake_channel: input.intakeChannel,
      verification_status: input.verificationStatus,
      resolution_summary: input.resolutionSummary,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) throw error;

  await writeAdminAuditEvent({
    actor: input.actor ?? "admin",
    action: "save_dsr_handling",
    targetType: "data_subject_request",
    targetId: input.id,
    summary: `Doplněna evidence vyřízení DSR requestu ${input.id}`,
  });
  await writeDataSubjectRequestEvent({
    requestId: input.id,
    eventType: "handling_saved",
    summary: `Kanál: ${input.intakeChannel} • Ověření: ${input.verificationStatus} • Žadatel: ${input.requesterLabel}`,
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
    affected_data_categories: [],
    affected_subject_types: [],
    estimated_subject_count: null,
    notification_rationale: "",
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

export const saveBreachClassificationAdmin = async (input: {
  id: string;
  affectedDataCategories: string[];
  affectedSubjectTypes: string[];
  estimatedSubjectCount: number | null;
  notificationRationale: string;
  actor?: string;
}): Promise<void> => {
  const { error } = await dbAdapter
    .from("breach_cases")
    .update({
      affected_data_categories: input.affectedDataCategories,
      affected_subject_types: input.affectedSubjectTypes,
      estimated_subject_count: input.estimatedSubjectCount,
      notification_rationale: input.notificationRationale,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) throw error;

  await writeAdminAuditEvent({
    actor: input.actor ?? "admin",
    action: "save_breach_classification",
    targetType: "breach_case",
    targetId: input.id,
    summary: `Uložena klasifikace breach case ${input.id}`,
  });
  await writeBreachCaseEvent({
    breachCaseId: input.id,
    eventType: "classification_saved",
    summary: `Kategorie dat: ${input.affectedDataCategories.join(", ") || "neuvedeno"} • Subjekty: ${input.affectedSubjectTypes.join(", ") || "neuvedeno"} • Odhad: ${input.estimatedSubjectCount ?? "neuvedeno"}`,
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
  linkedSubprocessorIds?: string[];
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

  const linkedSubprocessorIds = Array.from(new Set(input.linkedSubprocessorIds ?? []));
  if (linkedSubprocessorIds.length > 0) {
    const { error: linkError } = await dbAdapter.from("processing_activity_subprocessors").upsert(
      linkedSubprocessorIds.map((subprocessorId) => ({
        processing_activity_id: input.id,
        subprocessor_id: subprocessorId,
      })),
      { onConflict: "processing_activity_id,subprocessor_id" },
    );

    if (linkError) throw linkError;
  }

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
      notifications_deleted: 0,
      password_reset_tokens_deleted: 0,
      feature_usage_deleted: 0,
      ai_agent_usage_deleted: 0,
      ai_voice_usage_deleted: 0,
      completed_at: new Date().toISOString(),
    }) as ComplianceRetentionPurgeResult;
  };

export const saveCrmRetentionReviewAdmin = async (input: {
  id: string;
  domainKey: string;
  domainLabel: string;
  retentionPolicyId?: string | null;
  reviewStatus: CrmRetentionReview["reviewStatus"];
  manualWorkflowSummary: string;
  nextReviewAt?: string | null;
  actor?: string;
}): Promise<void> => {
  const { error } = await dbAdapter.from("compliance_crm_retention_reviews").upsert(
    {
      id: input.id,
      domain_key: input.domainKey,
      domain_label: input.domainLabel,
      retention_policy_id: input.retentionPolicyId ?? null,
      review_status: input.reviewStatus,
      manual_workflow_summary: input.manualWorkflowSummary,
      next_review_at: input.nextReviewAt ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) throw error;

  await writeAdminAuditEvent({
    actor: input.actor ?? "admin",
    action: "save_crm_retention_review",
    targetType: "crm_retention_review",
    targetId: input.id,
    summary: `Uložen retenční review plán pro ${input.domainLabel}`,
  });
};

export const createAccessReviewReportAdmin = async (input: {
  reviewScope?: string;
  summary: string;
  actor?: string;
}): Promise<string> => {
  const { data, error } = await dbAdapter.rpc<string>("create_access_review_report_admin", {
    review_scope_input: input.reviewScope ?? "all_admin_access",
    summary_input: input.summary,
  });

  if (error) throw error;

  await writeAdminAuditEvent({
    actor: input.actor ?? "admin",
    action: "create_access_review_report",
    targetType: "access_review",
    targetId: String(data ?? "access-review"),
    summary: `Vytvořen access review report: ${input.summary || "bez poznámky"}`,
  });

  return String(data ?? "");
};

export const buildBreachAuthorityReportAdmin = (input: {
  breachCase: BreachCase;
  events: BreachCaseEvent[];
}): BreachAuthorityReportResult => {
  const createdAt = input.breachCase.createdAt || new Date().toISOString();
  const deadlineAt = new Date(new Date(createdAt).getTime() + 72 * 60 * 60 * 1000).toISOString();
  const eventLines = input.events
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(
      (event) =>
        `- ${event.createdAt} | ${event.eventType} | ${event.actor}: ${event.summary}`,
    );

  const content = [
    "# Podklady pro ÚOOÚ",
    "",
    `ID případu: ${input.breachCase.id}`,
    `Název: ${input.breachCase.title}`,
    `Stav: ${input.breachCase.status}`,
    `Riziko: ${input.breachCase.riskLevel}`,
    `Vytvořeno: ${createdAt}`,
    `72h deadline: ${deadlineAt}`,
    `Navázaný incident: ${input.breachCase.linkedIncidentId ?? "neuvedeno"}`,
    `Hlášení ÚOOÚ: ${input.breachCase.authorityNotifiedAt ?? "nezapsáno"}`,
    `Informování subjektů: ${input.breachCase.dataSubjectsNotifiedAt ?? "nezapsáno"}`,
    "",
    "## Klasifikace",
    `Dotčené kategorie údajů: ${input.breachCase.affectedDataCategories.join(", ") || "neuvedeno"}`,
    `Dotčené subjekty: ${input.breachCase.affectedSubjectTypes.join(", ") || "neuvedeno"}`,
    `Odhad počtu subjektů: ${input.breachCase.estimatedSubjectCount ?? "neuvedeno"}`,
    `Důvod hlášení / nehlášení: ${input.breachCase.notificationRationale || "neuvedeno"}`,
    "",
    "## Shrnutí posouzení",
    input.breachCase.assessmentSummary || "Zatím nebylo doplněno.",
    "",
    "## Timeline kroků",
    ...(eventLines.length > 0 ? eventLines : ["- Zatím bez zapsaných kroků"]),
    "",
    "## Poznámka",
    "Tento export je interní pracovní podklad pro přípravu oznámení a auditní doložení postupu.",
  ].join("\n");

  return {
    fileName: `uoou_podklady_${input.breachCase.id}.md`,
    mimeType: "text/markdown;charset=utf-8",
    content,
  };
};
