import React, { useEffect, useMemo, useRef, useState } from "react";
import { Contract } from "../../../types";
import { contractExtractionService } from "../../../services/contractExtractionService";
import { renderMarkdownToSafeHtml } from "../../../shared/contracts/markdownRender";

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
  const raw = value.trim();
  if (!raw) return null;

  let cleaned = raw
    .replace(/\s+/g, "")
    .replace(/[^0-9,.-]/g, "")
    .replace(/(?!^)-/g, "");

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandSeparator = decimalSeparator === "," ? "." : ",";
    cleaned = cleaned.replace(new RegExp(`\\${thousandSeparator}`, "g"), "");
    if (decimalSeparator === ",") {
      cleaned = cleaned.replace(",", ".");
    }
  } else if (hasComma) {
    const parts = cleaned.split(",");
    if (parts.length > 2) {
      cleaned = parts.join("");
    } else {
      const fraction = parts[1] || "";
      cleaned =
        fraction.length === 3 ? parts.join("") : `${parts[0]}.${fraction}`;
    }
  } else if (hasDot) {
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      cleaned = parts.join("");
    } else {
      const fraction = parts[1] || "";
      if (fraction.length > 2) {
        cleaned = parts.join("");
      }
    }
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatNumberInput = (value: string): string => {
  const parsed = parseNumberInput(value);
  if (parsed === null) return value;

  const decimalMatch = value.trim().replace(/\s+/g, "").match(/[,.](\d+)$/);
  const decimalDigits = decimalMatch ? Math.min(decimalMatch[1].length, 2) : 0;

  return new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: decimalDigits,
    maximumFractionDigits: 2,
  }).format(parsed);
};

const SEARCH_MARK_CLASS = "ocr-search-mark";

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const clearSearchHighlights = (container: HTMLElement) => {
  container.querySelectorAll(`mark.${SEARCH_MARK_CLASS}`).forEach((markNode) => {
    const parent = markNode.parentNode;
    if (!parent) return;
    parent.replaceChild(
      document.createTextNode(markNode.textContent || ""),
      markNode,
    );
    parent.normalize();
  });
};

