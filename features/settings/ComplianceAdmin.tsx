import React, { useEffect, useMemo, useState } from "react";
import { useUI } from "@/context/UIContext";
import {
  addBreachCaseTimelineEventAdmin,
  buildBreachAuthorityReportAdmin,
  createAccessReviewReportAdmin,
  createBreachCaseAdmin,
  createDataSubjectRequestAdmin,
  exportDataSubjectAdmin,
  getComplianceOverviewAdmin,
  markBreachNotificationAdmin,
  saveCrmRetentionReviewAdmin,
  saveDataSubjectRequestHandlingAdmin,
  saveBreachClassificationAdmin,
  saveComplianceRetentionPolicyAdmin,
  saveBreachAssessmentAdmin,
  saveProcessingActivityAdmin,
  saveSubprocessorAdmin,
  updateBreachCaseStatusAdmin,
  updateDataSubjectRequestStatusAdmin,
} from "@/features/settings/api/complianceAdminService";
import type { ComplianceOverview } from "@/features/settings/api/complianceAdminService";
import type {
  ComplianceChecklistItem,
  CrmRetentionReview,
  DataSubjectRequest,
  BreachCase,
  RetentionPolicy,
  SubprocessorRecord,
} from "@/shared/types/compliance";

const statusMeta: Record<
  ComplianceChecklistItem["status"],
  { label: string; className: string }
