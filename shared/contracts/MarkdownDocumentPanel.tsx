import React, { useEffect, useMemo, useState } from "react";
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

export const MarkdownDocumentPanel: React.FC<MarkdownDocumentPanelProps> = ({
  entityType,
  entityId,
  entityLabel,
  editable = false,
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

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) || versions[0] || null,
    [versions, selectedVersionId],
  );

  const selectedHtml = useMemo(
    () => renderMarkdownToSafeHtml(selectedVersion?.contentMd || ""),
    [selectedVersion?.contentMd],
  );

  const draftHtml = useMemo(() => renderMarkdownToSafeHtml(draftMd), [draftMd]);

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
    loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  useEffect(() => {
    if (!editing) {
      setDraftMd(selectedVersion?.contentMd || "");
    }
  }, [editing, selectedVersion?.id, selectedVersion?.contentMd]);

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
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[540px] flex flex-col">
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

      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <p className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-2">
          Verze
        </p>
        {loading ? (
          <p className="text-sm text-slate-500">Načítám verze…</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-slate-500">Zatím není uložená žádná verze markdownu.</p>
        ) : (
          <div className="max-h-40 overflow-y-auto space-y-2">
            {versions.map((version) => (
              <button
                type="button"
                key={version.id}
                onClick={() => {
                  setSelectedVersionId(version.id);
                  setEditing(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg border text-xs ${
                  selectedVersion?.id === version.id
                    ? "border-primary bg-primary/10"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">v{version.versionNo}</span>
                  <span className="text-slate-500">{sourceKindLabels[version.sourceKind]}</span>
                </div>
                <div className="text-slate-500 mt-1">{formatDateTime(version.createdAt)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <p className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-2">
          Zdroj
        </p>
        {selectedVersion ? (
          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
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
        ) : (
          <p className="text-sm text-slate-500">Pro výpis zdroje vyberte verzi.</p>
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
                className="text-sm leading-6 text-slate-700 dark:text-slate-200 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-slate-300 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1 [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:rounded"
                dangerouslySetInnerHTML={{ __html: draftHtml }}
              />
            </div>
          </div>
        ) : selectedVersion ? (
          <div
            className="text-sm leading-6 text-slate-700 dark:text-slate-200 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-slate-300 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1 [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:rounded"
            dangerouslySetInnerHTML={{ __html: selectedHtml }}
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