const highlightSearchMatches = (
  container: HTMLElement,
  searchQuery: string,
): HTMLElement[] => {
  const normalizedQuery = searchQuery.trim();
  if (!normalizedQuery) return [];

  const regex = new RegExp(escapeRegExp(normalizedQuery), "gi");
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let currentNode = walker.nextNode();

  while (currentNode) {
    const textNode = currentNode as Text;
    const parentEl = textNode.parentElement;
    if (
      parentEl &&
      textNode.nodeValue?.trim() &&
      !parentEl.closest(`mark.${SEARCH_MARK_CLASS}`)
    ) {
      textNodes.push(textNode);
    }
    currentNode = walker.nextNode();
  }

  const matches: HTMLElement[] = [];

  textNodes.forEach((textNode) => {
    const raw = textNode.nodeValue || "";
    regex.lastIndex = 0;
    if (!regex.test(raw)) return;
    regex.lastIndex = 0;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match: RegExpExecArray | null = regex.exec(raw);

    while (match) {
      const matchedText = match[0];
      const start = match.index;
      const end = start + matchedText.length;

      if (start > lastIndex) {
        fragment.appendChild(document.createTextNode(raw.slice(lastIndex, start)));
      }

      const mark = document.createElement("mark");
      mark.className = `${SEARCH_MARK_CLASS} rounded px-0.5 bg-amber-300/70 dark:bg-amber-500/40`;
      mark.textContent = matchedText;
      fragment.appendChild(mark);
      matches.push(mark);

      lastIndex = end;
      match = regex.exec(raw);
    }

    if (lastIndex < raw.length) {
      fragment.appendChild(document.createTextNode(raw.slice(lastIndex)));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  });

  return matches;
};

const focusSearchMatch = (matches: HTMLElement[], index: number) => {
  matches.forEach((match, matchIndex) => {
    match.style.outline = matchIndex === index ? "2px solid rgb(245 158 11)" : "";
    match.style.borderRadius = "0.25rem";
  });
  const activeMatch = matches[index];
  activeMatch?.scrollIntoView({ behavior: "smooth", block: "center" });
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
      fieldConfigs.map(({ key, type }) => {
        const raw = extractedFields[key]?.toString() || "";
        return [key, type === "number" ? formatNumberInput(raw) : raw];
      }),
    ),
  );

  const overallConfidence =
    contractExtractionService.getOverallConfidence(confidence);
  const isReliable = contractExtractionService.isExtractionReliable(confidence);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchCount, setSearchMatchCount] = useState(0);
  const [activeSearchMatchIndex, setActiveSearchMatchIndex] = useState(0);
  const rawTextContainerRef = useRef<HTMLDivElement | null>(null);
  const searchMatchesRef = useRef<HTMLElement[]>([]);
  const rawTextHtml = useMemo(
    () => renderMarkdownToSafeHtml(rawText || ""),
    [rawText],
  );

  useEffect(() => {
    if (rawText?.trim()) return;
    searchMatchesRef.current = [];
    setSearchMatchCount(0);
    setActiveSearchMatchIndex(0);
  }, [rawText]);

  useEffect(() => {
    const container = rawTextContainerRef.current;
    if (!container) return;

    clearSearchHighlights(container);
    searchMatchesRef.current = [];

    if (!searchQuery.trim()) {
      setSearchMatchCount(0);
      setActiveSearchMatchIndex(0);
      return;
    }

    const matches = highlightSearchMatches(container, searchQuery);
    searchMatchesRef.current = matches;
    setSearchMatchCount(matches.length);

    if (matches.length === 0) {
      setActiveSearchMatchIndex(0);
      return;
    }

    setActiveSearchMatchIndex(0);
    focusSearchMatch(matches, 0);
  }, [rawTextHtml, searchQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: Partial<Contract> = {};

    fieldConfigs.forEach(({ key, type }) => {
      const value = formData[key];
      if (!value) return;

      if (type === "number") {
        const parsed = parseNumberInput(value);
        if (parsed === null) return;
        data[key] = parsed as never;
      } else {
        data[key] = value as never;
      }
    });

    onConfirm(data);
  };

  const inputClasses =
    "w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 items-stretch xl:h-[72vh] xl:min-h-[640px]">
      {/* Fields */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-w-0 overflow-hidden flex flex-col xl:h-full"
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
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
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
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
                      className={`${inputClasses} resize-none border-slate-300 dark:border-slate-600 ${key === "scopeSummary" ? "min-h-[220px]" : ""}`}
                      rows={key === "scopeSummary" ? 8 : 3}
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
                        if (type !== "number") return;
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
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-4 py-3 border-t border-slate-200 dark:border-slate-700">
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

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col min-w-0 overflow-hidden xl:h-full">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-400 text-lg">
              text_snippet
            </span>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Načtený text OCR (Markdown)
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {rawText
              ? `${rawText.length.toLocaleString("cs-CZ")} znaků`
              : "Text není k dispozici"}
          </p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined text-base text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveSearchMatchIndex(0);
                }}
                placeholder="Vyhledat v OCR textu..."
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 min-w-[70px] text-right">
                {searchQuery.trim()
                  ? searchMatchCount > 0
                    ? `${activeSearchMatchIndex + 1}/${searchMatchCount}`
                    : "0 nálezů"
                  : "Bez filtru"}
              </span>
              <button
                type="button"
                disabled={searchMatchCount === 0}
                onClick={() => {
                  setActiveSearchMatchIndex((prev) => {
                    if (searchMatchCount === 0) return 0;
                    const next =
                      (prev - 1 + searchMatchCount) % searchMatchCount;
                    focusSearchMatch(searchMatchesRef.current, next);
                    return next;
                  });
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50"
                title="Předchozí výskyt"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={searchMatchCount === 0}
                onClick={() => {
                  setActiveSearchMatchIndex((prev) => {
                    if (searchMatchCount === 0) return 0;
                    const next = (prev + 1) % searchMatchCount;
                    focusSearchMatch(searchMatchesRef.current, next);
                    return next;
                  });
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50"
                title="Další výskyt"
              >
                ↓
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {rawText?.trim() ? (
            <div
              ref={rawTextContainerRef}
              className="text-sm leading-6 text-slate-700 dark:text-slate-200 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-slate-300 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1 [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:rounded"
              dangerouslySetInnerHTML={{ __html: rawTextHtml }}
            />
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              OCR text nebyl uložen.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