> = {
  implemented: {
    label: "Hotovo",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  },
  partial: {
    label: "Částečně",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  },
  missing: {
    label: "Chybí",
    className:
      "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  },
};

const requestTypeLabel: Record<DataSubjectRequest["requestType"], string> = {
  access: "Přístup",
  export: "Export",
  rectification: "Oprava",
  erasure: "Výmaz",
};

const requestStatusLabel: Record<DataSubjectRequest["status"], string> = {
  new: "Nový",
  in_progress: "Rozpracováno",
  completed: "Hotovo",
};

const requestChannelLabel: Record<DataSubjectRequest["intakeChannel"], string> = {
  email: "E-mail",
  form: "Formulář",
  phone: "Telefon",
  support: "Support",
  internal: "Interní",
};

const requestVerificationLabel: Record<DataSubjectRequest["verificationStatus"], string> = {
  pending: "Čeká na ověření",
  verified: "Ověřeno",
  not_required: "Není potřeba",
};

type RectificationWorkflowDraft = {
  requestedFields: string;
  evidenceSource: string;
  affectedSystems: string;
  requesterCommunication: string;
};

type ErasureWorkflowDraft = {
  legalAssessment: string;
  deletionScope: string;
  blockedSystems: string;
  manualExecutionOwner: string;
  requesterCommunication: string;
};

const RECTIFICATION_SUMMARY_PREFIX = "[RECTIFICATION_WORKFLOW_V1]";
const ERASURE_SUMMARY_PREFIX = "[ERASURE_WORKFLOW_V1]";

const emptyRectificationWorkflowDraft = (): RectificationWorkflowDraft => ({
  requestedFields: "",
  evidenceSource: "",
  affectedSystems: "",
  requesterCommunication: "",
});

const parseRectificationWorkflow = (summary: string): RectificationWorkflowDraft => {
  if (!summary.startsWith(RECTIFICATION_SUMMARY_PREFIX)) {
    return emptyRectificationWorkflowDraft();
  }

  const values = summary
    .slice(RECTIFICATION_SUMMARY_PREFIX.length)
    .trim()
    .split("\n")
    .reduce<Record<string, string>>((acc, line) => {
      const [key, ...rest] = line.split(":");
      if (!key || rest.length === 0) return acc;
      acc[key.trim()] = rest.join(":").trim();
      return acc;
    }, {});

  return {
    requestedFields: values.requested_fields ?? "",
    evidenceSource: values.evidence_source ?? "",
    affectedSystems: values.affected_systems ?? "",
    requesterCommunication: values.requester_communication ?? "",
  };
};

const buildRectificationSummary = (draft: RectificationWorkflowDraft): string =>
  [
    RECTIFICATION_SUMMARY_PREFIX,
    `requested_fields: ${draft.requestedFields.trim()}`,
    `evidence_source: ${draft.evidenceSource.trim()}`,
    `affected_systems: ${draft.affectedSystems.trim()}`,
    `requester_communication: ${draft.requesterCommunication.trim()}`,
  ].join("\n");

const isRectificationWorkflowComplete = (draft: RectificationWorkflowDraft): boolean =>
  Boolean(
    draft.requestedFields.trim() &&
      draft.evidenceSource.trim() &&
      draft.affectedSystems.trim() &&
      draft.requesterCommunication.trim(),
  );

const emptyErasureWorkflowDraft = (): ErasureWorkflowDraft => ({
  legalAssessment: "",
  deletionScope: "",
  blockedSystems: "",
  manualExecutionOwner: "",
  requesterCommunication: "",
});

const parseErasureWorkflow = (summary: string): ErasureWorkflowDraft => {
  if (!summary.startsWith(ERASURE_SUMMARY_PREFIX)) {
    return emptyErasureWorkflowDraft();
  }

  const values = summary
    .slice(ERASURE_SUMMARY_PREFIX.length)
    .trim()
    .split("\n")
    .reduce<Record<string, string>>((acc, line) => {
      const [key, ...rest] = line.split(":");
      if (!key || rest.length === 0) return acc;
      acc[key.trim()] = rest.join(":").trim();
      return acc;
    }, {});

  return {
    legalAssessment: values.legal_assessment ?? "",
    deletionScope: values.deletion_scope ?? "",
    blockedSystems: values.blocked_systems ?? "",
    manualExecutionOwner: values.manual_execution_owner ?? "",
    requesterCommunication: values.requester_communication ?? "",
  };
};

const buildErasureSummary = (draft: ErasureWorkflowDraft): string =>
  [
    ERASURE_SUMMARY_PREFIX,
    `legal_assessment: ${draft.legalAssessment.trim()}`,
    `deletion_scope: ${draft.deletionScope.trim()}`,
    `blocked_systems: ${draft.blockedSystems.trim()}`,
    `manual_execution_owner: ${draft.manualExecutionOwner.trim()}`,
    `requester_communication: ${draft.requesterCommunication.trim()}`,
  ].join("\n");

const isErasureWorkflowComplete = (draft: ErasureWorkflowDraft): boolean =>
  Boolean(
    draft.legalAssessment.trim() &&
      draft.deletionScope.trim() &&
      draft.blockedSystems.trim() &&
      draft.manualExecutionOwner.trim() &&
      draft.requesterCommunication.trim(),
  );

const breachStatusLabel: Record<BreachCase["status"], string> = {
  triage: "Triage",
  assessment: "Posouzení",
  reported: "Nahlášeno",
  closed: "Uzavřeno",
};

const crmRetentionReviewStatusLabel: Record<
  CrmRetentionReview["reviewStatus"],
  string
> = {
  planned: "Plánováno",
  approved: "Schváleno",
  blocked: "Blokováno",
};

const formatDateTime = (value: string | null) => {
  if (!value) return "nezapsáno";

  try {
    return new Intl.DateTimeFormat("cs-CZ", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const COMPLIANCE_DB_SAFE_MODE = true;

export const ComplianceAdmin: React.FC = () => {
  const { showAlert } = useUI();
  const [overview, setOverview] = useState<ComplianceOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingDsr, setIsSavingDsr] = useState(false);
  const [isSavingBreach, setIsSavingBreach] = useState(false);
  const [newDsrType, setNewDsrType] = useState<DataSubjectRequest["requestType"]>("export");
  const [newDsrLabel, setNewDsrLabel] = useState("");
  const [newDsrRequesterLabel, setNewDsrRequesterLabel] = useState("");
  const [newDsrChannel, setNewDsrChannel] = useState<DataSubjectRequest["intakeChannel"]>("email");
  const [newDsrDueAt, setNewDsrDueAt] = useState("");
  const [dsrRequesterDrafts, setDsrRequesterDrafts] = useState<Record<string, string>>({});
  const [dsrChannelDrafts, setDsrChannelDrafts] = useState<Record<string, DataSubjectRequest["intakeChannel"]>>({});
  const [dsrVerificationDrafts, setDsrVerificationDrafts] = useState<Record<string, DataSubjectRequest["verificationStatus"]>>({});
  const [dsrResolutionDrafts, setDsrResolutionDrafts] = useState<Record<string, string>>({});
  const [dsrRectificationDrafts, setDsrRectificationDrafts] = useState<
    Record<string, RectificationWorkflowDraft>
  >({});
  const [dsrErasureDrafts, setDsrErasureDrafts] = useState<Record<string, ErasureWorkflowDraft>>(
    {},
  );
  const [savingDsrHandlingId, setSavingDsrHandlingId] = useState<string | null>(null);
  const [newBreachTitle, setNewBreachTitle] = useState("");
  const [newBreachRisk, setNewBreachRisk] = useState<BreachCase["riskLevel"]>("medium");
  const [newBreachIncidentId, setNewBreachIncidentId] = useState("");
  const [breachAssessmentDrafts, setBreachAssessmentDrafts] = useState<Record<string, string>>({});
  const [breachDataCategoriesDrafts, setBreachDataCategoriesDrafts] = useState<Record<string, string>>({});
  const [breachSubjectTypesDrafts, setBreachSubjectTypesDrafts] = useState<Record<string, string>>({});
  const [breachEstimatedCountDrafts, setBreachEstimatedCountDrafts] = useState<Record<string, string>>({});
  const [breachRationaleDrafts, setBreachRationaleDrafts] = useState<Record<string, string>>({});
  const [breachTimelineDrafts, setBreachTimelineDrafts] = useState<Record<string, string>>({});
  const [savingBreachAssessmentId, setSavingBreachAssessmentId] = useState<string | null>(null);
  const [savingBreachClassificationId, setSavingBreachClassificationId] = useState<string | null>(null);
  const [savingBreachTimelineId, setSavingBreachTimelineId] = useState<string | null>(null);
  const [markingBreachNotification, setMarkingBreachNotification] = useState<string | null>(null);
  const [retentionDrafts, setRetentionDrafts] = useState<Record<string, number>>({});
  const [savingRetentionId, setSavingRetentionId] = useState<string | null>(null);
  const [crmRetentionSummaryDrafts, setCrmRetentionSummaryDrafts] = useState<Record<string, string>>({});
  const [crmRetentionStatusDrafts, setCrmRetentionStatusDrafts] = useState<Record<string, CrmRetentionReview["reviewStatus"]>>({});
  const [crmRetentionPolicyDrafts, setCrmRetentionPolicyDrafts] = useState<Record<string, string>>({});
  const [crmRetentionNextReviewDrafts, setCrmRetentionNextReviewDrafts] = useState<Record<string, string>>({});
  const [savingCrmRetentionReviewId, setSavingCrmRetentionReviewId] = useState<string | null>(null);
  const [isSavingSubprocessor, setIsSavingSubprocessor] = useState(false);
  const [isSavingProcessingActivity, setIsSavingProcessingActivity] = useState(false);
  const [newSubprocessorName, setNewSubprocessorName] = useState("");
  const [newSubprocessorRegion, setNewSubprocessorRegion] = useState("EU");
  const [newSubprocessorPurpose, setNewSubprocessorPurpose] = useState("");
  const [newSubprocessorTransfer, setNewSubprocessorTransfer] = useState("SCC");
  const [newProcessingActivityName, setNewProcessingActivityName] = useState("");
  const [newProcessingActivityPurpose, setNewProcessingActivityPurpose] = useState("");
  const [newProcessingActivityLegalBasis, setNewProcessingActivityLegalBasis] = useState(
    "oprávněný zájem",
  );
  const [newProcessingActivityCategories, setNewProcessingActivityCategories] = useState("");
  const [newProcessingActivityRetentionId, setNewProcessingActivityRetentionId] = useState("");
  const [newProcessingActivitySubprocessorIds, setNewProcessingActivitySubprocessorIds] = useState<string[]>([]);
  const [newAccessReviewSummary, setNewAccessReviewSummary] = useState("");
  const [isSavingAccessReview, setIsSavingAccessReview] = useState(false);

  const loadOverview = async () => {
    setIsLoading(true);
    const data = await getComplianceOverviewAdmin();
    setOverview(data);
    setRetentionDrafts(
      Object.fromEntries(data.retentionPolicies.map((policy) => [policy.id, policy.retentionDays])),
    );
    setIsLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const data = await getComplianceOverviewAdmin();
      if (cancelled) return;
      setOverview(data);
      setRetentionDrafts(
        Object.fromEntries(data.retentionPolicies.map((policy) => [policy.id, policy.retentionDays])),
      );
      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const checklistItems = overview?.checklistItems ?? [];
  const retentionPolicies = overview?.retentionPolicies ?? [];
  const dsrQueue = overview?.dsrQueue ?? [];
  const breachCases = overview?.breachCases ?? [];
  const breachCaseEvents = overview?.breachCaseEvents ?? [];
  const subprocessors = overview?.subprocessors ?? [];
  const processingActivities = overview?.processingActivities ?? [];
  const crmRetentionReviews = overview?.crmRetentionReviews ?? [];
  const accessReviewUsers = overview?.accessReviewUsers ?? [];
  const accessAuditEntries = overview?.accessAuditEntries ?? [];
  const accessReviewReports = overview?.accessReviewReports ?? [];

  const hasRealSubprocessors = useMemo(
    () => subprocessors.some((record) => record.id !== "subprocessors-missing"),
    [subprocessors],
  );
  const hasRealProcessingActivities = useMemo(
    () => processingActivities.some((record) => record.id !== "processing-activities-missing"),
    [processingActivities],
  );

  const handleCreateDsr = async () => {
    if (!newDsrLabel.trim() || !newDsrRequesterLabel.trim() || !newDsrDueAt) {
      showAlert({
        title: "Chybí údaje",
        message: "Vyplňte popis požadavku, jméno žadatele a termín.",
        variant: "danger",
      });
      return;
    }

    setIsSavingDsr(true);
    try {
      await createDataSubjectRequestAdmin({
        id: `DSR-${Date.now()}`,
        requestType: newDsrType,
        subjectLabel: newDsrLabel.trim(),
        requesterLabel: newDsrRequesterLabel.trim(),
        intakeChannel: newDsrChannel,
        verificationStatus: newDsrType === "erasure" ? "pending" : "not_required",
        resolutionSummary: "",
        dueAt: newDsrDueAt,
      });
      setNewDsrLabel("");
      setNewDsrRequesterLabel("");
      setNewDsrChannel("email");
      setNewDsrDueAt("");
      await loadOverview();
      showAlert({
        title: "Uloženo",
        message: "DSR požadavek byl vytvořen.",
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: "Uložení selhalo",
        message: `DSR požadavek se nepodařilo uložit: ${String((error as Error)?.message || error)}`,
        variant: "danger",
      });
    } finally {
      setIsSavingDsr(false);
    }
  };

  const handleSaveDsrHandling = async (request: DataSubjectRequest) => {
    const requesterLabel = (dsrRequesterDrafts[request.id] ?? request.requesterLabel).trim();
    const intakeChannel = dsrChannelDrafts[request.id] ?? request.intakeChannel;
    const verificationStatus = dsrVerificationDrafts[request.id] ?? request.verificationStatus;
    const rectificationDraft =
      dsrRectificationDrafts[request.id] ?? parseRectificationWorkflow(request.resolutionSummary);
    const erasureDraft = dsrErasureDrafts[request.id] ?? parseErasureWorkflow(request.resolutionSummary);
    const resolutionSummary =
      request.requestType === "rectification"
        ? buildRectificationSummary(rectificationDraft)
        : request.requestType === "erasure"
          ? buildErasureSummary(erasureDraft)
        : (dsrResolutionDrafts[request.id] ?? request.resolutionSummary).trim();

    if (!requesterLabel) {
      showAlert({
        title: "Chybí žadatel",
        message: "Doplňte, kdo požadavek podal, aby byla evidence doložitelná.",
        variant: "danger",
      });
      return;
    }

    if (request.requestType === "rectification" && !isRectificationWorkflowComplete(rectificationDraft)) {
      showAlert({
        title: "Chybí workflow opravy",
        message:
          "U DSR opravy vyplňte, které údaje se opravují, z jakého podkladu, v jakých systémech a jak bude potvrzeno vyřízení žadateli.",
        variant: "danger",
      });
      return;
    }

    if (request.requestType === "erasure" && !isErasureWorkflowComplete(erasureDraft)) {
      showAlert({
        title: "Chybí rozhodnutí o výmazu",
        message:
          "U DSR výmazu vyplňte právní posouzení, rozsah mazání nebo anonymizace, blokované systémy, odpovědnou osobu a komunikaci se žadatelem.",
        variant: "danger",
      });
      return;
    }

    if (request.status === "completed" && !resolutionSummary) {
      showAlert({
        title: "Chybí výsledek",
        message: "Před uzavřením požadavku doplňte stručné shrnutí, jak byl vyřízen.",
        variant: "danger",
      });
      return;
    }

    setSavingDsrHandlingId(request.id);
    try {
      await saveDataSubjectRequestHandlingAdmin({
        id: request.id,
        requesterLabel,
        intakeChannel,
        verificationStatus,
        resolutionSummary,
      });
      await loadOverview();
      showAlert({
        title: "Evidence vyřízení uložena",
        message: "DSR záznam má doplněného žadatele, kanál a výsledek vyřízení.",
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: "Uložení selhalo",
        message: `DSR evidenci se nepodařilo uložit: ${String((error as Error)?.message || error)}`,
        variant: "danger",
      });
    } finally {
      setSavingDsrHandlingId(null);
    }
  };

  const handleAdvanceDsrStatus = async (request: DataSubjectRequest) => {
    const nextStatus: DataSubjectRequest["status"] =
      request.status === "new"
        ? "in_progress"
        : request.status === "in_progress"
          ? "completed"
          : "completed";

    if (nextStatus === request.status) return;

    if (request.requestType === "rectification" && nextStatus === "completed") {
      const verificationStatus = dsrVerificationDrafts[request.id] ?? request.verificationStatus;
      const rectificationDraft =
        dsrRectificationDrafts[request.id] ?? parseRectificationWorkflow(request.resolutionSummary);
      const requesterLabel = (dsrRequesterDrafts[request.id] ?? request.requesterLabel).trim();
      const intakeChannel = dsrChannelDrafts[request.id] ?? request.intakeChannel;

      if (verificationStatus !== "verified") {
        showAlert({
          title: "Oprava vyžaduje ověření identity",
          message:
            "Před uzavřením DSR opravy musí být žadatel ověřen, aby se předešlo neoprávněné změně osobních údajů.",
          variant: "danger",
        });
        return;
      }

      if (!isRectificationWorkflowComplete(rectificationDraft)) {
        showAlert({
          title: "Workflow opravy není kompletní",
          message:
            "Před uzavřením doplňte pole k opravě, zdroj pravdivých údajů, zasažené systémy a potvrzení komunikace se žadatelem.",
          variant: "danger",
        });
        return;
      }

      setSavingDsrHandlingId(request.id);
      try {
        await saveDataSubjectRequestHandlingAdmin({
          id: request.id,
          requesterLabel,
          intakeChannel,
          verificationStatus,
          resolutionSummary: buildRectificationSummary(rectificationDraft),
        });
      } catch (error) {
        showAlert({
          title: "Uložení workflow selhalo",
          message: `Nepodařilo se uložit evidenci opravy: ${String((error as Error)?.message || error)}`,
          variant: "danger",
        });
        setSavingDsrHandlingId(null);
        return;
      }
      setSavingDsrHandlingId(null);
    }

    if (request.requestType === "erasure" && nextStatus === "completed") {
      const verificationStatus = dsrVerificationDrafts[request.id] ?? request.verificationStatus;
      const erasureDraft = dsrErasureDrafts[request.id] ?? parseErasureWorkflow(request.resolutionSummary);
      const requesterLabel = (dsrRequesterDrafts[request.id] ?? request.requesterLabel).trim();
      const intakeChannel = dsrChannelDrafts[request.id] ?? request.intakeChannel;

      if (verificationStatus !== "verified") {
        showAlert({
          title: "Výmaz vyžaduje ověření identity",
          message:
            "Před uzavřením DSR výmazu musí být žadatel ověřen, aby nevzniklo riziko neoprávněného zásahu do cizích údajů.",
          variant: "danger",
        });
        return;
      }

      if (!isErasureWorkflowComplete(erasureDraft)) {
        showAlert({
          title: "Workflow výmazu není kompletní",
          message:
            "Před uzavřením doplňte právní posouzení, scope ručního zásahu, zablokované systémy, odpovědnou osobu a komunikaci se žadatelem.",
          variant: "danger",
        });
        return;
      }

      setSavingDsrHandlingId(request.id);
      try {
        await saveDataSubjectRequestHandlingAdmin({
          id: request.id,
          requesterLabel,
          intakeChannel,
          verificationStatus,
          resolutionSummary: buildErasureSummary(erasureDraft),
        });
      } catch (error) {
        showAlert({
          title: "Uložení workflow selhalo",
          message: `Nepodařilo se uložit evidenci výmazu: ${String((error as Error)?.message || error)}`,
          variant: "danger",
        });
        setSavingDsrHandlingId(null);
        return;
      }
      setSavingDsrHandlingId(null);
    }

    try {
      await updateDataSubjectRequestStatusAdmin({
        id: request.id,
        status: nextStatus,
      });
      await loadOverview();
      showAlert({
        title: "Stav změněn",
        message: `DSR požadavek je nyní ve stavu ${requestStatusLabel[nextStatus]}.`,
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: "Aktualizace selhala",
        message: `Nepodařilo se změnit stav DSR požadavku: ${String((error as Error)?.message || error)}`,
        variant: "danger",
      });
    }
  };

  const handleExportDsr = async (request: DataSubjectRequest) => {
    try {
      const payload = await exportDataSubjectAdmin({
        query: request.subjectLabel,
      });

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dsr_export_${request.id}.json`;
      link.click();
      URL.revokeObjectURL(url);

      showAlert({
        title: "Export připraven",
        message: `Export pro ${request.subjectLabel} byl stažen jako JSON.`,
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: "Export selhal",
        message: `Nepodařilo se připravit export osobních údajů: ${String((error as Error)?.message || error)}`,
        variant: "danger",
      });
    }
  };

  const handleSaveRetention = async (policy: RetentionPolicy) => {
    const nextDays = Math.max(0, Math.floor(retentionDrafts[policy.id] ?? policy.retentionDays));
    setSavingRetentionId(policy.id);
    try {
      await saveComplianceRetentionPolicyAdmin({
        id: policy.id,
        category: policy.category,
        purpose: policy.purpose,
        retentionDays: nextDays,
        status: nextDays > 0 ? policy.status : "partial",
      });
      await loadOverview();
      showAlert({
        title: "Retence uložena",
        message: `Policy ${policy.category} je nyní nastavena na ${nextDays} dní.`,
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: "Uložení selhalo",
        message: `Retenci se nepodařilo uložit: ${String((error as Error)?.message || error)}`,
        variant: "danger",
      });
    } finally {
      setSavingRetentionId(null);
    }
  };

  const handleRunRetentionPurge = async () => {
    showAlert({
      title: "Mazání je vypnuté",
      message:
        "Compliance admin běží v bezpečném režimu. Z UI se teď nespouští žádné mazání ani purge nad produkční databází.",
      variant: "info",
    });
  };

  const handleSaveCrmRetentionReview = async (review: CrmRetentionReview) => {
    const manualWorkflowSummary = (
      crmRetentionSummaryDrafts[review.id] ?? review.manualWorkflowSummary
    ).trim();
    const reviewStatus = crmRetentionStatusDrafts[review.id] ?? review.reviewStatus;
    const retentionPolicyId = crmRetentionPolicyDrafts[review.id] ?? review.retentionPolicyId ?? "";
    const nextReviewAt = crmRetentionNextReviewDrafts[review.id] ?? review.nextReviewAt ?? "";

    if (!manualWorkflowSummary) {
      showAlert({
        title: "Chybí manuální workflow",
        message:
          "Doplňte, jak má ruční retenční kontrola probíhat a proč zatím nemá být nic mazáno automaticky.",
        variant: "danger",
      });
      return;
    }

    setSavingCrmRetentionReviewId(review.id);
    try {
      await saveCrmRetentionReviewAdmin({
        id: review.id,
        domainKey: review.domainKey,
        domainLabel: review.domainLabel,
        retentionPolicyId: retentionPolicyId || null,
        reviewStatus,
        manualWorkflowSummary,
        nextReviewAt: nextReviewAt || null,
      });
      await loadOverview();
      showAlert({
        title: "Retenční plán uložen",
        message: "Manuální retenční workflow pro CRM datovou doménu bylo uloženo bez automatického mazání.",
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: "Uložení selhalo",
        message: `Retenční plán se nepodařilo uložit: ${String((error as Error)?.message || error)}`,
        variant: "danger",
      });
    } finally {
      setSavingCrmRetentionReviewId(null);
    }
  };

  const handleCreateSubprocessor = async () => {
    const name = newSubprocessorName.trim();
    const region = newSubprocessorRegion.trim();
    const purpose = newSubprocessorPurpose.trim();
    const transferMechanism = newSubprocessorTransfer.trim();

    if (!name || !region || !purpose || !transferMechanism) {
      showAlert({
        title: "Chybí údaje",
        message: "Vyplňte název, region, účel i přenosový mechanismus.",
        variant: "danger",
      });
      return;
    }

    setIsSavingSubprocessor(true);
    try {
      await saveSubprocessorAdmin({
        id: `subprocessor-${Date.now()}`,
        name,
        region,
        purpose,
        transferMechanism,
      });
      setNewSubprocessorName("");
      setNewSubprocessorRegion("EU");
      setNewSubprocessorPurpose("");
      setNewSubprocessorTransfer("SCC");
      await loadOverview();
      showAlert({
        title: "Uloženo",
        message: "Subprocessor byl uložen do registru.",
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: "Uložení selhalo",
        message: `Subprocessor se nepodařilo uložit: ${String((error as Error)?.message || error)}`,
        variant: "danger",
      });
    } finally {
      setIsSavingSubprocessor(false);
    }
  };

  const handleCreateProcessingActivity = async () => {
    const activityName = newProcessingActivityName.trim();
    const purpose = newProcessingActivityPurpose.trim();
    const legalBasis = newProcessingActivityLegalBasis.trim();
    const dataCategories = newProcessingActivityCategories
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!activityName || !purpose || !legalBasis || dataCategories.length === 0) {
      showAlert({
        title: "Chybí údaje",
        message: "Vyplňte název činnosti, účel, právní titul a alespoň jednu kategorii dat.",
        variant: "danger",
      });
      return;
    }

    setIsSavingProcessingActivity(true);
    try {
      await saveProcessingActivityAdmin({
        id: `processing-activity-${Date.now()}`,
        activityName,
        purpose,
        legalBasis,
        dataCategories,
        retentionPolicyId: newProcessingActivityRetentionId || null,
        linkedSubprocessorIds: newProcessingActivitySubprocessorIds,
      });
      setNewProcessingActivityName("");
      setNewProcessingActivityPurpose("");
      setNewProcessingActivityLegalBasis("oprávněný zájem");
      setNewProcessingActivityCategories("");
      setNewProcessingActivityRetentionId("");
      setNewProcessingActivitySubprocessorIds([]);
      await loadOverview();
      showAlert({
        title: "Uloženo",
        message: "Činnost zpracování byla zapsána do interního registru.",
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: "Uložení selhalo",
        message: `Činnost zpracování se nepodařilo uložit: ${String((error as Error)?.message || error)}`,
        variant: "danger",
      });
    } finally {
      setIsSavingProcessingActivity(false);
    }
  };

  const handleCreateAccessReview = async () => {
    const summary = newAccessReviewSummary.trim();

    setIsSavingAccessReview(true);
    try {
      await createAccessReviewReportAdmin({
        summary,
      });
      setNewAccessReviewSummary("");
      await loadOverview();
      showAlert({
        title: "Review uložena",
        message: "Snapshot přístupů byl zapsán do evidence access review.",
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: "Uložení selhalo",
        message: `Access review se nepodařilo uložit: ${String((error as Error)?.message || error)}`,
        variant: "danger",
      });
    } finally {
      setIsSavingAccessReview(false);
    }
  };

  const handleCreateBreach = async () => {
    if (!newBreachTitle.trim()) {
      showAlert({
        title: "Chybí název",
        message: "Vyplňte název breach case.",
        variant: "danger",
      });
      return;
    }

    setIsSavingBreach(true);
    try {
      await createBreachCaseAdmin({
        id: `BREACH-${Date.now()}`,
        title: newBreachTitle.trim(),
        riskLevel: newBreachRisk,
        linkedIncidentId: newBreachIncidentId.trim() || null,
      });
      setNewBreachTitle("");
      setNewBreachIncidentId("");
      await loadOverview();
      showAlert({
        title: "Uloženo",
        message: "Breach case byl vytvořen.",
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: "Uložení selhalo",
        message: `Breach case se nepodařilo uložit: ${String((error as Error)?.message || error)}`,
        variant: "danger",
      });
    } finally {
      setIsSavingBreach(false);
    }
  };

  const handleAdvanceBreachStatus = async (breach: BreachCase) => {
    const nextStatus: BreachCase["status"] =
      breach.status === "triage"
        ? "assessment"
        : breach.status === "assessment"
          ? "reported"
          : breach.status === "reported"
            ? "closed"
            : "closed";

    if (nextStatus === breach.status) return;

    try {
      await updateBreachCaseStatusAdmin({
        id: breach.id,
        status: nextStatus,
      });
      await loadOverview();
      showAlert({
        title: "Stav změněn",
        message: `Breach case je nyní ve stavu ${breachStatusLabel[nextStatus]}.`,
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: "Aktualizace selhala",
        message: `Nepodařilo se změnit stav breach case: ${String((error as Error)?.message || error)}`,
        variant: "danger",
      });
    }
  };

  const handleSaveBreachAssessment = async (breach: BreachCase) => {
    const summary = (breachAssessmentDrafts[breach.id] ?? breach.assessmentSummary).trim();

    if (!summary) {
      showAlert({
        title: "Chybí posouzení",
        message: "Vyplňte stručné posouzení dopadu, rozsahu a dalšího postupu.",
        variant: "danger",
      });
      return;
    }

    setSavingBreachAssessmentId(breach.id);
    try {
      await saveBreachAssessmentAdmin({
        id: breach.id,
        assessmentSummary: summary,
      });
      await loadOverview();
      showAlert({
        title: "Posouzení uloženo",
        message: "Shrnutí breach case bylo zapsáno do timeline i evidence případu.",
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: "Uložení selhalo",
        message: `Posouzení se nepodařilo uložit: ${String((error as Error)?.message || error)}`,
        variant: "danger",
      });
    } finally {
      setSavingBreachAssessmentId(null);
    }
  };

  const handleSaveBreachClassification = async (breach: BreachCase) => {
    const affectedDataCategories = (breachDataCategoriesDrafts[breach.id] ??
      breach.affectedDataCategories.join(", "))
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const affectedSubjectTypes = (breachSubjectTypesDrafts[breach.id] ??
      breach.affectedSubjectTypes.join(", "))
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const estimatedValue = breachEstimatedCountDrafts[breach.id];
    const estimatedSubjectCount =
      estimatedValue === undefined || estimatedValue.trim() === ""
        ? breach.estimatedSubjectCount
        : Number(estimatedValue);
    const notificationRationale = (
      breachRationaleDrafts[breach.id] ?? breach.notificationRationale
    ).trim();

    if (affectedDataCategories.length === 0 || affectedSubjectTypes.length === 0 || !notificationRationale) {
      showAlert({
        title: "Chybí klasifikace",
        message:
          "Vyplňte dotčené kategorie údajů, typy subjektů a důvod hlášení nebo nehlášení.",
        variant: "danger",
      });
      return;
    }

    setSavingBreachClassificationId(breach.id);
    try {
      await saveBreachClassificationAdmin({
        id: breach.id,
        affectedDataCategories,
        affectedSubjectTypes,
        estimatedSubjectCount:
          typeof estimatedSubjectCount === "number" && !Number.isNaN(estimatedSubjectCount)
            ? estimatedSubjectCount
            : null,
        notificationRationale,
      });
      await loadOverview();
      showAlert({
        title: "Klasifikace uložena",
        message: "Dotčené údaje, subjekty a důvod hlášení byly zapsány do evidence.",
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: "Uložení selhalo",
        message: `Klasifikaci se nepodařilo uložit: ${String((error as Error)?.message || error)}`,
        variant: "danger",
      });
    } finally {
      setSavingBreachClassificationId(null);
    }
  };

  const handleAddBreachTimelineEvent = async (breach: BreachCase) => {
    const summary = (breachTimelineDrafts[breach.id] ?? "").trim();

    if (!summary) {
      showAlert({
        title: "Chybí krok do timeline",
        message: "Zapište stručně, co se stalo nebo jaký krok byl proveden.",
        variant: "danger",
      });
      return;
    }

    setSavingBreachTimelineId(breach.id);
    try {
      await addBreachCaseTimelineEventAdmin({
        breachCaseId: breach.id,
        summary,
      });
      setBreachTimelineDrafts((prev) => ({ ...prev, [breach.id]: "" }));
      await loadOverview();
      showAlert({
        title: "Timeline doplněna",
        message: "Krok byl zapsán do auditní timeline případu.",
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: "Zápis selhal",
        message: `Timeline krok se nepodařilo uložit: ${String((error as Error)?.message || error)}`,
        variant: "danger",
      });
    } finally {
      setSavingBreachTimelineId(null);
    }
  };

  const handleMarkBreachNotification = async (
    breach: BreachCase,
    target: "authority" | "data_subjects",
  ) => {
    setMarkingBreachNotification(`${breach.id}:${target}`);
    try {
      await markBreachNotificationAdmin({
        id: breach.id,
        target,
      });
      await loadOverview();
      showAlert({
        title: "Notifikace zapsána",
        message:
          target === "authority"
            ? "Do případu bylo zapsáno hlášení vůči ÚOOÚ."
            : "Do případu bylo zapsáno informování dotčených subjektů.",
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: "Zápis selhal",
        message: `Notifikaci se nepodařilo zapsat: ${String((error as Error)?.message || error)}`,
        variant: "danger",
      });
    } finally {
      setMarkingBreachNotification(null);
    }
  };

  const handleDownloadBreachAuthorityReport = (breach: BreachCase) => {
    try {
      const report = buildBreachAuthorityReportAdmin({
        breachCase: breach,
        events: breachCaseEvents.filter((event) => event.breachCaseId === breach.id),
      });
      const blob = new Blob([report.content], { type: report.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = report.fileName;
      link.click();
      URL.revokeObjectURL(url);

      showAlert({
        title: "Podklady připraveny",
        message: "Stáhl se pracovní podklad pro ÚOOÚ v Markdown formátu.",
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: "Export selhal",
        message: `Podklady pro ÚOOÚ se nepodařilo připravit: ${String((error as Error)?.message || error)}`,
        variant: "danger",
      });
    }
  };

  const summary = useMemo(
    () =>
      checklistItems.reduce(
        (acc, item) => {
          acc[item.status] += 1;
          return acc;
        },
        { implemented: 0, partial: 0, missing: 0 },
      ),
    [checklistItems],
  );

  const subprocessorNameById = useMemo(
    () =>
      new Map(
        subprocessors.map((record) => [record.id, record.name] as const),
      ),
    [subprocessors],
  );

  const retentionLabelById = useMemo(
    () =>
      new Map(
        retentionPolicies.map((policy) => [policy.id, policy.category] as const),
      ),
    [retentionPolicies],
  );

  const getRectificationDraft = (request: DataSubjectRequest): RectificationWorkflowDraft =>
    dsrRectificationDrafts[request.id] ?? parseRectificationWorkflow(request.resolutionSummary);

  const getErasureDraft = (request: DataSubjectRequest): ErasureWorkflowDraft =>
    dsrErasureDrafts[request.id] ?? parseErasureWorkflow(request.resolutionSummary);

  return (
    <section className="space-y-6">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-cyan-500">policy</span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Compliance
          </h2>
        </div>
        <p className="text-sm text-slate-500">
          Přehled implementace compliance backlogu, připravenosti a dalšího
          postupu.
        </p>
      </div>

      {COMPLIANCE_DB_SAFE_MODE ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100">
          Bezpečný režim databáze: z tohoto compliance panelu se nyní nespouští žádné mazání,
          anonymizace ani purge nad tvou databází. Panel slouží pro evidenci, audit, export a
          přípravu procesů.
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <div className="text-sm text-emerald-700 dark:text-emerald-300">
            Hotovo
          </div>
          <div className="mt-2 text-3xl font-black text-emerald-800 dark:text-emerald-200">
            {summary.implemented}
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
          <div className="text-sm text-amber-700 dark:text-amber-300">
            Částečně
          </div>
          <div className="mt-2 text-3xl font-black text-amber-800 dark:text-amber-200">
            {summary.partial}
          </div>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
          <div className="text-sm text-rose-700 dark:text-rose-300">
            Chybí
          </div>
          <div className="mt-2 text-3xl font-black text-rose-800 dark:text-rose-200">
            {summary.missing}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/40 dark:bg-slate-900/80">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Compliance checklist
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          Shrnutí, co je hotové, co chybí a proč je to důležité pro GDPR a interní provoz.
        </p>
        {isLoading && (
          <p className="mt-3 text-sm text-slate-500">Načítám compliance přehled…</p>
        )}
        <div className="mt-4 space-y-3">
          {checklistItems.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-slate-200 p-4 dark:border-slate-700/50"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {item.area}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusMeta[item.status].className}`}
                >
                  {statusMeta[item.status].label}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {item.priority}
                </span>
              </div>
              <h4 className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                {item.title}
              </h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/40 dark:bg-slate-900/80">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Retence dat
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Nastavení, jak dlouho se mají jednotlivé provozní záznamy držet. Slouží pro evidenci
            retention politik, ne pro okamžité mazání produkčních dat.
          </p>
          <div className="mt-3">
            <button
              onClick={() => void handleRunRetentionPurge()}
              className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-amber-500/10"
            >
              Purge je vypnuté
            </button>
            <p className="mt-2 text-xs text-slate-500">
              Tohle tlačítko teď nic nemaže. Jen vysvětluje, že purge workflow budeme zapínat až po
              samostatném schválení a kontrole nad neprodukční kopií.
            </p>
          </div>
          <div className="mt-4 space-y-3">
            {retentionPolicies.map((policy) => (
              <div
                key={policy.id}
                className="rounded-xl border border-slate-200 p-4 dark:border-slate-700/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {policy.category}
                    </div>
                    <div className="text-sm text-slate-500">{policy.purpose}</div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusMeta[policy.status].className}`}
                  >
                    {statusMeta[policy.status].label}
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {policy.retentionDays > 0
                    ? `Retence: ${policy.retentionDays} dní`
                    : "Retence zatím není zavedena centrálně"}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    aria-label={`Retence ${policy.id}`}
                    type="number"
                    min={0}
                    value={retentionDrafts[policy.id] ?? policy.retentionDays}
                    onChange={(e) =>
                      setRetentionDrafts((prev) => ({
                        ...prev,
                        [policy.id]: Number(e.target.value || 0),
                      }))
                    }
                    className="w-32 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                  />
                  <span className="text-xs text-slate-500">dní</span>
                  <button
                    onClick={() => void handleSaveRetention(policy)}
                    disabled={savingRetentionId === policy.id}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {savingRetentionId === policy.id ? "Ukládám…" : "Uložit"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700/50">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Manuální retenční plány CRM, dokumentů a exportů
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Tato sekce neslouží k automatickému mazání. Eviduje, jak mají být hlavní CRM domény
              ručně revidovány, podle které retention policy a kdy má proběhnout další kontrola.
            </p>
            <div className="mt-4 space-y-3">
              {crmRetentionReviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-xl border border-slate-200 p-4 dark:border-slate-700/50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {review.domainLabel}
                      </div>
                      <div className="text-xs text-slate-500">{review.domainKey}</div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {crmRetentionReviewStatusLabel[crmRetentionStatusDrafts[review.id] ?? review.reviewStatus]}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
                    <select
                      aria-label={`Retention policy CRM ${review.id}`}
                      value={crmRetentionPolicyDrafts[review.id] ?? review.retentionPolicyId ?? ""}
                      onChange={(e) =>
                        setCrmRetentionPolicyDrafts((prev) => ({ ...prev, [review.id]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                    >
                      <option value="">Bez vazby na retention policy</option>
                      {retentionPolicies.map((policy) => (
                        <option key={policy.id} value={policy.id}>
                          {policy.category}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={`Stav CRM retention ${review.id}`}
                      value={crmRetentionStatusDrafts[review.id] ?? review.reviewStatus}
                      onChange={(e) =>
                        setCrmRetentionStatusDrafts((prev) => ({
                          ...prev,
                          [review.id]: e.target.value as CrmRetentionReview["reviewStatus"],
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                    >
                      <option value="planned">Plánováno</option>
                      <option value="approved">Schváleno</option>
                      <option value="blocked">Blokováno</option>
                    </select>
                    <input
                      aria-label={`Další review CRM ${review.id}`}
                      type="date"
                      value={crmRetentionNextReviewDrafts[review.id] ?? review.nextReviewAt ?? ""}
                      onChange={(e) =>
                        setCrmRetentionNextReviewDrafts((prev) => ({ ...prev, [review.id]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                    />
                  </div>
                  <textarea
                    aria-label={`Workflow CRM retention ${review.id}`}
                    value={crmRetentionSummaryDrafts[review.id] ?? review.manualWorkflowSummary}
                    onChange={(e) =>
                      setCrmRetentionSummaryDrafts((prev) => ({ ...prev, [review.id]: e.target.value }))
                    }
                    rows={3}
                    placeholder="Popište ruční retenční postup, blokátory a rozhodovací pravidla."
                    className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                  />
                  <button
                    onClick={() => void handleSaveCrmRetentionReview(review)}
                    disabled={savingCrmRetentionReviewId === review.id}
                    className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {savingCrmRetentionReviewId === review.id ? "Ukládám…" : "Uložit retenční plán"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/40 dark:bg-slate-900/80">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            DSR fronta
          </h3>
        <p className="mt-2 text-sm text-slate-500">
          Evidence požadavků subjektů údajů. Slouží ke sledování přístupu, exportu, oprav a
          požadavků na výmaz bez automatického zásahu do produkčních dat.
        </p>
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700/50">
            <div className="grid grid-cols-1 gap-3 2xl:grid-cols-[140px_minmax(0,1fr)_minmax(0,220px)_180px_auto]">
              <select
                aria-label="Typ DSR požadavku"
                value={newDsrType}
                onChange={(e) => setNewDsrType(e.target.value as DataSubjectRequest["requestType"])}
                className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
              >
                <option value="access">Přístup</option>
                <option value="export">Export</option>
                <option value="rectification">Oprava</option>
                <option value="erasure">Výmaz</option>
              </select>
              <input
                aria-label="Popis DSR požadavku"
                type="text"
                value={newDsrLabel}
                onChange={(e) => setNewDsrLabel(e.target.value)}
                placeholder="Např. Export dat kontaktní osoby"
                className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
              />
              <input
                aria-label="Žadatel DSR požadavku"
                type="text"
                value={newDsrRequesterLabel}
                onChange={(e) => setNewDsrRequesterLabel(e.target.value)}
                placeholder="Např. Jan Novák / kontakt klienta"
                className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
              />
              <input
                aria-label="Termín DSR požadavku"
                type="date"
                value={newDsrDueAt}
                onChange={(e) => setNewDsrDueAt(e.target.value)}
                className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
              />
              <select
                aria-label="Kanál DSR požadavku"
                value={newDsrChannel}
                onChange={(e) => setNewDsrChannel(e.target.value as DataSubjectRequest["intakeChannel"])}
                className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white 2xl:col-start-3 2xl:row-start-2"
              >
                <option value="email">E-mail</option>
                <option value="form">Formulář</option>
                <option value="phone">Telefon</option>
                <option value="support">Support</option>
                <option value="internal">Interní</option>
              </select>
              <button
                onClick={() => void handleCreateDsr()}
                disabled={isSavingDsr}
                className="rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50 2xl:row-span-2"
              >
                {isSavingDsr ? "Ukládám…" : "Přidat"}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Žadatel, kanál přijetí a ověření identity pomáhají doložit, že byl požadavek přijat a vyřízen řízeným způsobem.
            </p>
          </div>
          {dsrQueue.map((request) => (
              <div
                key={request.id}
                className="rounded-xl border border-slate-200 p-4 dark:border-slate-700/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {requestTypeLabel[request.requestType]}: {request.subjectLabel}
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {requestStatusLabel[request.status]}
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {request.id} • termín {request.dueAt}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Žadatel: {request.requesterLabel} • Kanál: {requestChannelLabel[request.intakeChannel]} •
                  Ověření: {requestVerificationLabel[request.verificationStatus]}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Export stáhne podklady k ručnímu vyřízení požadavku. Tlačítko pro výmaz zde pouze
                  eviduje záměr a nespouští žádný zásah do databáze.
                </div>
                {request.requestType === "rectification" && (
                  <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100">
                    Workflow opravy drží změny mimo automatiku: nejdřív ověř identitu, potom
                    dolož zdroj správných údajů, zapiš všechny systémy k ruční aktualizaci a až
                    poté uzavři požadavek jako hotový.
                  </div>
                )}
                {request.requestType === "erasure" && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                    Workflow výmazu zůstává nedestruktivní: nejdřív ověř identitu, právně posuď,
                    co opravdu smí být smazáno nebo anonymizováno, zapiš blokované systémy a
                    odpovědnou osobu a teprve potom uzavři evidenci pro ruční provedení mimo UI.
                  </div>
                )}
                <div className="mt-4 space-y-3 rounded-xl border border-slate-200/80 p-3 dark:border-slate-700/50">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Evidence vyřízení
                  </div>
                  <input
                    aria-label={`Žadatel ${request.id}`}
                    type="text"
                    value={dsrRequesterDrafts[request.id] ?? request.requesterLabel}
                    onChange={(e) =>
                      setDsrRequesterDrafts((prev) => ({ ...prev, [request.id]: e.target.value }))
                    }
                    placeholder="Kdo požadavek podal"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                  />
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <select
                      aria-label={`Kanál ${request.id}`}
                      value={dsrChannelDrafts[request.id] ?? request.intakeChannel}
                      onChange={(e) =>
                        setDsrChannelDrafts((prev) => ({
                          ...prev,
                          [request.id]: e.target.value as DataSubjectRequest["intakeChannel"],
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                    >
                      <option value="email">E-mail</option>
                      <option value="form">Formulář</option>
                      <option value="phone">Telefon</option>
                      <option value="support">Support</option>
                      <option value="internal">Interní</option>
                    </select>
                    <select
                      aria-label={`Ověření ${request.id}`}
                      value={dsrVerificationDrafts[request.id] ?? request.verificationStatus}
                      onChange={(e) =>
                        setDsrVerificationDrafts((prev) => ({
                          ...prev,
                          [request.id]: e.target.value as DataSubjectRequest["verificationStatus"],
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                    >
                      <option value="pending">Čeká na ověření</option>
                      <option value="verified">Ověřeno</option>
                      <option value="not_required">Není potřeba</option>
                    </select>
                  </div>
                  {request.requestType === "rectification" ? (
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                      <input
                        aria-label={`Pole k opravě ${request.id}`}
                        type="text"
                        value={getRectificationDraft(request).requestedFields}
                        onChange={(e) =>
                          setDsrRectificationDrafts((prev) => ({
                            ...prev,
                            [request.id]: {
                              ...getRectificationDraft(request),
                              requestedFields: e.target.value,
                            },
                          }))
                        }
                        placeholder="Např. jméno, e-mail, telefon"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                      />
                      <input
                        aria-label={`Zdroj opravy ${request.id}`}
                        type="text"
                        value={getRectificationDraft(request).evidenceSource}
                        onChange={(e) =>
                          setDsrRectificationDrafts((prev) => ({
                            ...prev,
                            [request.id]: {
                              ...getRectificationDraft(request),
                              evidenceSource: e.target.value,
                            },
                          }))
                        }
                        placeholder="Např. potvrzený e-mail žadatele nebo smlouva"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                      />
                      <input
                        aria-label={`Zasažené systémy ${request.id}`}
                        type="text"
                        value={getRectificationDraft(request).affectedSystems}
                        onChange={(e) =>
                          setDsrRectificationDrafts((prev) => ({
                            ...prev,
                            [request.id]: {
                              ...getRectificationDraft(request),
                              affectedSystems: e.target.value,
                            },
                          }))
                        }
                        placeholder="Např. CRM, exporty, fakturace"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                      />
                      <textarea
                        aria-label={`Komunikace se žadatelem ${request.id}`}
                        value={getRectificationDraft(request).requesterCommunication}
                        onChange={(e) =>
                          setDsrRectificationDrafts((prev) => ({
                            ...prev,
                            [request.id]: {
                              ...getRectificationDraft(request),
                              requesterCommunication: e.target.value,
                            },
                          }))
                        }
                        rows={3}
                        placeholder="Jak a kdy bude žadateli potvrzeno, že oprava proběhla."
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white xl:col-span-2"
                      />
                    </div>
                  ) : request.requestType === "erasure" ? (
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                      <input
                        aria-label={`Právní posouzení výmazu ${request.id}`}
                        type="text"
                        value={getErasureDraft(request).legalAssessment}
                        onChange={(e) =>
                          setDsrErasureDrafts((prev) => ({
                            ...prev,
                            [request.id]: {
                              ...getErasureDraft(request),
                              legalAssessment: e.target.value,
                            },
                          }))
                        }
                        placeholder="Např. bez zákonné retenční překážky"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                      />
                      <input
                        aria-label={`Rozsah výmazu ${request.id}`}
                        type="text"
                        value={getErasureDraft(request).deletionScope}
                        onChange={(e) =>
                          setDsrErasureDrafts((prev) => ({
                            ...prev,
                            [request.id]: {
                              ...getErasureDraft(request),
                              deletionScope: e.target.value,
                            },
                          }))
                        }
                        placeholder="Např. anonymizace kontaktu a poznámek"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                      />
                      <input
                        aria-label={`Blokované systémy ${request.id}`}
                        type="text"
                        value={getErasureDraft(request).blockedSystems}
                        onChange={(e) =>
                          setDsrErasureDrafts((prev) => ({
                            ...prev,
                            [request.id]: {
                              ...getErasureDraft(request),
                              blockedSystems: e.target.value,
                            },
                          }))
                        }
                        placeholder="Např. účetnictví do konce retenční lhůty"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                      />
                      <input
                        aria-label={`Odpovědná osoba výmazu ${request.id}`}
                        type="text"
                        value={getErasureDraft(request).manualExecutionOwner}
                        onChange={(e) =>
                          setDsrErasureDrafts((prev) => ({
                            ...prev,
                            [request.id]: {
                              ...getErasureDraft(request),
                              manualExecutionOwner: e.target.value,
                            },
                          }))
                        }
                        placeholder="Např. compliance admin / support lead"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                      />
                      <textarea
                        aria-label={`Komunikace k výmazu ${request.id}`}
                        value={getErasureDraft(request).requesterCommunication}
                        onChange={(e) =>
                          setDsrErasureDrafts((prev) => ({
                            ...prev,
                            [request.id]: {
                              ...getErasureDraft(request),
                              requesterCommunication: e.target.value,
                            },
                          }))
                        }
                        rows={3}
                        placeholder="Jak a kdy bude žadateli potvrzen rozsah výmazu nebo důvod omezení."
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white xl:col-span-2"
                      />
                    </div>
                  ) : (
                    <textarea
                      aria-label={`Shrnutí vyřízení ${request.id}`}
                      value={dsrResolutionDrafts[request.id] ?? request.resolutionSummary}
                      onChange={(e) =>
                        setDsrResolutionDrafts((prev) => ({ ...prev, [request.id]: e.target.value }))
                      }
                      rows={3}
                      placeholder="Stručně zapište, jak byl požadavek vyřízen nebo proč ještě čeká."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                    />
                  )}
                  <button
                    onClick={() => void handleSaveDsrHandling(request)}
                    disabled={savingDsrHandlingId === request.id}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {savingDsrHandlingId === request.id ? "Ukládám…" : "Uložit evidenci vyřízení"}
                  </button>
                </div>
                {request.status !== "completed" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => void handleAdvanceDsrStatus(request)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Posunout na {requestStatusLabel[request.status === "new" ? "in_progress" : "completed"]}
                    </button>
                    <button
                      onClick={() => void handleExportDsr(request)}
                      className="rounded-lg border border-cyan-300 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-700 dark:text-cyan-300 dark:hover:bg-cyan-950/40"
                    >
                      Export JSON
                    </button>
                    <button
                      onClick={() =>
                        showAlert({
                          title: "Mazání je vypnuté",
                          message:
                            request.requestType === "erasure"
                              ? "Požadavek na výmaz se v tomto panelu pouze připraví k ručnímu provedení. Žádná anonymizace ani mazání databázových dat se teď z UI nespouští."
                              : "Požadavek na výmaz se v tomto panelu pouze eviduje. Žádná anonymizace ani mazání databázových dat se teď z UI nespouští.",
                          variant: "info",
                        })
                      }
                      className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-950/40"
                    >
                      Výmaz je jen evidenční
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/40 dark:bg-slate-900/80">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Breach register
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Evidence bezpečnostních incidentů s dopadem do osobních údajů. Pomáhá doložit posouzení,
            stav řešení a případnou notifikaci do 72 hodin.
          </p>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700/50">
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_140px_180px_auto]">
                <input
                  aria-label="Název breach case"
                  type="text"
                  value={newBreachTitle}
                  onChange={(e) => setNewBreachTitle(e.target.value)}
                  placeholder="Např. Podezření na neoprávněný export"
                  className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                />
                <select
                  aria-label="Riziko breach case"
                  value={newBreachRisk}
                  onChange={(e) => setNewBreachRisk(e.target.value as BreachCase["riskLevel"])}
                  className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                >
                  <option value="low">Nízké</option>
                  <option value="medium">Střední</option>
                  <option value="high">Vysoké</option>
                </select>
                <input
                  aria-label="Navázaný incident"
                  type="text"
                  value={newBreachIncidentId}
                  onChange={(e) => setNewBreachIncidentId(e.target.value)}
                  placeholder="Incident ID (volitelné)"
                  className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                />
                <button
                  onClick={() => void handleCreateBreach()}
                  disabled={isSavingBreach}
                  className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
                >
                  {isSavingBreach ? "Ukládám…" : "Přidat"}
                </button>
              </div>
            </div>
            {breachCases.map((breach) => (
              <div
                key={breach.id}
                className="rounded-xl border border-slate-200 p-4 dark:border-slate-700/50"
              >
                {(() => {
                  const deadlineAt = new Date(
                    new Date(breach.createdAt).getTime() + 72 * 60 * 60 * 1000,
                  );
                  const hoursLeft = Math.round((deadlineAt.getTime() - Date.now()) / (60 * 60 * 1000));
                  const deadlineTone =
                    hoursLeft < 0
                      ? "text-rose-600 dark:text-rose-300"
                      : hoursLeft <= 24
                        ? "text-amber-600 dark:text-amber-300"
                        : "text-emerald-600 dark:text-emerald-300";

                  const eventsForBreach = breachCaseEvents.filter(
                    (event) => event.breachCaseId === breach.id,
                  );

                  return (
                    <>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {breach.title}
                  </div>
                  <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                    {breach.riskLevel.toUpperCase()}
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {breach.id} • stav {breachStatusLabel[breach.status]}
                </div>
                <div className={`mt-2 text-xs font-semibold ${deadlineTone}`}>
                  72h deadline: {formatDateTime(deadlineAt.toISOString())}{" "}
                  {hoursLeft < 0 ? `• po termínu ${Math.abs(hoursLeft)} h` : `• zbývá cca ${hoursLeft} h`}
                </div>
                {breach.linkedIncidentId ? (
                  <div className="mt-1 text-xs text-slate-500">
                    Navázaný incident: {breach.linkedIncidentId}
                  </div>
                ) : null}
                <div className="mt-2 text-xs text-slate-500">
                  Posun stavu zapisuje průběh posouzení a pomáhá hlídat 72h proces. Neprovádí žádné
                  změny v produkčních datech zákazníků.
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  ÚOOÚ: {formatDateTime(breach.authorityNotifiedAt)} • Subjekty:{" "}
                  {formatDateTime(breach.dataSubjectsNotifiedAt)}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Dotčené údaje: {breach.affectedDataCategories.join(", ") || "neuvedeno"} •
                  Subjekty: {breach.affectedSubjectTypes.join(", ") || "neuvedeno"} • Odhad:{" "}
                  {breach.estimatedSubjectCount ?? "neuvedeno"}
                </div>
                {breach.status !== "closed" && (
                  <button
                    onClick={() => void handleAdvanceBreachStatus(breach)}
                    className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Posunout na{" "}
                    {breachStatusLabel[
                      breach.status === "triage"
                        ? "assessment"
                        : breach.status === "assessment"
                          ? "reported"
                          : "closed"
                    ]}
                  </button>
                )}
                <div className="mt-4 space-y-3 rounded-xl border border-slate-200/80 p-3 dark:border-slate-700/50">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Klasifikace dopadu
                  </div>
                  <input
                    aria-label={`Kategorie údajů ${breach.id}`}
                    type="text"
                    value={breachDataCategoriesDrafts[breach.id] ?? breach.affectedDataCategories.join(", ")}
                    onChange={(e) =>
                      setBreachDataCategoriesDrafts((prev) => ({ ...prev, [breach.id]: e.target.value }))
                    }
                    placeholder="Např. jméno, e-mail, telefon"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                  />
                  <input
                    aria-label={`Typy subjektů ${breach.id}`}
                    type="text"
                    value={breachSubjectTypesDrafts[breach.id] ?? breach.affectedSubjectTypes.join(", ")}
                    onChange={(e) =>
                      setBreachSubjectTypesDrafts((prev) => ({ ...prev, [breach.id]: e.target.value }))
                    }
                    placeholder="Např. zákazníci, kontaktní osoby, zaměstnanci"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                  />
                  <input
                    aria-label={`Odhad subjektů ${breach.id}`}
                    type="number"
                    min={0}
                    value={breachEstimatedCountDrafts[breach.id] ?? String(breach.estimatedSubjectCount ?? "")}
                    onChange={(e) =>
                      setBreachEstimatedCountDrafts((prev) => ({ ...prev, [breach.id]: e.target.value }))
                    }
                    placeholder="Např. 25"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                  />
                  <textarea
                    aria-label={`Důvod hlášení ${breach.id}`}
                    value={breachRationaleDrafts[breach.id] ?? breach.notificationRationale}
                    onChange={(e) =>
                      setBreachRationaleDrafts((prev) => ({ ...prev, [breach.id]: e.target.value }))
                    }
                    rows={3}
                    placeholder="Stručně vysvětlete, proč se případ hlásí nebo nehlásí, a jaké je riziko."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                  />
                  <button
                    onClick={() => void handleSaveBreachClassification(breach)}
                    disabled={savingBreachClassificationId === breach.id}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {savingBreachClassificationId === breach.id ? "Ukládám…" : "Uložit klasifikaci"}
                  </button>
                </div>
                <div className="mt-4 space-y-3 rounded-xl border border-slate-200/80 p-3 dark:border-slate-700/50">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Posouzení případu
                  </div>
                  <textarea
                    aria-label={`Posouzení ${breach.id}`}
                    value={breachAssessmentDrafts[breach.id] ?? breach.assessmentSummary}
                    onChange={(e) =>
                      setBreachAssessmentDrafts((prev) => ({ ...prev, [breach.id]: e.target.value }))
                    }
                    rows={3}
                    placeholder="Stručně popište rozsah, dopad, pravděpodobnost rizika a další krok."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                  />
                  <button
                    onClick={() => void handleSaveBreachAssessment(breach)}
                    disabled={savingBreachAssessmentId === breach.id}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {savingBreachAssessmentId === breach.id ? "Ukládám…" : "Uložit posouzení"}
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => void handleMarkBreachNotification(breach, "authority")}
                    disabled={Boolean(breach.authorityNotifiedAt) || markingBreachNotification === `${breach.id}:authority`}
                    className="rounded-lg border border-cyan-300 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 disabled:opacity-50 dark:border-cyan-700 dark:text-cyan-300 dark:hover:bg-cyan-950/40"
                  >
                    {breach.authorityNotifiedAt ? "ÚOOÚ zapsáno" : "Zapsat hlášení ÚOOÚ"}
                  </button>
                  <button
                    onClick={() => void handleMarkBreachNotification(breach, "data_subjects")}
                    disabled={
                      Boolean(breach.dataSubjectsNotifiedAt) ||
                      markingBreachNotification === `${breach.id}:data_subjects`
                    }
                    className="rounded-lg border border-violet-300 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:opacity-50 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-950/40"
                  >
                    {breach.dataSubjectsNotifiedAt
                      ? "Subjekty zapsány"
                      : "Zapsat informování subjektů"}
                  </button>
                  <button
                    onClick={() => handleDownloadBreachAuthorityReport(breach)}
                    className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                  >
                    Stáhnout podklady pro ÚOOÚ
                  </button>
                </div>
                <div className="mt-4 space-y-3 rounded-xl border border-slate-200/80 p-3 dark:border-slate-700/50">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Timeline 72h
                  </div>
                  <p className="text-xs text-slate-500">
                    Sem zapisuj jen evidenční kroky: detekce, containment, interní eskalace,
                    právní posouzení a případné notifikace.
                  </p>
                  <div className="space-y-2">
                    {eventsForBreach.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700/50"
                      >
                        <div className="font-semibold text-slate-700 dark:text-slate-200">
                          {formatDateTime(event.createdAt)} • {event.eventType}
                        </div>
                        <div className="mt-1 text-slate-500">
                          {event.summary}
                        </div>
                      </div>
                    ))}
                  </div>
                  <textarea
                    aria-label={`Timeline ${breach.id}`}
                    value={breachTimelineDrafts[breach.id] ?? ""}
                    onChange={(e) =>
                      setBreachTimelineDrafts((prev) => ({ ...prev, [breach.id]: e.target.value }))
                    }
                    rows={2}
                    placeholder="Např. potvrzena interní eskalace, rotace klíčů, právní posouzení rizika…"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                  />
                  <button
                    onClick={() => void handleAddBreachTimelineEvent(breach)}
                    disabled={savingBreachTimelineId === breach.id}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {savingBreachTimelineId === breach.id ? "Ukládám…" : "Přidat krok do timeline"}
                  </button>
                </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/40 dark:bg-slate-900/80">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Subprocessors
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Registr dodavatelů, kteří zpracovávají data pro Tender Flow. Slouží pro audit, DPA
            přehled a kontrolu regionů a přenosových mechanismů.
          </p>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700/50">
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.1fr)_120px_minmax(0,1.2fr)_120px_auto]">
                <input
                  aria-label="Název subprocessoru"
                  type="text"
                  value={newSubprocessorName}
                  onChange={(e) => setNewSubprocessorName(e.target.value)}
                  placeholder="Např. Supabase"
                  className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                />
                <input
                  aria-label="Region subprocessoru"
                  type="text"
                  value={newSubprocessorRegion}
                  onChange={(e) => setNewSubprocessorRegion(e.target.value)}
                  placeholder="EU"
                  className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                />
                <input
                  aria-label="Účel subprocessoru"
                  type="text"
                  value={newSubprocessorPurpose}
                  onChange={(e) => setNewSubprocessorPurpose(e.target.value)}
                  placeholder="Hosting, e-mailing, analytika"
                  className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                />
                <input
                  aria-label="Přenosový mechanismus subprocessoru"
                  type="text"
                  value={newSubprocessorTransfer}
                  onChange={(e) => setNewSubprocessorTransfer(e.target.value)}
                  placeholder="SCC"
                  className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                />
                <button
                  onClick={() => void handleCreateSubprocessor()}
                  disabled={isSavingSubprocessor}
                  className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  {isSavingSubprocessor ? "Ukládám…" : "Přidat"}
                </button>
              </div>
            </div>
            {!hasRealSubprocessors ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                Registr zatím obsahuje jen bootstrap placeholder. Doporučený další krok je doplnit
                skutečné dodavatele a přenosové mechanismy.
              </div>
            ) : null}
            {subprocessors.map((record) => (
              <div
                key={record.id}
                className="rounded-xl border border-slate-200 p-4 dark:border-slate-700/50"
              >
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {record.name}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {record.purpose}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {record.region} • {record.transferMechanism}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Záznam slouží pro audit dodavatelů, DPA kontrolu a ověření přenosů mimo EU.
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/40 dark:bg-slate-900/80">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            ROPA / činnosti zpracování
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Interní registr účelů zpracování, právních titulů a kategorií dat. Pomáhá při auditu,
            odpovědích na dotazy zákazníků i při sladění legal textů s realitou.
          </p>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700/50">
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                <input
                  aria-label="Název činnosti zpracování"
                  type="text"
                  value={newProcessingActivityName}
                  onChange={(e) => setNewProcessingActivityName(e.target.value)}
                  placeholder="Např. Správa kontaktů v CRM"
                  className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                />
                <input
                  aria-label="Účel činnosti zpracování"
                  type="text"
                  value={newProcessingActivityPurpose}
                  onChange={(e) => setNewProcessingActivityPurpose(e.target.value)}
                  placeholder="Např. obchodní komunikace a plnění smlouvy"
                  className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                />
                <input
                  aria-label="Právní titul činnosti zpracování"
                  type="text"
                  value={newProcessingActivityLegalBasis}
                  onChange={(e) => setNewProcessingActivityLegalBasis(e.target.value)}
                  placeholder="Např. plnění smlouvy"
                  className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                />
                <input
                  aria-label="Kategorie dat činnosti zpracování"
                  type="text"
                  value={newProcessingActivityCategories}
                  onChange={(e) => setNewProcessingActivityCategories(e.target.value)}
                  placeholder="Např. jméno, e-mail, telefon"
                  className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                />
                <select
                  aria-label="Navázaná retention policy"
                  value={newProcessingActivityRetentionId}
                  onChange={(e) => setNewProcessingActivityRetentionId(e.target.value)}
                  className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                >
                  <option value="">Bez vazby na retention policy</option>
                  {retentionPolicies.map((policy) => (
                    <option key={policy.id} value={policy.id}>
                      {policy.category}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Navázané subprocessory činnosti zpracování"
                  multiple
                  value={newProcessingActivitySubprocessorIds}
                  onChange={(e) =>
                    setNewProcessingActivitySubprocessorIds(
                      Array.from(e.target.selectedOptions, (option) => option.value),
                    )
                  }
                  className="min-h-28 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                >
                  {subprocessors
                    .filter((record) => record.id !== "subprocessors-missing")
                    .map((record) => (
                      <option key={record.id} value={record.id}>
                        {record.name} ({record.region})
                      </option>
                    ))}
                </select>
                <button
                  onClick={() => void handleCreateProcessingActivity()}
                  disabled={isSavingProcessingActivity}
                  className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isSavingProcessingActivity ? "Ukládám…" : "Přidat"}
                </button>
              </div>
            </div>
            {!hasRealProcessingActivities ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                Registr činností zatím obsahuje jen placeholder. Další krok je zapsat hlavní
                datové toky, právní titul a vazbu na retenci.
              </div>
            ) : null}
            {processingActivities.map((record) => (
              <div
                key={record.id}
                className="rounded-xl border border-slate-200 p-4 dark:border-slate-700/50"
              >
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {record.activityName}
                </div>
                <div className="mt-1 text-sm text-slate-500">{record.purpose}</div>
                <div className="mt-2 text-xs text-slate-500">
                  Právní titul: {record.legalBasis}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Kategorie dat: {record.dataCategories.join(", ")}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {record.retentionPolicyId
                    ? `Navázaná retence: ${retentionLabelById.get(record.retentionPolicyId) || record.retentionPolicyId}`
                    : "Retence zatím není navázaná"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {record.linkedSubprocessorIds.length > 0
                    ? `Subprocessors: ${record.linkedSubprocessorIds
                        .map((id) => subprocessorNameById.get(id) || id)
                        .join(", ")}`
                    : "Subprocessors zatím nejsou navázané"}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Tento záznam jen dokumentuje činnost zpracování. Nemění ani nemaže žádná
                  produkční data.
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/40 dark:bg-slate-900/80">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Access review a audit oprávnění
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Přehled privilegovaných účtů, změn rolí a pravidelných kontrol přístupů. Tato sekce jen
            eviduje a vyhodnocuje přístupy, nic nemaže ani automaticky nepřepisuje.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700/50">
              <div className="text-xs uppercase tracking-wide text-slate-500">Účty</div>
              <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                {accessReviewUsers.length}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700/50">
              <div className="text-xs uppercase tracking-wide text-slate-500">Rizikové účty</div>
              <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-300">
                {accessReviewUsers.filter((user) => user.riskFlags.length > 0).length}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700/50">
              <div className="text-xs uppercase tracking-wide text-slate-500">Audit změn</div>
              <div className="mt-2 text-2xl font-black text-cyan-600 dark:text-cyan-300">
                {accessAuditEntries.length}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700/50">
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
              <input
                aria-label="Shrnutí access review"
                type="text"
                value={newAccessReviewSummary}
                onChange={(e) => setNewAccessReviewSummary(e.target.value)}
                placeholder="Např. měsíční kontrola admin přístupů a neaktivních účtů"
                className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
              />
              <button
                onClick={() => void handleCreateAccessReview()}
                disabled={isSavingAccessReview}
                className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {isSavingAccessReview ? "Ukládám…" : "Uložit review snapshot"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Snapshot uloží počet účtů, privilegovaných přístupů a neaktivních účtů k určitému
              datu jako důkaz pravidelné kontroly.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Rizikové nebo privilegované účty
            </h4>
            {accessReviewUsers
              .filter((user) => user.riskFlags.length > 0)
              .slice(0, 8)
              .map((user) => (
                <div
                  key={user.userId}
                  className="rounded-xl border border-slate-200 p-4 dark:border-slate-700/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {user.displayName || user.email}
                      </div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {user.riskFlags.map((flag) => (
                        <span
                          key={`${user.userId}-${flag}`}
                          className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                        >
                          {flag === "stale_account"
                            ? "Neaktivní účet"
                            : flag === "privileged_access"
                              ? "Privilegovaný přístup"
                              : flag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Aplikační role: {user.appRoleLabel || user.appRoleId || "bez role"} • Org role:{" "}
                    {user.orgRoles.length > 0 ? user.orgRoles.join(", ") : "žádná"} • Poslední
                    přihlášení: {formatDateTime(user.lastSignIn)}
                  </div>
                </div>
              ))}
          </div>

          <div className="mt-4 space-y-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Poslední změny práv</h4>
            {accessAuditEntries.slice(0, 8).map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-slate-200 p-4 dark:border-slate-700/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {entry.summary}
                  </div>
                  <div className="text-xs text-slate-500">{formatDateTime(entry.createdAt)}</div>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Aktér: {entry.actorEmail || "system"} • Cíl: {entry.targetUserEmail || entry.targetRoleId || "n/a"}
                </div>
                {(entry.permissionKey || entry.oldValue || entry.newValue) ? (
                  <div className="mt-1 text-xs text-slate-500">
                    {entry.permissionKey ? `Permission: ${entry.permissionKey} • ` : ""}
                    {entry.oldValue ? `původně ${entry.oldValue} • ` : ""}
                    {entry.newValue ? `nově ${entry.newValue}` : ""}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Poslední review snapshoty</h4>
            {accessReviewReports.slice(0, 5).map((report) => (
              <div
                key={report.id}
                className="rounded-xl border border-slate-200 p-4 dark:border-slate-700/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {report.summary || "Bez poznámky"}
                  </div>
                  <div className="text-xs text-slate-500">{formatDateTime(report.createdAt)}</div>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Scope: {report.reviewScope} • Reviewer: {report.reviewedByEmail || "admin"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Účty: {report.totalUsers} • Privilegované: {report.adminUsers} • Neaktivní:{" "}
                  {report.staleUsers}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
