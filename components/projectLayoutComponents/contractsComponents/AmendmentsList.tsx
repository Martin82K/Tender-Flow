import React, { useState } from "react";
import { ContractWithDetails, ContractAmendment } from "../../../types";
import { contractService } from "../../../services/contractService";
import { contractExtractionService } from "../../../services/contractExtractionService";
import { Modal } from "@/shared/ui/Modal";
import { MarkdownDocumentPanel } from "@/shared/contracts/MarkdownDocumentPanel";

interface AmendmentsListProps {
  contracts: ContractWithDetails[];
  selectedContractId: string | null;
  onSelectContract: (id: string | null) => void;
  onAmendmentCreated: () => void;
  onAmendmentDeleted: () => void;
}

const formatMoney = (value: number): string => {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
  }).format(value);
};

const formatDate = (date?: string): string =>
  date ? new Date(date).toLocaleDateString("cs-CZ") : "-";
const normalizeContractSortKey = (value: string | null | undefined): string =>
  (value || "").trim().toLocaleLowerCase("cs");

const sortContractsByVendor = (
  a: ContractWithDetails,
  b: ContractWithDetails,
): number =>
  normalizeContractSortKey(a.vendorName).localeCompare(
    normalizeContractSortKey(b.vendorName),
    "cs",
    { sensitivity: "base" },
  ) ||
  normalizeContractSortKey(a.title).localeCompare(
    normalizeContractSortKey(b.title),
    "cs",
    { sensitivity: "base" },
  ) ||
  (a.contractNumber || "").localeCompare(b.contractNumber || "", "cs", {
    sensitivity: "base",
  });

