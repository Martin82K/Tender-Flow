import React, { useState } from "react";
import { ContractWithDetails, ContractDrawdown } from "../../../types";
import { contractService } from "../../../services/contractService";
import { contractExtractionService } from "../../../services/contractExtractionService";
import { Modal } from "@/shared/ui/Modal";

interface DrawdownsListProps {
  contracts: ContractWithDetails[];
  selectedContractId: string | null;
  onSelectContract: (id: string) => void;
  onDrawdownCreated: () => void;
  onDrawdownUpdated: () => void;
  onDrawdownDeleted: () => void;
}

const formatMoney = (v: number): string =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
  }).format(v);
const formatPeriod = (p: string): string => {
  const [y, m] = p.split("-");
  return `${m}/${y}`;
};
const getCurrentPeriod = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const DrawdownsList: React.FC<DrawdownsListProps> = ({
  contracts,
  selectedContractId,
  onSelectContract,
  onDrawdownCreated,
  onDrawdownUpdated,
  onDrawdownDeleted,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDrawdown, setSelectedDrawdown] =
    useState<ContractDrawdown | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    period: getCurrentPeriod(),
    claimedAmount: "",
    approvedAmount: "",
    note: "",
  });

  const selectedContract = contracts.find((c) => c.id === selectedContractId);
  const drawdowns = selectedContract?.drawdowns || [];
  const totalApproved = drawdowns.reduce((s, d) => s + d.approvedAmount, 0);
  const remaining = selectedContract
    ? selectedContract.currentTotal - totalApproved
    : 0;

  const resetForm = () =>
    setFormData({
      period: getCurrentPeriod(),
      claimedAmount: "",
      approvedAmount: "",
      note: "",
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContractId) return;
    try {
      setSubmitting(true);
      if (selectedDrawdown) {
        await contractService.updateDrawdown(selectedDrawdown.id, {
          claimedAmount: parseFloat(formData.claimedAmount) || 0,
          approvedAmount: parseFloat(formData.approvedAmount) || 0,
          note: formData.note || undefined,
        });
        onDrawdownUpdated();
      } else {
        await contractService.createDrawdown({
          contractId: selectedContractId,
          period: formData.period,
          claimedAmount: parseFloat(formData.claimedAmount) || 0,
          approvedAmount: parseFloat(formData.approvedAmount) || 0,
          note: formData.note || undefined,
        });
        onDrawdownCreated();
      }
      setShowModal(false);
      resetForm();
      setSelectedDrawdown(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDrawdown) return;
    try {
      setSubmitting(true);
      await contractService.deleteDrawdown(selectedDrawdown.id);
      setShowDeleteModal(false);
      setSelectedDrawdown(null);
      onDrawdownDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (d: ContractDrawdown) => {
    setSelectedDrawdown(d);
    setFormData({
      period: d.period,
      claimedAmount: d.claimedAmount.toString(),
      approvedAmount: d.approvedAmount.toString(),
      note: d.note || "",
    });
    setShowModal(true);
  };

  const handlePdfUpload = async (file: File) => {
    try {
      setExtracting(true);
      const result =
        await contractExtractionService.extractDrawdownFromDocument(file);
      setFormData({
        period: result.fields.period?.toString() || getCurrentPeriod(),
        claimedAmount: result.fields.claimedAmount?.toString() || "",
        approvedAmount: result.fields.approvedAmount?.toString() || "",
        note: result.fields.note?.toString() || "",
      });
      setShowModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setExtracting(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm";

  return (
    <div className="space-y-4">
      {/* Header */}
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
                {c.contractNumber ? `[${c.contractNumber}] ` : ""}
                {c.title} | {c.vendorName}
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
              onClick={() => {
                resetForm();
                setSelectedDrawdown(null);
                setShowModal(true);
              }}
              className="px-3 py-2 bg-primary text-white rounded-lg text-sm flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-lg">add</span>{" "}
              Nová průvodka
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Summary */}
      {selectedContract && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border">
            <p className="text-xs text-slate-500 uppercase font-semibold">
              Hodnota smlouvy
            </p>
            <p className="text-xl font-bold">
              {formatMoney(selectedContract.currentTotal)}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border">
            <p className="text-xs text-slate-500 uppercase font-semibold">
              Vyčerpáno
            </p>
            <p className="text-xl font-bold text-emerald-600">
              {formatMoney(totalApproved)}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border">
            <p className="text-xs text-slate-500 uppercase font-semibold">
              Zbývá
            </p>
            <p className="text-xl font-bold text-amber-600">
              {formatMoney(remaining)}
            </p>
          </div>
        </div>
      )}

      {/* List */}
      {!selectedContractId || drawdowns.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border">
          <span className="material-symbols-outlined text-5xl text-slate-300">
            account_balance
          </span>
          <p className="text-slate-500 mt-4">
            {!selectedContractId ? "Vyberte smlouvu" : "Žádné průvodky"}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-slate-50 dark:bg-slate-900/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">
                  Období
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">
                  Požadováno
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">
                  Schváleno
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">
                  Poznámka
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {drawdowns
                .sort((a, b) => b.period.localeCompare(a.period))
                .map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium">
                      {formatPeriod(d.period)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatMoney(d.claimedAmount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-600">
                      {formatMoney(d.approvedAmount)}
                    </td>
                    <td className="px-4 py-3 text-sm truncate max-w-[200px]">
                      {d.note || "-"}
                    </td>
                    <td className="px-4 py-3 flex gap-1">
                      <button
                        onClick={() => handleEdit(d)}
                        className="p-1 rounded hover:bg-slate-100"
                      >
                        <span className="material-symbols-outlined text-slate-500">
                          edit
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedDrawdown(d);
                          setShowDeleteModal(true);
                        }}
                        className="p-1 rounded hover:bg-red-50"
                      >
                        <span className="material-symbols-outlined text-slate-500 hover:text-red-500">
                          delete
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedDrawdown(null);
        }}
        title={selectedDrawdown ? "Upravit průvodku" : "Nová průvodka"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Období (YYYY-MM)</label>
            <input
              type="month"
              value={formData.period}
              onChange={(e) =>
                setFormData((p) => ({ ...p, period: e.target.value }))
              }
              className={inputCls}
              disabled={!!selectedDrawdown}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Požadovaná částka</label>
              <input
                type="text"
                value={formData.claimedAmount}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, claimedAmount: e.target.value }))
                }
                className={inputCls}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Schválená částka</label>
              <input
                type="text"
                value={formData.approvedAmount}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, approvedAmount: e.target.value }))
                }
                className={inputCls}
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Poznámka</label>
            <textarea
              value={formData.note}
              onChange={(e) =>
                setFormData((p) => ({ ...p, note: e.target.value }))
              }
              className={`${inputCls} resize-none`}
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-sm"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-50"
            >
              {submitting ? "Ukládám..." : "Uložit"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Smazat průvodku"
        size="sm"
      >
        <p className="text-slate-600 mb-4">
          Smazat průvodku za období {selectedDrawdown?.period}?
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
            disabled={submitting}
            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {submitting ? "Mažu..." : "Smazat"}
          </button>
        </div>
      </Modal>
    </div>
  );
};
