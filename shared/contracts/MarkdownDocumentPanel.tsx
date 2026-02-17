import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ContractMarkdownEntityType,
  ContractMarkdownSourceKind,
  ContractMarkdownVersion,
} from "../../types";
import { contractService } from "../../services/contractService";
import { Modal } from "../ui/Modal";
import {
  exportMarkdownToFile,
  exportMarkdownToPdf,
} from "../../services/exportService";
import { renderMarkdownToSafeHtml } from "./markdownRender";

interface MarkdownDocumentPanelProps {
  entityType: ContractMarkdownEntityType;
  entityId: string;
  entityLabel: string;
  editable?: boolean;
  fitParent?: boolean;
  enableSearch?: boolean;
}

const sourceKindLabels: Record<ContractMarkdownSourceKind, string> = {
  ocr: "OCR",
  manual_edit: "Ruční úprava",
  manual_upload: "Ruční upload",
  import: "Import",
};

const formatDateTime = (value?: string): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("cs-CZ");
};

const getExportBase = (entityLabel: string, versionNo?: number): string => {
  const safeBase = entityLabel
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_\-]/g, "");
  const today = new Date().toISOString().split("T")[0];
  if (!versionNo) return `${safeBase || "smlouva"}_${today}`;
  return `${safeBase || "smlouva"}_v${versionNo}_${today}`;
};

const SEARCH_MARK_CLASS = "md-search-mark";

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
      mark.className = `${SEARCH_MARK_CLASS} rounded px-1 py-0.5 font-semibold text-slate-950 bg-amber-300 dark:bg-amber-200 dark:text-slate-950 ring-1 ring-amber-500/80 dark:ring-amber-300/80`;
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

const focusSearchMatch = (
  matches: HTMLElement[],
  index: number,
  behavior: ScrollBehavior = "smooth",
) => {
  matches.forEach((match, matchIndex) => {
    const isActive = matchIndex === index;
    match.style.outline = isActive ? "2px solid rgb(217 119 6)" : "";
    match.style.boxShadow = isActive
      ? "0 0 0 1px rgba(255,255,255,0.95), 0 0 0 3px rgba(217,119,6,0.9)"
      : "";
    match.style.borderRadius = "0.25rem";
  });
  const activeMatch = matches[index];
  if (activeMatch && typeof activeMatch.scrollIntoView === "function") {
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        activeMatch.scrollIntoView({ behavior, block: "center" });
      });
    } else {
      activeMatch.scrollIntoView({ behavior, block: "center" });
    }
  }
};

