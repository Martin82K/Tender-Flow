import React, { useEffect, useMemo, useState } from "react";
import { useUI } from "@/context/UIContext";
import {
  anonymizeDataSubjectAdmin,
  createBreachCaseAdmin,
  createDataSubjectRequestAdmin,
  exportDataSubjectAdmin,
  getComplianceOverviewAdmin,
  runComplianceRetentionPurgeAdmin,
  saveComplianceRetentionPolicyAdmin,
  saveSubprocessorAdmin,
  updateBreachCaseStatusAdmin,
  updateDataSubjectRequestStatusAdmin,
} from "@/features/settings/api/complianceAdminService";
import type { ComplianceOverview } from "@/features/settings/api/complianceAdminService";
import type {
  ComplianceChecklistItem,
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

const breachStatusLabel: Record<BreachCase["status"], string> = {
  triage: "Triage",
  assessment: "Posouzení",
  reported: "Nahlášeno",
  closed: "Uzavřeno",
};

export const ComplianceAdmin: React.FC = () => {
  const { showAlert, showConfirm } = useUI();
  const [overview, setOverview] = useState<ComplianceOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingDsr, setIsSavingDsr] = useState(false);
  const [isSavingBreach, setIsSavingBreach] = useState(false);
  const [newDsrType, setNewDsrType] = useState<DataSubjectRequest["requestType"]>("export");
  const [newDsrLabel, setNewDsrLabel] = useState("");
  const [newDsrDueAt, setNewDsrDueAt] = useState("");
  const [newBreachTitle, setNewBreachTitle] = useState("");
  const [newBreachRisk, setNewBreachRisk] = useState<BreachCase["riskLevel"]>("medium");
  const [newBreachIncidentId, setNewBreachIncidentId] = useState("");
  const [retentionDrafts, setRetentionDrafts] = useState<Record<string, number>>({});
  const [savingRetentionId, setSavingRetentionId] = useState<string | null>(null);
  const [isRunningRetentionPurge, setIsRunningRetentionPurge] = useState(false);
  const [isSavingSubprocessor, setIsSavingSubprocessor] = useState(false);
  const [newSubprocessorName, setNewSubprocessorName] = useState("");
  const [newSubprocessorRegion, setNewSubprocessorRegion] = useState("EU");
  const [newSubprocessorPurpose, setNewSubprocessorPurpose] = useState("");
  const [newSubprocessorTransfer, setNewSubprocessorTransfer] = useState("SCC");

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
  const subprocessors = overview?.subprocessors ?? [];

  const hasRealSubprocessors = useMemo(
    () => subprocessors.some((record) => record.id !== "subprocessors-missing"),
    [subprocessors],
  );

  const handleCreateDsr = async () => {
    if (!newDsrLabel.trim() || !newDsrDueAt) {
      showAlert({
        title: "Chybí údaje",
        message: "Vyplňte popis požadavku a termín.",
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
        dueAt: newDsrDueAt,
      });
      setNewDsrLabel("");
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

  const handleAdvanceDsrStatus = async (request: DataSubjectRequest) => {
    const nextStatus: DataSubjectRequest["status"] =
      request.status === "new"
        ? "in_progress"
        : request.status === "in_progress"
          ? "completed"
          : "completed";

    if (nextStatus === request.status) return;

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

  const handleAnonymizeDsr = async (request: DataSubjectRequest) => {
    const confirmed = await showConfirm({
      title: "Spustit anonymizaci?",
      message: `Anonymizace nahradí nalezené osobní údaje pro dotaz "${request.subjectLabel}". Akce je nevratná.`,
      variant: "danger",
      confirmLabel: "Anonymizovat",
      cancelLabel: "Zrušit",
    });

    if (!confirmed) return;

    try {
      const result = await anonymizeDataSubjectAdmin({
        query: request.subjectLabel,
      });

      showAlert({
        title: "Anonymizace dokončena",
        message: `Profily: ${result.anonymized_user_profiles}, kontakty: ${result.anonymized_subcontractors}, projekty: ${result.anonymized_projects}.`,
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: "Anonymizace selhala",
        message: `Nepodařilo se anonymizovat data subjektu: ${String((error as Error)?.message || error)}`,
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
    const confirmed = await showConfirm({
      title: "Spustit retention purge?",
      message:
        "Purge smaže staré auditní a timeline záznamy podle aktuálních retention policies.",
      variant: "danger",
      confirmLabel: "Spustit purge",
      cancelLabel: "Zrušit",
    });

    if (!confirmed) return;

    setIsRunningRetentionPurge(true);
    try {
      const result = await runComplianceRetentionPurgeAdmin();
      showAlert({
        title: "Purge dokončen",
        message: `Admin audit: ${result.admin_audit_deleted}, DSR eventy: ${result.dsr_events_deleted}, breach eventy: ${result.breach_events_deleted}.`,
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: "Purge selhal",
        message: `Compliance purge se nepodařilo dokončit: ${String((error as Error)?.message || error)}`,
        variant: "danger",
      });
    } finally {
      setIsRunningRetentionPurge(false);
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
          <div className="mt-3">
            <button
              onClick={() => void handleRunRetentionPurge()}
              disabled={isRunningRetentionPurge}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50"
            >
              {isRunningRetentionPurge ? "Spouštím purge…" : "Spustit purge"}
            </button>
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
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/40 dark:bg-slate-900/80">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            DSR fronta
          </h3>
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700/50">
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[140px_minmax(0,1fr)_180px_auto]">
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
                aria-label="Termín DSR požadavku"
                type="date"
                value={newDsrDueAt}
                onChange={(e) => setNewDsrDueAt(e.target.value)}
                className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
              />
              <button
                onClick={() => void handleCreateDsr()}
                disabled={isSavingDsr}
                className="rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
              >
                {isSavingDsr ? "Ukládám…" : "Přidat"}
              </button>
            </div>
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
                      onClick={() => void handleAnonymizeDsr(request)}
                      className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-950/40"
                    >
                      Anonymizovat
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
                {breach.linkedIncidentId ? (
                  <div className="mt-1 text-xs text-slate-500">
                    Navázaný incident: {breach.linkedIncidentId}
                  </div>
                ) : null}
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
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/40 dark:bg-slate-900/80">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Subprocessors
          </h3>
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
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
