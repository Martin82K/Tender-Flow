import React, { useState } from "react";
import { ContractWithDetails, Contract, ContractStatus } from "../../../types";
import { contractService } from "../../../services/contractService";
import { ContractForm } from "./ContractForm";
import { ExtractionValidation } from "./ExtractionValidation";
import { contractExtractionService } from "../../../services/contractExtractionService";
import { Modal } from "../../ui/Modal";

interface ContractsListProps {
  projectId: string;
  contracts: ContractWithDetails[];
  onContractCreated: () => void;
  onContractUpdated: () => void;
  onContractDeleted: () => void;
  onSelectContract: (id: string) => void;
}

const formatMoney = (value: number): string => {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (date?: string): string => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("cs-CZ");
};

const statusLabels: Record<ContractStatus, string> = {
  draft: "Rozpracováno",
  active: "Aktivní",
  closed: "Uzavřeno",
  cancelled: "Zrušeno",
};

const statusColors: Record<ContractStatus, string> = {
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  active:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  closed: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export const ContractsList: React.FC<ContractsListProps> = ({
  projectId,
  contracts,
  onContractCreated,
  onContractUpdated,
  onContractDeleted,
  onSelectContract,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExtractionModal, setShowExtractionModal] = useState(false);
  const [selectedContract, setSelectedContract] =
    useState<ContractWithDetails | null>(null);
  const [extractedData, setExtractedData] = useState<{
    fields: Partial<Contract>;
    confidence: Record<string, number>;
  } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateContract = async (
    data: Omit<Contract, "id" | "createdAt" | "updatedAt">,
  ) => {
    try {
      await contractService.createContract(data);
      setShowCreateModal(false);
      setShowExtractionModal(false);
      setExtractedData(null);
      onContractCreated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Nepodařilo se vytvořit smlouvu",
      );
    }
  };

  const handleUpdateContract = async (data: Partial<Contract>) => {
    if (!selectedContract) return;
    try {
      await contractService.updateContract(selectedContract.id, data);
      setShowEditModal(false);
      setSelectedContract(null);
      onContractUpdated();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nepodařilo se aktualizovat smlouvu",
      );
    }
  };

  const handleDeleteContract = async () => {
    if (!selectedContract) return;
    try {
      setDeleting(true);
      await contractService.deleteContract(selectedContract.id);
      setShowDeleteModal(false);
      setSelectedContract(null);
      onContractDeleted();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Nepodařilo se smazat smlouvu",
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setExtracting(true);
      setError(null);
      const result = await contractExtractionService.extractFromDocument(file);
      setExtractedData(result);
      setShowExtractionModal(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nepodařilo se extrahovat data ze souboru",
      );
    } finally {
      setExtracting(false);
    }
  };

  const handleExtractionConfirm = (data: Partial<Contract>) => {
    handleCreateContract({
      projectId,
      vendorName: data.vendorName || "Neznámý dodavatel",
      title: data.title || "Nová smlouva",
      status: "draft",
      currency: data.currency || "CZK",
      basePrice: data.basePrice || 0,
      source: "ai_extracted",
      ...data,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Smlouvy ({contracts.length})
        </h2>
        <div className="flex items-center gap-2">
          {/* Upload Document Button */}
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".pdf,.docx,.doc"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                e.target.value = "";
              }}
              disabled={extracting}
            />
            <span
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 ${
                extracting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {extracting ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></span>
                  Analyzuji...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">
                    upload_file
                  </span>
                  Nahrát soubor
                </>
              )}
            </span>
          </label>

          {/* Create Manual Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Nová smlouva
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm flex items-start gap-2">
          <span className="material-symbols-outlined text-lg">error</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

      {/* Contracts Table */}
      {contracts.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 mb-4">
            description
          </span>
          <p className="text-slate-500 dark:text-slate-400">
            Zatím žádné smlouvy. Vytvořte první smlouvu nebo nahrajte PDF.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Název
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Dodavatel
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Stav
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Hodnota
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Čerpáno
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Datum
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {contracts.map((contract) => (
                  <tr
                    key={contract.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                    onClick={() => onSelectContract(contract.id)}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {contract.title}
                        </p>
                        {contract.contractNumber && (
                          <p className="text-xs text-slate-500">
                            č. {contract.contractNumber}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {contract.vendorName}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium ${statusColors[contract.status]}`}
                      >
                        {statusLabels[contract.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {formatMoney(contract.currentTotal)}
                      </p>
                      {contract.amendments.length > 0 && (
                        <p className="text-xs text-slate-500">
                          +{contract.amendments.length} dodatků
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {formatMoney(contract.approvedSum)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {contract.currentTotal > 0
                          ? `${((contract.approvedSum / contract.currentTotal) * 100).toFixed(0)}%`
                          : "0%"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {formatDate(contract.signedAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setSelectedContract(contract);
                            setShowEditModal(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700"
                          title="Upravit"
                        >
                          <span className="material-symbols-outlined text-lg">
                            edit
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedContract(contract);
                            setShowDeleteModal(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Smazat"
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

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nová smlouva"
        size="lg"
      >
        <ContractForm
          projectId={projectId}
          onSubmit={handleCreateContract}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedContract(null);
        }}
        title="Upravit smlouvu"
        size="lg"
      >
        {selectedContract && (
          <ContractForm
            projectId={projectId}
            initialData={selectedContract}
            onSubmit={handleUpdateContract}
            onCancel={() => {
              setShowEditModal(false);
              setSelectedContract(null);
            }}
          />
        )}
      </Modal>

      {/* Extraction Validation Modal */}
      <Modal
        isOpen={showExtractionModal}
        onClose={() => {
          setShowExtractionModal(false);
          setExtractedData(null);
        }}
        title="Ověření extrahovaných dat"
        size="lg"
      >
        {extractedData && (
          <ExtractionValidation
            extractedFields={extractedData.fields}
            confidence={extractedData.confidence}
            onConfirm={handleExtractionConfirm}
            onCancel={() => {
              setShowExtractionModal(false);
              setExtractedData(null);
            }}
          />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedContract(null);
        }}
        title="Smazat smlouvu"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-slate-600 dark:text-slate-400">
            Opravdu chcete smazat smlouvu{" "}
            <strong>"{selectedContract?.title}"</strong>? Tato akce je nevratná
            a smaže i všechny dodatky a průvodky.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedContract(null);
              }}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            >
              Zrušit
            </button>
            <button
              onClick={handleDeleteContract}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50"
            >
              {deleting ? "Mažu..." : "Smazat"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
