import React, { useEffect, useMemo, useState } from "react";

import { Modal } from "@/shared/ui/Modal";

type ContractProtocolKindView = "sub_work_handover" | "site_handover";

interface ContractProtocolFieldMetaView {
  label: string;
  required: boolean;
  autofill: boolean;
  manualOnly: boolean;
  multiline?: boolean;
}

interface ContractProtocolDraftView {
  documentKind: ContractProtocolKindView;
  actionLabel: string;
  templateStatus: "final" | "provisional";
  fields: Record<string, string>;
  fieldOrder: string[];
  fieldMeta: Record<string, ContractProtocolFieldMetaView>;
  missingFields: string[];
}

interface ContractProtocolModalProps {
  isOpen: boolean;
  draft: ContractProtocolDraftView | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => Promise<void> | void;
}

interface SectionDefinition {
  id: string;
  title: string;
  fieldKeys: string[];
}

const PROTOCOL_SECTIONS: Record<ContractProtocolKindView, SectionDefinition[]> = {
  sub_work_handover: [
    {
      id: "contract-subject",
      title: "Identifikace Předání",
      fieldKeys: [
        "issuerCompany",
        "issuerRepresentative",
        "subcontractorCompany",
        "subcontractorRepresentative",
        "contractNumber",
        "projectName",
        "siteLocation",
        "workSubject",
      ],
    },
    {
      id: "handover-conditions",
      title: "Předání A Vady",
      fieldKeys: [
        "qualityDocuments",
        "asBuiltDocuments",
        "takeoverScheduledAt",
        "takeoverActualAt",
        "delayPenalty",
        "defectsList",
        "defectsRemovalAt",
        "siteClearanceAt",
        "defectsPenalty",
        "irreparableDefectsDiscount",
      ],
    },
    {
      id: "warranty-signatures",
      title: "Záruka A Podpisy",
      fieldKeys: [
        "warrantyStartAt",
        "warrantySecurity",
        "takeoverDeclarationDate",
        "issuerSigner",
        "subcontractorSigner",
      ],
    },
  ],
  site_handover: [
    {
      id: "intro",
      title: "Úvodní Údaje",
      fieldKeys: [
        "protocolStartDate",
        "protocolNumber",
        "projectNameNumber",
        "siteLocation",
        "district",
      ],
    },
    {
      id: "parties-contract",
      title: "Smluvní Strany",
      fieldKeys: [
        "contractorCompany",
        "contractorRepresentative",
        "contractorIco",
        "customerCompany",
        "customerRepresentative",
        "customerIco",
        "contractNumber",
        "contractSignedAt",
        "amendmentCount",
      ],
    },
    {
      id: "schedule-finance",
      title: "Termíny A Cena",
      fieldKeys: [
        "scheduleStartContract",
        "scheduleStartActual",
        "scheduleEndContract",
        "delayReasons",
        "priceWithoutVat",
        "priceWithVat",
      ],
    },
    {
      id: "handover-content",
      title: "Obsah Předání",
      fieldKeys: [
        "handedDocumentation",
        "documentsDuringWork",
        "deviationsReason",
        "defectsList",
        "accessAgreement",
        "siteClearanceAgreement",
        "additionalAgreements",
        "acceptanceStatement",
        "warrantyInfo",
        "handoverEndDate",
      ],
    },
    {
      id: "signatures",
      title: "Podpisová Část",
      fieldKeys: [
        "signContractorCompany",
        "signContractorLocation",
        "signCustomerCompany",
        "signTechnicalSupervisor",
      ],
    },
  ],
};

const getBadgeClasses = (variant: "danger" | "warning" | "success" | "neutral") => {
  if (variant === "danger") {
    return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  }
  if (variant === "warning") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  }
  if (variant === "success") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  }
  return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200";
};