export const MarkdownDocumentPanel: React.FC<MarkdownDocumentPanelProps> = ({
  entityType,
  entityId,
  entityLabel,
  editable = false,
  fitParent = false,
  enableSearch = false,
}) => {
  const [versions, setVersions] = useState<ContractMarkdownVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );
  const [draftMd, setDraftMd] = useState("");
  const [editing, setEditing] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchCount, setSearchMatchCount] = useState(0);
  const [activeSearchMatchIndex, setActiveSearchMatchIndex] = useState(0);
  const [showSourceDetails, setShowSourceDetails] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const searchMatchesRef = useRef<HTMLElement[]>([]);

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) || versions[0] || null,
    [versions, selectedVersionId],
  );

  const selectedHtml = useMemo(
    () => renderMarkdownToSafeHtml(selectedVersion?.contentMd || ""),
    [selectedVersion?.contentMd],
  );

  const draftHtml = useMemo(() => renderMarkdownToSafeHtml(draftMd), [draftMd]);
  const selectedMarkup = useMemo(() => ({ __html: selectedHtml }), [selectedHtml]);
  const draftMarkup = useMemo(() => ({ __html: draftHtml }), [draftHtml]);

  const loadVersions = async (preferVersionId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await contractService.getMarkdownVersions({
        entityType,
        entityId,
      });
      setVersions(data);

      const nextSelected =
        (preferVersionId && data.find((v) => v.id === preferVersionId)?.id) ||
        data[0]?.id ||
        null;
      setSelectedVersionId(nextSelected);
      if (!editing) {
        setDraftMd(data.find((v) => v.id === nextSelected)?.contentMd || "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se načíst verze");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setEditing(false);
    setDraftMd("");
    setSelectedVersionId(null);
    setSearchQuery("");
    setSearchMatchCount(0);
    setActiveSearchMatchIndex(0);
    searchMatchesRef.current = [];
    loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  useEffect(() => {
    if (!editing) {
      setDraftMd(selectedVersion?.contentMd || "");
    }
  }, [editing, selectedVersion?.id, selectedVersion?.contentMd]);

  useEffect(() => {
    setShowSourceDetails(false);
  }, [selectedVersion?.id]);

  useEffect(() => {
    const container = previewContainerRef.current;

    if (!enableSearch) {
      if (container) {
        clearSearchHighlights(container);
      }
      setSearchMatchCount(0);
      setActiveSearchMatchIndex(0);
      searchMatchesRef.current = [];
      return;
    }

    if (!container) {
      setSearchMatchCount(0);
      setActiveSearchMatchIndex(0);
      searchMatchesRef.current = [];
      return;
    }

    clearSearchHighlights(container);
    searchMatchesRef.current = [];

    const normalizedQuery = searchQuery.trim();
    if (!normalizedQuery) {
      setSearchMatchCount(0);
      setActiveSearchMatchIndex(0);
      return;
    }

    const matches = highlightSearchMatches(container, normalizedQuery);
    searchMatchesRef.current = matches;
    setSearchMatchCount(matches.length);

    if (matches.length === 0) {
      setActiveSearchMatchIndex(0);
      return;
    }

    setActiveSearchMatchIndex(0);
    // Always jump to the first match immediately so the result is visible in text.
    focusSearchMatch(matches, 0, "auto");
  }, [enableSearch, searchQuery, editing, draftHtml, selectedHtml]);

  const saveNewVersion = async () => {
    if (!editable) return;
    const content = draftMd.trim();
    if (!content) {
      setError("Obsah markdownu je prázdný");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const created = await contractService.createMarkdownVersion({
        entityType,
        contractId: entityType === "contract" ? entityId : undefined,
        amendmentId: entityType === "amendment" ? entityId : undefined,
        sourceKind: "manual_edit",
        contentMd: content,
        sourceDocumentUrl: selectedVersion?.sourceDocumentUrl,
        metadata: {
          basedOnVersionNo: selectedVersion?.versionNo || null,
        },
      });
      setEditing(false);
      await loadVersions(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se uložit verzi");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadMd = () => {
    if (!selectedVersion) return;
    contractService
      .logMarkdownAccess({
        markdownVersionId: selectedVersion.id,
        accessKind: "download",
        accessSource: "panel",
      })
      .catch(() => undefined);
    exportMarkdownToFile(
      getExportBase(entityLabel, selectedVersion.versionNo),
      selectedVersion.contentMd,
    );
  };

  const handleExportPdf = () => {
    if (!selectedVersion) return;
    contractService
      .logMarkdownAccess({
        markdownVersionId: selectedVersion.id,
        accessKind: "export",
        accessSource: "panel",
      })
      .catch(() => undefined);
    exportMarkdownToPdf(
      getExportBase(entityLabel, selectedVersion.versionNo),
      selectedVersion.contentMd,
      `${entityLabel} (v${selectedVersion.versionNo})`,
    );
  };

  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col ${
        fitParent ? "h-full min-h-0" : "min-h-[540px]"
      }`}
    >
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Načtená smlouva (.md)
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Náhled, historie verzí a export.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!selectedVersion}
            onClick={() => {
              if (selectedVersion) {
                contractService
                  .logMarkdownAccess({
                    markdownVersionId: selectedVersion.id,
                    accessKind: "view",
                    accessSource: "panel",
                  })
                  .catch(() => undefined);
              }
              setShowPreviewModal(true);
            }}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50"
          >
            Nahlédnout
          </button>
          <button
            type="button"
            disabled={!selectedVersion}
            onClick={handleDownloadMd}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50"
          >
            Stáhnout .md
          </button>
          <button
            type="button"
            disabled={!selectedVersion}
            onClick={handleExportPdf}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="p-3 border-b border-slate-200 dark:border-slate-700">
        <p className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-1.5">
          Verze
        </p>
        {loading ? (
          <p className="text-sm text-slate-500">Načítám verze…</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-slate-500">Zatím není uložená žádná verze markdownu.</p>
        ) : (
          <div className="max-h-28 overflow-y-auto space-y-1.5">
            {versions.map((version) => (
              <button
                type="button"
                key={version.id}
                onClick={() => {
                  setSelectedVersionId(version.id);
                  setEditing(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-[11px] ${
                  selectedVersion?.id === version.id
                    ? "border-primary bg-primary/10"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">v{version.versionNo}</span>
                  <span className="text-slate-500 truncate">{formatDateTime(version.createdAt)}</span>
                  <span className="text-slate-500">{sourceKindLabels[version.sourceKind]}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">
            Zdroj
          </p>
          {selectedVersion && (
            <button
              type="button"
              onClick={() => setShowSourceDetails((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
              aria-expanded={showSourceDetails}
            >
              {showSourceDetails ? "Skrýt detail" : "Zobrazit detail"}
              <span className={`material-symbols-outlined text-sm transition-transform ${showSourceDetails ? "rotate-180" : ""}`}>
                expand_more
              </span>
            </button>
          )}
        </div>
        {selectedVersion ? (
          <div className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
            <p className="truncate">
              <span className="font-medium">{sourceKindLabels[selectedVersion.sourceKind]}</span>
              {" • "}
              <span>{selectedVersion.sourceFileName || "-"}</span>
            </p>
            {showSourceDetails && (
              <div className="mt-2 space-y-1">
                <p>
                  Typ: <span className="font-medium">{sourceKindLabels[selectedVersion.sourceKind]}</span>
                </p>
                <p>
                  Soubor: <span className="font-medium">{selectedVersion.sourceFileName || "-"}</span>
                </p>
                <p>
                  OCR: <span className="font-medium">{selectedVersion.ocrProvider || "-"}</span>
                  {selectedVersion.ocrModel ? ` / ${selectedVersion.ocrModel}` : ""}
                </p>
                <p>
                  Autor: <span className="font-medium">{selectedVersion.createdBy || "-"}</span>
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500 mt-1.5">Pro výpis zdroje vyberte verzi.</p>
        )}
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">
            Náhled
          </p>
          {editable && (
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setDraftMd(selectedVersion?.contentMd || "");
                    }}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600"
                  >
                    Zrušit úpravu
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={saveNewVersion}
                    className="px-2.5 py-1.5 text-xs rounded-lg bg-primary text-white disabled:opacity-50"
                  >
                    {saving ? "Ukládám…" : "Uložit novou verzi"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600"
                >
                  Upravit
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-3 p-2 rounded-lg bg-red-50 text-red-600 text-xs">{error}</div>
        )}

        {enableSearch && (
          <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-2">
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
                placeholder="Vyhledat v dokumentu..."
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
                    const next = (prev - 1 + searchMatchCount) % searchMatchCount;
                    focusSearchMatch(searchMatchesRef.current, next);
                    return next;
                  });
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50"
                aria-label="Předchozí výskyt"
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
                aria-label="Další výskyt"
                title="Další výskyt"
              >
                ↓
              </button>
            </div>
          </div>
        )}

        {editing ? (
          <div className="space-y-3">
            <textarea
              value={draftMd}
              onChange={(e) => setDraftMd(e.target.value)}
              rows={14}
              className="w-full text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 p-3"
              placeholder="Vložte nebo upravte markdown obsah smlouvy..."
            />
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-xs font-semibold text-slate-500 mb-2">Rychlý náhled</p>
              <div
                ref={previewContainerRef}
                className="text-sm leading-6 text-slate-700 dark:text-slate-200 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-slate-300 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1 [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:rounded"
                dangerouslySetInnerHTML={draftMarkup}
              />
            </div>
          </div>
        ) : selectedVersion ? (
          <div
            ref={previewContainerRef}
            className="text-sm leading-6 text-slate-700 dark:text-slate-200 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-slate-300 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1 [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:rounded"
            dangerouslySetInnerHTML={selectedMarkup}
          />
        ) : (
          <p className="text-sm text-slate-500">
            Dokument zatím nemá žádnou verzi. Nahrajte smlouvu přes OCR, nebo vytvořte první verzi ručně.
          </p>
        )}
      </div>

      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title={`Náhled dokumentu: ${entityLabel}`}
        size="full"
      >
        <div className="space-y-4">
          {versions.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">Verze</label>
              <select
                value={selectedVersion?.id || ""}
                onChange={(e) => setSelectedVersionId(e.target.value)}
                className="w-full md:w-80 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    v{version.versionNo} • {sourceKindLabels[version.sourceKind]} • {formatDateTime(version.createdAt)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            {selectedVersion ? (
              <div
                className="text-sm leading-6 text-slate-700 dark:text-slate-200 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-slate-300 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1 [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:rounded"
                dangerouslySetInnerHTML={{ __html: selectedHtml }}
              />
            ) : (
              <p className="text-slate-500">Není dostupná žádná verze dokumentu.</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