export const AmendmentsList: React.FC<AmendmentsListProps> = ({
  contracts,
  selectedContractId,
  onSelectContract,
  onAmendmentCreated,
  onAmendmentDeleted,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMarkdownModal, setShowMarkdownModal] = useState(false);
  const [selectedAmendment, setSelectedAmendment] =
    useState<ContractAmendment | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrSeedRawText, setOcrSeedRawText] = useState<string | null>(null);
  const [ocrSeedFileName, setOcrSeedFileName] = useState<string | null>(null);
  const [ocrSeedProvider, setOcrSeedProvider] = useState<string | null>(null);
  const [ocrSeedModel, setOcrSeedModel] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    signedAt: "",
    effectiveFrom: "",
    deltaPrice: "",
    deltaDeadline: "",
    reason: "",
  });

  const selectedContract = contracts.find(
    (c) => c.id === (selectedContractId || ""),
  );
  const sortedContracts = [...contracts].sort(sortContractsByVendor);
  const amendments = selectedContract?.amendments || [];
  const selectedContractAmendmentsDelta = amendments.reduce(
    (sum, amendment) => sum + amendment.deltaPrice,
    0,
  );
  const contractsWithAmendments = sortedContracts.filter(
    (contract) => contract.amendments.length > 0,
  );
  const totalAmendments = contractsWithAmendments.reduce(
    (sum, contract) => sum + contract.amendments.length,
    0,
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContractId) return;
    try {
      const createdAmendment = await contractService.createAmendment({
        contractId: selectedContractId,
        signedAt: formData.signedAt || undefined,
        effectiveFrom: formData.effectiveFrom || undefined,
        deltaPrice: parseFloat(formData.deltaPrice) || 0,
        deltaDeadline: formData.deltaDeadline || undefined,
        reason: formData.reason || undefined,
      });
      if (ocrSeedRawText?.trim()) {
        await contractService.createMarkdownVersion({
          entityType: "amendment",
          amendmentId: createdAmendment.id,
          sourceKind: "ocr",
          contentMd: ocrSeedRawText,
          sourceFileName: ocrSeedFileName || undefined,
          ocrProvider: ocrSeedProvider || undefined,
          ocrModel: ocrSeedModel || undefined,
        });
      }
      setShowCreateModal(false);
      setFormData({
        signedAt: "",
        effectiveFrom: "",
        deltaPrice: "",
        deltaDeadline: "",
        reason: "",
      });
      setOcrSeedRawText(null);
      setOcrSeedFileName(null);
      setOcrSeedProvider(null);
      setOcrSeedModel(null);
      onAmendmentCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    }
  };

  const handleDelete = async () => {
    if (!selectedAmendment) return;
    try {
      setDeleting(true);
      await contractService.deleteAmendment(selectedAmendment.id);
      setShowDeleteModal(false);
      onAmendmentDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setDeleting(false);
    }
  };

  const handlePdfUpload = async (file: File) => {
    try {
      setExtracting(true);
      const result =
        await contractExtractionService.extractAmendmentFromDocument(file);
      setFormData({
        signedAt: result.fields.signedAt?.toString() || "",
        effectiveFrom: result.fields.effectiveFrom?.toString() || "",
        deltaPrice: result.fields.deltaPrice?.toString() || "",
        deltaDeadline: result.fields.deltaDeadline?.toString() || "",
        reason: result.fields.reason?.toString() || "",
      });
      setOcrSeedRawText(result.rawText || null);
      setOcrSeedFileName(result.sourceFileName || file.name);
      setOcrSeedProvider(result.ocrProvider || null);
      setOcrSeedModel(result.ocrModel || null);
      setShowCreateModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba extrakce");
    } finally {
      setExtracting(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm";
  const panelCls =
    "rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800";
  const ghostActionCls =
    "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors";
  const primaryActionCls =
    "inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors whitespace-nowrap";

  return (
    <div className="space-y-4">
      <div className={panelCls}>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div>
            <p className="text-sm font-semibold">Přehled dodatků</p>
            <p className="text-xs text-slate-500">
              Smlouvy a společnosti, kde už existují dodatky.
            </p>
          </div>
          <div className="text-xs text-slate-500">
            {contractsWithAmendments.length} smluv • {totalAmendments} dodatků
          </div>
        </div>

        {contractsWithAmendments.length === 0 ? (
          <div className="px-4 py-5 text-sm text-slate-500">
            Zatím nejsou evidovány žádné dodatky.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {contractsWithAmendments.map((contract) => {
              const deltaSum = contract.amendments.reduce(
                (sum, amendment) => sum + amendment.deltaPrice,
                0,
              );
              const latestAmendment = [...contract.amendments].sort((a, b) =>
                (b.signedAt || "").localeCompare(a.signedAt || ""),
              )[0];

              return (
                <button
                  type="button"
                  key={contract.id}
                  onClick={() => onSelectContract(contract.id)}
                  className={`w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors ${
                    selectedContractId === contract.id
                      ? "bg-slate-100 dark:bg-slate-800/70"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">
                        {contract.vendorName}
                        <span className="text-slate-400 mx-2">•</span>
                        {contract.contractNumber
                          ? `[${contract.contractNumber}] `
                          : ""}
                        {contract.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Poslední dodatek: {formatDate(latestAmendment?.signedAt)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">
                        {contract.amendments.length}x dodatek
                      </p>
                      <p
                        className={`text-xs ${deltaSum > 0 ? "text-red-500" : deltaSum < 0 ? "text-emerald-600" : "text-slate-500"}`}
                      >
                        {deltaSum > 0 ? "+" : ""}
                        {formatMoney(deltaSum)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[420px]">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Smlouva
          </label>
          <select
            value={selectedContractId || ""}
            onChange={(e) => onSelectContract(e.target.value || null)}
            className={`${inputCls} w-full`}
          >
            <option value="">Vyberte...</option>
            {sortedContracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.vendorName} | {c.contractNumber ? `[${c.contractNumber}] ` : ""}
                {c.title}
              </option>
            ))}
          </select>
        </div>
        {selectedContractId && (
          <div className="flex gap-2 self-start lg:self-auto">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handlePdfUpload(e.target.files[0]);
                  e.target.value = "";
                }}
                disabled={extracting}
              />
              <span className={ghostActionCls}>
                {extracting ? (
                  "Analyzuji..."
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">
                      upload_file
                    </span>
                    PDF
                  </>
                )}
              </span>
            </label>
            <button
              onClick={() => {
                setOcrSeedRawText(null);
                setOcrSeedFileName(null);
                setOcrSeedProvider(null);
                setOcrSeedModel(null);
                setShowCreateModal(true);
              }}
              className={primaryActionCls}
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Nový
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm flex items-start gap-2">
          <span className="material-symbols-outlined text-lg">error</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

      {selectedContract && (
        <div className={`${panelCls} px-4 py-3`}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <p className="text-slate-500">
              Dodavatel:{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {selectedContract.vendorName}
              </span>
            </p>
            <p className="text-slate-500">
              Hodnota po dodatcích:{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {formatMoney(selectedContract.currentTotal)}
              </span>
            </p>
            <p className="text-slate-500">
              Počet dodatků:{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {amendments.length}
              </span>
            </p>
            <p className="text-slate-500">
              Změna hodnoty:{" "}
              <span
                className={`font-semibold ${
                  selectedContractAmendmentsDelta > 0
                    ? "text-red-500"
                    : selectedContractAmendmentsDelta < 0
                      ? "text-emerald-500"
                      : "text-slate-900 dark:text-slate-100"
                }`}
              >
                {selectedContractAmendmentsDelta > 0 ? "+" : ""}
                {formatMoney(selectedContractAmendmentsDelta)}
              </span>
            </p>
          </div>
        </div>
      )}

      {!selectedContractId || amendments.length === 0 ? (
        <div className={`${panelCls} text-center py-10`}>
          <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600">
            post_add
          </span>
          <p className="text-slate-500 dark:text-slate-400 mt-4">
            {!selectedContractId
              ? "Vyberte smlouvu"
              : "Pro vybranou smlouvu nejsou dodatky"}
          </p>
        </div>
      ) : (
        <div className={`${panelCls} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Č.
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Datum
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Změna
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Důvod
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {amendments.map((a) => (
                  <tr
                    key={a.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                      Dodatek č. {a.amendmentNo}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {formatDate(a.signedAt)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right text-sm font-semibold ${
                        a.deltaPrice > 0
                          ? "text-red-500"
                          : a.deltaPrice < 0
                            ? "text-emerald-500"
                            : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {a.deltaPrice > 0 ? "+" : ""}
                      {formatMoney(a.deltaPrice)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 max-w-[320px] truncate">
                      {a.reason || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setSelectedAmendment(a);
                            setShowMarkdownModal(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                          title="Náhled markdownu"
                        >
                          <span className="material-symbols-outlined text-lg">
                            visibility
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAmendment(a);
                            setShowDeleteModal(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-50 dark:text-slate-300 dark:hover:bg-red-900/20"
                        >
                          <span className="material-symbols-outlined text-lg">
                            delete
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setOcrSeedRawText(null);
          setOcrSeedFileName(null);
          setOcrSeedProvider(null);
          setOcrSeedModel(null);
        }}
        title="Nový dodatek"
        size="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Datum podpisu</label>
              <input
                type="date"
                value={formData.signedAt}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, signedAt: e.target.value }))
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Platnost od</label>
              <input
                type="date"
                value={formData.effectiveFrom}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, effectiveFrom: e.target.value }))
                }
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Změna ceny</label>
              <input
                type="text"
                value={formData.deltaPrice}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, deltaPrice: e.target.value }))
                }
                className={inputCls}
                placeholder="+50000"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Nový termín</label>
              <input
                type="date"
                value={formData.deltaDeadline}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, deltaDeadline: e.target.value }))
                }
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Důvod</label>
            <textarea
              value={formData.reason}
              onChange={(e) =>
                setFormData((p) => ({ ...p, reason: e.target.value }))
              }
              className={`${inputCls} resize-none`}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                setOcrSeedRawText(null);
                setOcrSeedFileName(null);
                setOcrSeedProvider(null);
                setOcrSeedModel(null);
              }}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            >
              Zrušit
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
            >
              Přidat
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Smazat dodatek"
        size="sm"
      >
        <p className="text-slate-600 mb-4">
          Smazat Dodatek č. {selectedAmendment?.amendmentNo}?
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowDeleteModal(false)}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
          >
            Zrušit
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {deleting ? "Mažu..." : "Smazat"}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showMarkdownModal}
        onClose={() => {
          setShowMarkdownModal(false);
          setSelectedAmendment(null);
        }}
        title="Náhled markdownu dodatku"
        size="xl"
      >
        {selectedAmendment && (
          <MarkdownDocumentPanel
            entityType="amendment"
            entityId={selectedAmendment.id}
            entityLabel={`Dodatek_${selectedAmendment.amendmentNo}`}
            editable={false}
          />
        )}
      </Modal>
    </div>
  );
};