export const ContractProtocolModal: React.FC<ContractProtocolModalProps> = ({
  isOpen,
  draft,
  isSubmitting = false,
  onClose,
  onSubmit,
}) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showMissingOnly, setShowMissingOnly] = useState(false);

  useEffect(() => {
    if (!draft) {
      setValues({});
      return;
    }
    setValues(draft.fields);
    setShowMissingOnly(false);
  }, [draft]);

  const missingFieldLabels = useMemo(() => {
    if (!draft) return [];
    return draft.missingFields
      .map((key) => draft.fieldMeta[key]?.label)
      .filter((label): label is string => !!label);
  }, [draft]);

  const totalFields = draft?.fieldOrder.length || 0;

  const filledCount = useMemo(() => {
    if (!draft) return 0;
    return draft.fieldOrder.filter((key) => (values[key] || "").trim().length > 0)
      .length;
  }, [draft, values]);

  const autoFillTotal = useMemo(() => {
    if (!draft) return 0;
    return draft.fieldOrder.filter((key) => draft.fieldMeta[key]?.autofill).length;
  }, [draft]);

  const autoFillFilled = useMemo(() => {
    if (!draft) return 0;
    return draft.fieldOrder.filter((key) => {
      const meta = draft.fieldMeta[key];
      return !!meta?.autofill && (values[key] || "").trim().length > 0;
    }).length;
  }, [draft, values]);

  const sections = useMemo(() => {
    if (!draft) return [];
    const definitions = PROTOCOL_SECTIONS[draft.documentKind] || [];
    const usedKeys = new Set<string>();

    const mapped = definitions
      .map((section) => {
        const existingKeys = section.fieldKeys.filter((key) =>
          draft.fieldOrder.includes(key),
        );
        existingKeys.forEach((key) => usedKeys.add(key));
        return {
          ...section,
          fieldKeys: existingKeys,
        };
      })
      .filter((section) => section.fieldKeys.length > 0);

    const leftovers = draft.fieldOrder.filter((key) => !usedKeys.has(key));
    if (leftovers.length > 0) {
      mapped.push({
        id: "other-fields",
        title: "Další Údaje",
        fieldKeys: leftovers,
      });
    }

    return mapped;
  }, [draft]);

  if (!draft) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Generování protokolu" size="xl">
        <div className="text-sm text-slate-500">Načítám návrh protokolu...</div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={draft.actionLabel}
      description="Zkontrolujte a případně doplňte data před generováním dokumentu."
      size="2xl"
    >
      <div className="space-y-4">
        {draft.templateStatus === "provisional" && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
            Používá se dočasná šablona. Po dodání finálního vzoru se vymění pouze
            mapování bez změny UX.
          </div>
        )}

        {missingFieldLabels.length > 0 && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
            Chybějící údaje: {missingFieldLabels.join(", ")}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/50">
            {sections.map((section) => (
              <div
                key={section.id}
                className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="mb-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  {section.title}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {section.fieldKeys.map((fieldKey) => {
                    const meta = draft.fieldMeta[fieldKey];
                    if (!meta) return null;

                    const value = values[fieldKey] || "";
                    const normalizedValue = value.trim();
                    const isMissing = draft.missingFields.includes(fieldKey);
                    const shouldHide = showMissingOnly && !isMissing;

                    if (shouldHide) return null;

                    const statusLabel = isMissing
                      ? "Chybí"
                      : meta.autofill && normalizedValue
                        ? "Předvyplněno"
                        : meta.manualOnly && normalizedValue
                          ? "Doplněno ručně"
                          : normalizedValue
                            ? "Vyplněno"
                            : "Prázdné";

                    const statusVariant = isMissing
                      ? "danger"
                      : meta.autofill && normalizedValue
                        ? "success"
                        : normalizedValue
                          ? "neutral"
                          : "warning";

                    return (
                      <div
                        key={fieldKey}
                        className={`rounded-lg border px-3 py-2 ${
                          isMissing
                            ? "border-red-300 bg-red-50/60"
                            : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                        }`}
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {meta.label}
                          </label>
                          {meta.required && (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-red-700 dark:bg-red-900/40 dark:text-red-300">
                              povinné
                            </span>
                          )}
                          {meta.manualOnly && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                              ručně
                            </span>
                          )}
                          {meta.autofill && (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              autofill
                            </span>
                          )}
                          <span
                            className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getBadgeClasses(
                              statusVariant,
                            )}`}
                          >
                            {statusLabel}
                          </span>
                        </div>

                        {meta.multiline ? (
                          <textarea
                            value={value}
                            rows={3}
                            onChange={(event) =>
                              setValues((prev) => ({
                                ...prev,
                                [fieldKey]: event.target.value,
                              }))
                            }
                            placeholder={isMissing ? "Doplňte chybějící údaj" : ""}
                            className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 ${
                              isMissing
                                ? "border-red-400 focus:border-red-500 dark:border-red-500 dark:focus:border-red-400"
                                : "border-slate-300 focus:border-primary dark:border-slate-600 dark:focus:border-sky-400"
                            }`}
                          />
                        ) : (
                          <input
                            value={value}
                            onChange={(event) =>
                              setValues((prev) => ({
                                ...prev,
                                [fieldKey]: event.target.value,
                              }))
                            }
                            placeholder={isMissing ? "Doplňte chybějící údaj" : ""}
                            className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 ${
                              isMissing
                                ? "border-red-400 focus:border-red-500 dark:border-red-500 dark:focus:border-red-400"
                                : "border-slate-300 focus:border-primary dark:border-slate-600 dark:focus:border-sky-400"
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <aside className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Souhrn Vyplnění
              </h4>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Vyplněno</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {filledCount} / {totalFields}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">
                    Doplněno z TF
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {autoFillFilled} / {autoFillTotal}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Chybí</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    {draft.missingFields.length}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowMissingOnly((prev) => !prev)}
                className={`mt-3 w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  showMissingOnly
                    ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200"
                    : "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {showMissingOnly ? "Zobrazit vše" : "Zobrazit jen chybějící"}
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              Zelené pole znamená, že TF našel data automaticky. Červené pole je
              potřeba doplnit před exportem.
            </div>
          </aside>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Zrušit
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onSubmit(values)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting ? "Generuji..." : "Vytvořit .xlsx"}
          </button>
        </div>
      </div>
    </Modal>
  );
};
