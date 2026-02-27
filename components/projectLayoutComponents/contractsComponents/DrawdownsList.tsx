import React, { useState } from "react";
import { ContractWithDetails, ContractDrawdown } from "../../../types";
import { contractService } from "../../../services/contractService";
import { contractExtractionService } from "../../../services/contractExtractionService";
import { Modal } from "@/shared/ui/Modal";

interface DrawdownsListProps {
  contracts: ContractWithDetails[];
  selectedContractId: string | null;
  onSelectContract: (id: string | null) => void;
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
const parseAmountInput = (value: string): number => {
  const normalized = value
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};
const formatAmountInput = (value: number): string =>
  new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(value)));
const toAmountInput = (value: number): string =>
  formatAmountInput(value);
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
  const [percentageValue, setPercentageValue] = useState("");

  const selectedContract = contracts.find(
    (c) => c.id === (selectedContractId || ""),
  );
  const sortedContracts = [...contracts].sort(sortContractsByVendor);
  const drawdowns = selectedContract?.drawdowns || [];
  const totalApproved = drawdowns.reduce((s, d) => s + d.approvedAmount, 0);
  const approvedWithoutSelected = Math.max(
    0,
    totalApproved - (selectedDrawdown?.approvedAmount || 0),
  );
  const formRemaining = selectedContract
    ? Math.max(0, selectedContract.currentTotal - approvedWithoutSelected)
    : 0;
  const remaining = selectedContract
    ? selectedContract.currentTotal - totalApproved
    : 0;
  const utilizationPercent =
    selectedContract && selectedContract.currentTotal > 0
      ? Math.min(100, Math.max(0, (totalApproved / selectedContract.currentTotal) * 100))
      : 0;

  const resetForm = () => {
    setFormData({
      period: getCurrentPeriod(),
      claimedAmount: "",
      approvedAmount: "",
      note: "",
    });
    setPercentageValue("");
  };

  const setAmountField = (
    field: "claimedAmount" | "approvedAmount",
    value: number,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: toAmountInput(value),
    }));
  };

  const fillRemaining = (field?: "claimedAmount" | "approvedAmount") => {
    if (!selectedContract) return;
    if (field) {
      setAmountField(field, formRemaining);
      return;
    }

    const value = toAmountInput(formRemaining);
    setFormData((prev) => ({
      ...prev,
      claimedAmount: value,
      approvedAmount: value,
    }));
  };

  const applyPercentageToField = (field: "claimedAmount" | "approvedAmount") => {
    if (!selectedContract) return;
    const percent = parseAmountInput(percentageValue);
    if (percent <= 0) return;
    const amount = (selectedContract.currentTotal * percent) / 100;
    setAmountField(field, amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContractId) return;
    const claimedAmount = Math.max(0, parseAmountInput(formData.claimedAmount));
    const approvedAmount = Math.max(
      0,
      parseAmountInput(formData.approvedAmount),
    );

    try {
      setSubmitting(true);
      if (selectedDrawdown) {
        await contractService.updateDrawdown(selectedDrawdown.id, {
          period: formData.period,
          claimedAmount,
          approvedAmount,
          note: formData.note || undefined,
        });
        onDrawdownUpdated();
      } else {
        await contractService.createDrawdown({
          contractId: selectedContractId,
          period: formData.period,
          claimedAmount,
          approvedAmount,
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
    setPercentageValue("");
    setFormData({
      period: d.period,
      claimedAmount: toAmountInput(d.claimedAmount),
      approvedAmount: toAmountInput(d.approvedAmount),
      note: d.note || "",
    });
    setShowModal(true);
  };

  const handlePdfUpload = async (file: File) => {
    try {
      setExtracting(true);
      const result =
        await contractExtractionService.extractDrawdownFromDocument(file);
      setSelectedDrawdown(null);
      setFormData({
        period: result.fields.period?.toString() || getCurrentPeriod(),
        claimedAmount:
          result.fields.claimedAmount !== undefined &&
          result.fields.claimedAmount !== null
            ? toAmountInput(parseAmountInput(result.fields.claimedAmount.toString()))
            : "",
        approvedAmount:
          result.fields.approvedAmount !== undefined &&
          result.fields.approvedAmount !== null
            ? toAmountInput(parseAmountInput(result.fields.approvedAmount.toString()))
            : "",
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
    "w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm";
  const helperButtonCls =
    "text-xs px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 hover:text-slate-900 dark:hover:text-white transition-colors";
  const panelCls =
    "rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800";
  const ghostActionCls =
    "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors";
  const primaryActionCls =
    "inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors whitespace-nowrap";

  return (
    <div className="space-y-4">
      {/* Header */}
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
                resetForm();
                setSelectedDrawdown(null);
                setShowModal(true);
              }}
              className={primaryActionCls}
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Nová průvodka
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

      {/* Summary */}
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
              Hodnota smlouvy:{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {formatMoney(selectedContract.currentTotal)}
              </span>
            </p>
            <p className="text-slate-500">
              Vyčerpáno:{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {formatMoney(totalApproved)}
              </span>
            </p>
            <p className="text-slate-500">
              Zbývá:{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {formatMoney(remaining)}
              </span>
            </p>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
              <span>Průběh čerpání</span>
              <span>{utilizationPercent.toFixed(1)} %</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all"
                style={{ width: `${utilizationPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {!selectedContractId || drawdowns.length === 0 ? (
        <div className={`${panelCls} text-center py-10`}>
          <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600">
            account_balance
          </span>
          <p className="text-slate-500 dark:text-slate-400 mt-4">
            {!selectedContractId ? "Vyberte smlouvu" : "Žádné průvodky"}
          </p>
        </div>
      ) : (
        <div className={`${panelCls} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Období
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Požadováno
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Schváleno
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Poznámka
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {[...drawdowns]
                  .sort((a, b) => b.period.localeCompare(a.period))
                  .map((d) => (
                    <tr
                      key={d.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                        {formatPeriod(d.period)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-slate-600 dark:text-slate-300">
                        {formatMoney(d.claimedAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-600">
                        {formatMoney(d.approvedAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 max-w-[320px] truncate">
                        {d.note || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(d)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            <span className="material-symbols-outlined text-lg">
                              edit
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDrawdown(d);
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
                onBlur={() =>
                  setFormData((p) => ({
                    ...p,
                    claimedAmount: p.claimedAmount.trim()
                      ? toAmountInput(parseAmountInput(p.claimedAmount))
                      : "",
                  }))
                }
                className={inputCls}
                placeholder="0"
              />
              <button
                type="button"
                onClick={() => fillRemaining("claimedAmount")}
                className={`mt-2 ${helperButtonCls}`}
              >
                Dočerpat
              </button>
            </div>
            <div>
              <label className="block text-sm mb-1">Schválená částka</label>
              <input
                type="text"
                value={formData.approvedAmount}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, approvedAmount: e.target.value }))
                }
                onBlur={() =>
                  setFormData((p) => ({
                    ...p,
                    approvedAmount: p.approvedAmount.trim()
                      ? toAmountInput(parseAmountInput(p.approvedAmount))
                      : "",
                  }))
                }
                className={inputCls}
                placeholder="0"
              />
              <button
                type="button"
                onClick={() => fillRemaining("approvedAmount")}
                className={`mt-2 ${helperButtonCls}`}
              >
                Dočerpat
              </button>
            </div>
          </div>
          {selectedContract && (
            <div className="space-y-2 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-xs text-slate-500">
                Hodnota smlouvy:{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {formatMoney(selectedContract.currentTotal)}
                </span>{" "}
                • Zbývá dočerpat:{" "}
                <span className="font-semibold text-amber-600">
                  {formatMoney(formRemaining)}
                </span>
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fillRemaining()}
                  className={`${helperButtonCls} font-medium`}
                >
                  Dočerpat obě částky
                </button>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-2 items-center">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={percentageValue}
                  onChange={(e) => setPercentageValue(e.target.value)}
                  className={inputCls}
                  placeholder="%"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      applyPercentageToField("claimedAmount");
                      applyPercentageToField("approvedAmount");
                    }}
                    className={helperButtonCls}
                  >
                    % do obou
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPercentageToField("claimedAmount")}
                    className={helperButtonCls}
                  >
                    % do požadované
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPercentageToField("approvedAmount")}
                    className={helperButtonCls}
                  >
                    % do schválené
                  </button>
                </div>
              </div>
            </div>
          )}
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
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setShowModal(false)}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
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
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
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
