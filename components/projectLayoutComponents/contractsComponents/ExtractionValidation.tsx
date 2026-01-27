import React, { useState } from "react";
import { Contract } from "../../../types";
import { contractExtractionService } from "../../../services/contractExtractionService";

interface ExtractionValidationProps {
  extractedFields: Partial<Contract>;
  confidence: Record<string, number>;
  rawText?: string;
  onConfirm: (data: Partial<Contract>) => void;
  onCancel: () => void;
}

interface FieldConfig {
  key: keyof Contract;
  label: string;
  type: "text" | "number" | "date" | "textarea";
  placeholder?: string;
}

const fieldConfigs: FieldConfig[] = [
  {
    key: "title",
    label: "Název smlouvy",
    type: "text",
    placeholder: "Smlouva o dílo",
  },
  {
    key: "contractNumber",
    label: "Číslo smlouvy",
    type: "text",
    placeholder: "SOD-2024-001",
  },
  {
    key: "vendorName",
    label: "Dodavatel",
    type: "text",
    placeholder: "Název dodavatele",
  },
  { key: "signedAt", label: "Datum podpisu", type: "date" },
  { key: "effectiveFrom", label: "Platnost od", type: "date" },
  { key: "effectiveTo", label: "Platnost do", type: "date" },
  { key: "basePrice", label: "Cena díla", type: "number", placeholder: "0" },
  { key: "currency", label: "Měna", type: "text", placeholder: "CZK" },
  {
    key: "retentionPercent",
    label: "Pozastávka (%)",
    type: "number",
    placeholder: "5",
  },
  {
    key: "siteSetupPercent",
    label: "Zařízení staveniště (%)",
    type: "number",
    placeholder: "2",
  },
  {
    key: "warrantyMonths",
    label: "Záruční doba (měsíce)",
    type: "number",
    placeholder: "60",
  },
  {
    key: "paymentTerms",
    label: "Splatnost",
    type: "text",
    placeholder: "30 dní",
  },
  { key: "scopeSummary", label: "Předmět díla", type: "textarea" },
];

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.8) return "text-emerald-500";
  if (confidence >= 0.5) return "text-amber-500";
  return "text-red-500";
};

const getConfidenceLabel = (confidence: number): string => {
  if (confidence >= 0.8) return "Vysoká";
  if (confidence >= 0.5) return "Střední";
  if (confidence > 0) return "Nízká";
  return "Nenalezeno";
};

const getConfidenceBg = (confidence: number): string => {
  if (confidence >= 0.8)
    return "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800";
  if (confidence >= 0.5)
    return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
  if (confidence > 0)
    return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
  return "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700";
};

const parseNumberInput = (value: string): number | null => {
  const cleaned = value
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(/,(?=\d{1,2}$)/, ".")
    .replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatNumberInput = (value: string): string => {
  const parsed = parseNumberInput(value);
  if (parsed === null) return value;
  const hasDecimals = /,\d{1,2}$/.test(value) || /\.\d{1,2}$/.test(value);
  return new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(parsed);
};

export const ExtractionValidation: React.FC<ExtractionValidationProps> = ({
  extractedFields,
  confidence,
  rawText,
  onConfirm,
  onCancel,
}) => {
  const [formData, setFormData] = useState<Record<string, string>>(
    Object.fromEntries(
      fieldConfigs.map(({ key }) => [
        key,
        extractedFields[key]?.toString() || "",
      ]),
    ),
  );

  const overallConfidence =
    contractExtractionService.getOverallConfidence(confidence);
  const isReliable = contractExtractionService.isExtractionReliable(confidence);
  const [showRawText, setShowRawText] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: Partial<Contract> = {};

    fieldConfigs.forEach(({ key, type }) => {
      const value = formData[key];
      if (!value) return;

      if (type === "number") {
        data[key] = parseFloat(value) as never;
      } else {
        data[key] = value as never;
      }
    });

    onConfirm(data);
  };

  const inputClasses =
    "w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm";

  return (
    <div className="space-y-6">
      {/* Overall Confidence */}
      <div
        className={`p-4 rounded-xl border ${getConfidenceBg(overallConfidence)}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`material-symbols-outlined text-2xl ${getConfidenceColor(overallConfidence)}`}
            >
              {isReliable ? "verified" : "warning"}
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Celková spolehlivost extrakce:{" "}
                {(overallConfidence * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isReliable
                  ? "Data vypadají spolehlivě. Před uložením je doporučeno zkontrolovat."
                  : "Nízká spolehlivost extrakce. Pečlivě zkontrolujte všechna pole."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* OCR Text Preview */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-400 text-lg">
              text_snippet
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Přečtený text (OCR)
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {rawText
                  ? `${rawText.length.toLocaleString("cs-CZ")} znaků`
                  : "Text není k dispozici"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowRawText((prev) => !prev)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            {showRawText ? "Skrýt" : "Zobrazit"}
          </button>
        </div>
        {showRawText && (
          <div className="px-4 pb-4">
            <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
              <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap p-3 font-mono">
                {rawText || "OCR text nebyl uložen."}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Fields */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fieldConfigs.map(({ key, label, type, placeholder }) => {
            const fieldConfidence = confidence[key] || 0;
            const confidenceColor = getConfidenceColor(fieldConfidence);

            return (
              <div
                key={key}
                className={type === "textarea" ? "md:col-span-2" : ""}
              >
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {label}
                  </label>
                  <span className={`text-xs font-medium ${confidenceColor}`}>
                    {getConfidenceLabel(fieldConfidence)}
                    {fieldConfidence > 0 &&
                      ` (${(fieldConfidence * 100).toFixed(0)}%)`}
                  </span>
                </div>

                {type === "textarea" ? (
                  <textarea
                    value={formData[key]}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    className={`${inputClasses} resize-none border-slate-300 dark:border-slate-600`}
                    rows={3}
                    placeholder={placeholder}
                  />
                ) : (
                  <input
                    type={type === "number" ? "text" : type}
                    value={formData[key]}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    onBlur={() => {
                      if (key !== "basePrice") return;
                      setFormData((prev) => ({
                        ...prev,
                        [key]: formatNumberInput(prev[key] || ""),
                      }));
                    }}
                    className={`${inputClasses} border-slate-300 dark:border-slate-600`}
                    placeholder={placeholder}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 text-xs text-slate-500 pt-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Vysoká spolehlivost</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Střední spolehlivost</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span>Nízká spolehlivost</span>
          </div>
        </div>

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
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">check</span>
            Potvrdit a uložit
          </button>
        </div>
      </form>
    </div>
  );
};
