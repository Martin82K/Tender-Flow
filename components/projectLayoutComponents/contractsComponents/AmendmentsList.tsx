import React, { useState } from "react";
import { ContractWithDetails, ContractAmendment } from "../../../types";
import { contractService } from "../../../services/contractService";
import { contractExtractionService } from "../../../services/contractExtractionService";
import { Modal } from "../../ui/Modal";

interface AmendmentsListProps {
  contracts: ContractWithDetails[];
  selectedContractId: string | null;
  onSelectContract: (id: string) => void;
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

export const AmendmentsList: React.FC<AmendmentsListProps> = ({
  contracts,
  selectedContractId,
  onSelectContract,
  onAmendmentCreated,
  onAmendmentDeleted,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAmendment, setSelectedAmendment] =
    useState<ContractAmendment | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    signedAt: "",
    effectiveFrom: "",
    deltaPrice: "",
    deltaDeadline: "",
    reason: "",
  });

  const selectedContract = contracts.find((c) => c.id === selectedContractId);
  const amendments = selectedContract?.amendments || [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContractId) return;
    try {
      await contractService.createAmendment({
        contractId: selectedContractId,
        signedAt: formData.signedAt || undefined,
        effectiveFrom: formData.effectiveFrom || undefined,
        deltaPrice: parseFloat(formData.deltaPrice) || 0,
        deltaDeadline: formData.deltaDeadline || undefined,
        reason: formData.reason || undefined,
      });
      setShowCreateModal(false);
      setFormData({
        signedAt: "",
        effectiveFrom: "",
        deltaPrice: "",
        deltaDeadline: "",
        reason: "",
      });
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
        await contractExtractionService.extractAmendmentFromPdf(file);
      setFormData({
        signedAt: result.fields.signedAt?.toString() || "",
        effectiveFrom: result.fields.effectiveFrom?.toString() || "",
        deltaPrice: result.fields.deltaPrice?.toString() || "",
        deltaDeadline: result.fields.deltaDeadline?.toString() || "",
        reason: result.fields.reason?.toString() || "",
      });
      setShowCreateModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba extrakce");
    } finally {
      setExtracting(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Smlouva:</label>
          <select
            value={selectedContractId || ""}
            onChange={(e) => onSelectContract(e.target.value)}
            className={inputCls}
          >
            <option value="">Vyberte...</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        {selectedContractId && (
          <div className="flex gap-2">
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
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border hover:bg-slate-50">
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
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-2 bg-primary text-white rounded-lg text-sm"
            >
              <span className="material-symbols-outlined text-lg">add</span>{" "}
              Nový
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {!selectedContractId || amendments.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border">
          <span className="material-symbols-outlined text-5xl text-slate-300">
            post_add
          </span>
          <p className="text-slate-500 mt-4">
            {!selectedContractId ? "Vyberte smlouvu" : "Žádné dodatky"}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-slate-50 dark:bg-slate-900/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">
                  Č.
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">
                  Datum
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">
                  Změna
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">
                  Důvod
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {amendments.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium">
                    Dodatek č. {a.amendmentNo}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {formatDate(a.signedAt)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right text-sm font-semibold ${a.deltaPrice > 0 ? "text-red-500" : a.deltaPrice < 0 ? "text-emerald-500" : ""}`}
                  >
                    {a.deltaPrice > 0 ? "+" : ""}
                    {formatMoney(a.deltaPrice)}
                  </td>
                  <td className="px-4 py-3 text-sm truncate max-w-[200px]">
                    {a.reason || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        setSelectedAmendment(a);
                        setShowDeleteModal(true);
                      }}
                      className="p-1 rounded hover:bg-red-50 text-slate-500 hover:text-red-500"
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
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
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-sm"
            >
              Zrušit
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm"
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
            className="px-4 py-2 text-sm"
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
    </div>
  );
};
