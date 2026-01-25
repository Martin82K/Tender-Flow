import React, { useState } from "react";
import {
  Contract,
  ContractStatus,
  ContractSource,
  Subcontractor,
} from "../../../types";

interface ContractFormProps {
  projectId: string;
  initialData?: Partial<Contract>;
  onSubmit: (
    data: Omit<Contract, "id" | "createdAt" | "updatedAt"> | Partial<Contract>,
  ) => void;
  onCancel: () => void;
  vendors?: Subcontractor[];
}

const statusOptions: { value: ContractStatus; label: string }[] = [
  { value: "draft", label: "Rozpracováno" },
  { value: "active", label: "Aktivní" },
  { value: "closed", label: "Uzavřeno" },
  { value: "cancelled", label: "Zrušeno" },
];

const sourceOptions: { value: ContractSource; label: string }[] = [
  { value: "manual", label: "Ruční zadání" },
  { value: "from_tender_winner", label: "Z vítěze VŘ" },
  { value: "ai_extracted", label: "AI extrakce" },
];

export const ContractForm: React.FC<ContractFormProps> = ({
  projectId,
  initialData,
  onSubmit,
  onCancel,
  vendors = [],
}) => {
  const isEditing = !!initialData?.id;

  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    contractNumber: initialData?.contractNumber || "",
    vendorId: initialData?.vendorId || "",
    vendorName: initialData?.vendorName || "",
    status: initialData?.status || ("draft" as ContractStatus),
    source: initialData?.source || ("manual" as ContractSource),
    signedAt: initialData?.signedAt?.split("T")[0] || "",
    effectiveFrom: initialData?.effectiveFrom?.split("T")[0] || "",
    effectiveTo: initialData?.effectiveTo?.split("T")[0] || "",
    currency: initialData?.currency || "CZK",
    basePrice: initialData?.basePrice?.toString() || "",
    retentionPercent: initialData?.retentionPercent?.toString() || "",
    retentionAmount: initialData?.retentionAmount?.toString() || "",
    warrantyMonths: initialData?.warrantyMonths?.toString() || "",
    paymentTerms: initialData?.paymentTerms || "",
    scopeSummary: initialData?.scopeSummary || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleVendorSelect = (vendorId: string) => {
    const vendor = vendors.find((v) => v.id === vendorId);
    setFormData((prev) => ({
      ...prev,
      vendorId,
      vendorName: vendor?.company || "",
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Název je povinný";
    }

    if (!formData.vendorName.trim()) {
      newErrors.vendorName = "Dodavatel je povinný";
    }

    if (formData.basePrice && isNaN(parseFloat(formData.basePrice))) {
      newErrors.basePrice = "Neplatná částka";
    }

    if (
      formData.retentionPercent &&
      (isNaN(parseFloat(formData.retentionPercent)) ||
        parseFloat(formData.retentionPercent) > 100)
    ) {
      newErrors.retentionPercent = "Neplatné procento (0-100)";
    }

    if (formData.warrantyMonths && isNaN(parseInt(formData.warrantyMonths))) {
      newErrors.warrantyMonths = "Neplatný počet měsíců";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setSubmitting(true);
    try {
      const data: Omit<Contract, "id" | "createdAt" | "updatedAt"> = {
        projectId,
        vendorId: formData.vendorId || undefined,
        vendorName: formData.vendorName,
        title: formData.title,
        contractNumber: formData.contractNumber || undefined,
        status: formData.status,
        source: formData.source,
        signedAt: formData.signedAt || undefined,
        effectiveFrom: formData.effectiveFrom || undefined,
        effectiveTo: formData.effectiveTo || undefined,
        currency: formData.currency,
        basePrice: parseFloat(formData.basePrice) || 0,
        retentionPercent: formData.retentionPercent
          ? parseFloat(formData.retentionPercent)
          : undefined,
        retentionAmount: formData.retentionAmount
          ? parseFloat(formData.retentionAmount)
          : undefined,
        warrantyMonths: formData.warrantyMonths
          ? parseInt(formData.warrantyMonths)
          : undefined,
        paymentTerms: formData.paymentTerms || undefined,
        scopeSummary: formData.scopeSummary || undefined,
      };

      onSubmit(data);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClasses =
    "w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm";
  const labelClasses =
    "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";
  const errorClasses = "text-xs text-red-500 mt-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Basic Info */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
          Základní údaje
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>Název smlouvy *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              className={inputClasses}
              placeholder="Smlouva o dílo - Stavební práce"
            />
            {errors.title && <p className={errorClasses}>{errors.title}</p>}
          </div>

          <div>
            <label className={labelClasses}>Číslo smlouvy</label>
            <input
              type="text"
              value={formData.contractNumber}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  contractNumber: e.target.value,
                }))
              }
              className={inputClasses}
              placeholder="SOD-2024-001"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>Dodavatel *</label>
            {vendors.length > 0 ? (
              <select
                value={formData.vendorId}
                onChange={(e) => handleVendorSelect(e.target.value)}
                className={inputClasses}
              >
                <option value="">Vyberte dodavatele...</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.company}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={formData.vendorName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    vendorName: e.target.value,
                  }))
                }
                className={inputClasses}
                placeholder="Název dodavatele"
              />
            )}
            {errors.vendorName && (
              <p className={errorClasses}>{errors.vendorName}</p>
            )}
          </div>

          <div>
            <label className={labelClasses}>Stav</label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  status: e.target.value as ContractStatus,
                }))
              }
              className={inputClasses}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Dates */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
          Termíny
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClasses}>Datum podpisu</label>
            <input
              type="date"
              value={formData.signedAt}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, signedAt: e.target.value }))
              }
              className={inputClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>Platnost od</label>
            <input
              type="date"
              value={formData.effectiveFrom}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  effectiveFrom: e.target.value,
                }))
              }
              className={inputClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>Platnost do</label>
            <input
              type="date"
              value={formData.effectiveTo}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  effectiveTo: e.target.value,
                }))
              }
              className={inputClasses}
            />
          </div>
        </div>
      </div>

      {/* Financial */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
          Finanční údaje
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>Cena díla (bez DPH)</label>
            <div className="relative">
              <input
                type="text"
                value={formData.basePrice}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    basePrice: e.target.value,
                  }))
                }
                className={`${inputClasses} pr-14`}
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                {formData.currency}
              </span>
            </div>
            {errors.basePrice && (
              <p className={errorClasses}>{errors.basePrice}</p>
            )}
          </div>

          <div>
            <label className={labelClasses}>Měna</label>
            <select
              value={formData.currency}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, currency: e.target.value }))
              }
              className={inputClasses}
            >
              <option value="CZK">CZK</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={`${labelClasses} min-h-[40px] flex items-end`}>
              Pozastávka (%)
            </label>
            <input
              type="text"
              value={formData.retentionPercent}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  retentionPercent: e.target.value,
                }))
              }
              className={inputClasses}
              placeholder="5"
            />
            {errors.retentionPercent && (
              <p className={errorClasses}>{errors.retentionPercent}</p>
            )}
          </div>

          <div>
            <label className={`${labelClasses} min-h-[40px] flex items-end`}>
              Záruční doba (měsíce)
            </label>
            <input
              type="text"
              value={formData.warrantyMonths}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  warrantyMonths: e.target.value,
                }))
              }
              className={inputClasses}
              placeholder="60"
            />
            {errors.warrantyMonths && (
              <p className={errorClasses}>{errors.warrantyMonths}</p>
            )}
          </div>

          <div>
            <label className={`${labelClasses} min-h-[40px] flex items-end`}>
              Splatnost
            </label>
            <input
              type="text"
              value={formData.paymentTerms}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  paymentTerms: e.target.value,
                }))
              }
              className={inputClasses}
              placeholder="30 dní od doručení faktury"
            />
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className={labelClasses}>Předmět díla</label>
        <textarea
          value={formData.scopeSummary}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, scopeSummary: e.target.value }))
          }
          className={`${inputClasses} resize-none`}
          rows={3}
          placeholder="Stručný popis předmětu smlouvy..."
        />
      </div>

      {/* Source (hidden for manual editing) */}
      {!isEditing && <input type="hidden" value={formData.source} />}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
        >
          Zrušit
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 flex items-center gap-2"
        >
          {submitting && (
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
          )}
          {isEditing ? "Uložit změny" : "Vytvořit smlouvu"}
        </button>
      </div>
    </form>
  );
};
