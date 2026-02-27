import React, { useEffect, useState } from "react";
import type {
  Contract,
  ContractExtractionResult,
  ContractStatus,
  ContractWithDetails,
} from "../../../types";
import { contractService } from "../../../services/contractService";
import { ContractForm } from "./ContractForm";
import { ExtractionValidation } from "./ExtractionValidation";
import { contractExtractionService } from "../../../services/contractExtractionService";
import { Modal } from "@/shared/ui/Modal";
import { StarRating } from "@/shared/ui/StarRating";
import { MarkdownDocumentPanel } from "@/shared/contracts/MarkdownDocumentPanel";

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
  const [extractionMode, setExtractionMode] = useState<"create" | "edit">(
    "create",
  );
  const [markdownPanelRefreshKey, setMarkdownPanelRefreshKey] = useState(0);
  const [selectedContract, setSelectedContract] =
    useState<ContractWithDetails | null>(null);
  const [extractedData, setExtractedData] =
    useState<ContractExtractionResult | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    contract: ContractWithDetails;
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;

    const handlePointerDown = () => {
      setContextMenu(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [contextMenu]);

  const handleContextMenu = (
    event: React.MouseEvent,
    contract: ContractWithDetails,
  ) => {
    event.preventDefault();
    onSelectContract(contract.id);

    const menuWidth = 240;
    const menuHeight = 160;
    const viewportPadding = 8;

    const left = Math.min(
      event.clientX,
      window.innerWidth - menuWidth - viewportPadding,
    );
    const top = Math.min(
      event.clientY,
      window.innerHeight - menuHeight - viewportPadding,
    );

    setContextMenu({
      contract,
      top: Math.max(viewportPadding, top),
      left: Math.max(viewportPadding, left),
    });
  };

  const handleSiteHandover = (_contract: ContractWithDetails) => {
    // TODO: Doplníme logiku po dodání podkladů šablon.
  };

  const handleSubcontractDeliveryNote = (_contract: ContractWithDetails) => {
    // TODO: Doplníme logiku po dodání podkladů šablon.
  };

  const handleSubWorkHandover = (_contract: ContractWithDetails) => {
    // TODO: Doplníme logiku po dodání podkladů šablon.
  };

  const handleCreateContract = async (
    data: Omit<Contract, "id" | "createdAt" | "updatedAt">,
    markdownSeed?: {
      contentMd?: string;
      sourceFileName?: string;
      sourceDocumentUrl?: string;
      ocrProvider?: string;
      ocrModel?: string;
      metadata?: Record<string, unknown>;
    },
  ) => {
    try {
      const created = await contractService.createContract(data);
      if (markdownSeed?.contentMd?.trim()) {
        await contractService.createMarkdownVersion({
          entityType: "contract",
          contractId: created.id,
          sourceKind: "ocr",
          contentMd: markdownSeed.contentMd,
          sourceFileName: markdownSeed.sourceFileName,
          sourceDocumentUrl: markdownSeed.sourceDocumentUrl,
          ocrProvider: markdownSeed.ocrProvider,
          ocrModel: markdownSeed.ocrModel,
          metadata: markdownSeed.metadata,
        });
      }
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

  const handleFileUpload = async (
    file: File,
    mode: "create" | "edit" = "create",
  ) => {
    try {
      setExtractionMode(mode);
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

  const handleExtractionConfirm = async (data: Partial<Contract>) => {
    if (extractionMode === "edit" && selectedContract) {
      try {
        if (!extractedData?.rawText?.trim()) {
          setError("OCR text není k dispozici pro uložení markdown verze");
          return;
        }

        await contractService.createMarkdownVersion({
          entityType: "contract",
          contractId: selectedContract.id,
          sourceKind: "ocr",
          contentMd: extractedData.rawText,
          sourceFileName: extractedData.sourceFileName,
          ocrProvider: extractedData.ocrProvider,
          ocrModel: extractedData.ocrModel,
          metadata: {
            confidence: extractedData.confidence || {},
          },
        });
        setMarkdownPanelRefreshKey((prev) => prev + 1);

        setShowExtractionModal(false);
        setExtractedData(null);
        setExtractionMode("create");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Nepodařilo se doplnit OCR data do smlouvy",
        );
      }
      return;
    }

    handleCreateContract(
      {
        projectId,
        vendorName: data.vendorName || "Neznámý dodavatel",
        title: data.title || "Nová smlouva",
        status: "draft",
        currency: data.currency || "CZK",
        basePrice: data.basePrice || 0,
        source: "ai_extracted",
        ...data,
      },
      {
        contentMd: extractedData?.rawText,
        sourceFileName: extractedData?.sourceFileName,
        ocrProvider: extractedData?.ocrProvider,
        ocrModel: extractedData?.ocrModel,
        metadata: {
          confidence: extractedData?.confidence || {},
        },
      },
    );
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
                if (file) handleFileUpload(file, "create");
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Hodnocení
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
                    onContextMenu={(event) => handleContextMenu(event, contract)}
                  >
                    <td className="px-4 py-3 align-top">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white whitespace-normal break-words max-w-[300px]">
                          {contract.title}
                        </p>
                        {contract.contractNumber && (
                          <p className="text-xs text-slate-500">
                            č. {contract.contractNumber}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-normal break-words max-w-[240px]">
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
                    <td className="px-4 py-3">
                      {contract.vendorRating === null || contract.vendorRating === undefined ? (
                        <span className="text-xs text-slate-400">Neohodnoceno</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <StarRating value={contract.vendorRating} readOnly size="sm" />
                          <span className="text-xs text-slate-500">
                            {contract.vendorRating.toFixed(1)}
                          </span>
                        </div>
                      )}
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

      {contextMenu && (
        <div
          className="fixed z-50 min-w-[240px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800"
          style={{ top: contextMenu.top, left: contextMenu.left }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="border-b border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {contextMenu.contract.title}
          </div>
          <button
            onClick={() => {
              handleSiteHandover(contextMenu.contract);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Předání staveniště
          </button>
          <button
            onClick={() => {
              handleSubcontractDeliveryNote(contextMenu.contract);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Průvodka subdodávky
          </button>
          <button
            onClick={() => {
              handleSubWorkHandover(contextMenu.contract);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Předání díla SUB
          </button>
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
          setExtractionMode("create");
        }}
        title="Upravit smlouvu"
        size="2xl"
      >
        {selectedContract && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 items-stretch lg:h-[72vh] lg:min-h-[620px]">
            <div className="min-w-0 min-h-0 lg:h-full lg:overflow-y-auto lg:pr-1">
              <ContractForm
                key={selectedContract.id}
                projectId={projectId}
                initialData={selectedContract}
                onSubmit={handleUpdateContract}
                onCancel={() => {
                  setShowEditModal(false);
                  setSelectedContract(null);
                  setExtractionMode("create");
                }}
              />
            </div>
            <div className="min-w-0 min-h-0 space-y-3 flex flex-col lg:h-full">
              <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">
                <input
                  type="file"
                  accept=".pdf,.docx,.doc"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, "edit");
                    e.target.value = "";
                  }}
                  disabled={extracting}
                />
                {extracting ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></span>
                    Analyzuji OCR...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">
                      upload_file
                    </span>
                    Doplnit OCR dokument
                  </>
                )}
              </label>

              <div className="min-h-0 flex-1">
                <MarkdownDocumentPanel
                  key={`${selectedContract.id}-${markdownPanelRefreshKey}`}
                  entityType="contract"
                  entityId={selectedContract.id}
                  entityLabel={selectedContract.title}
                  editable={true}
                  fitParent={true}
                  enableSearch={true}
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Extraction Validation Modal */}
      <Modal
        isOpen={showExtractionModal}
        onClose={() => {
          setShowExtractionModal(false);
          setExtractedData(null);
          setExtractionMode("create");
        }}
        title="Ověření extrahovaných dat"
        size="2xl"
        persistent={true}
      >
        {extractedData && (
          <ExtractionValidation
            extractedFields={extractedData.fields}
            confidence={extractedData.confidence}
            rawText={extractedData.rawText}
            onConfirm={handleExtractionConfirm}
            onCancel={() => {
              setShowExtractionModal(false);
              setExtractedData(null);
              setExtractionMode("create");
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
