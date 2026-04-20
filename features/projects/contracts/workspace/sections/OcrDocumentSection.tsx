import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ContractAmendment,
  ContractMarkdownEntityType,
  ContractMarkdownSourceKind,
  ContractMarkdownVersion,
  ContractWithDetails,
} from '@/types';
import { contractService } from '@/services/contractService';
import { contractExtractionService } from '@/services/contractExtractionService';
import { MarkdownDocumentPanel } from '@/shared/contracts/MarkdownDocumentPanel';
import { Modal } from '@/shared/ui/Modal';
import { formatDate } from '../../utils/format';

const getSafeDocumentUrl = (value: string | undefined): string | null => {
  if (!value) return null;
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  try {
    const parsed = new URL(trimmedValue);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

interface Props {
  contract: ContractWithDetails;
  onRefresh: () => Promise<void> | void;
}

type TargetKind = 'contract' | { amendmentId: string };

const ConfidencePill: React.FC<{ value: number | null | undefined }> = ({ value }) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const percent = Math.round((value as number) * 100);
  const color =
    percent >= 80
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
      : percent >= 50
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
        : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      {percent} %
    </span>
  );
};

const DocumentRow: React.FC<{
  title: string;
  subtitle?: string;
  ocrDone?: boolean;
  confidence?: number | null;
  busy?: boolean;
  busyLabel?: string;
  error?: string | null;
  onPickFile: (file: File) => void;
  actionLabel: string;
  documentUrl?: string | null;
  hasDocument?: boolean;
}> = ({
  title,
  subtitle,
  ocrDone,
  confidence,
  busy,
  busyLabel,
  error,
  onPickFile,
  actionLabel,
  documentUrl,
  hasDocument,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{title}</div>
          {subtitle && <div className="text-[11px] text-slate-600 dark:text-slate-500 truncate">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-2">
          {ocrDone ? (
            <>
              <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-semibold">
                OCR hotové
              </span>
              <ConfidencePill value={confidence} />
            </>
          ) : (
            <span className="rounded-full bg-slate-200 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400 px-2 py-0.5 text-[10px] font-semibold">
              Bez OCR
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg border border-primary/40 text-primary text-xs hover:bg-primary/10 hover:border-primary transition disabled:opacity-50"
        >
          {busy ? busyLabel ?? 'Pracuji…' : actionLabel}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.doc"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPickFile(file);
            if (inputRef.current) inputRef.current.value = '';
          }}
        />
        {documentUrl ? (
          <a
            href={documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Otevřít dokument
          </a>
        ) : hasDocument ? (
          <div className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-xs">
            Odkaz na dokument je neplatný.
          </div>
        ) : null}
      </div>
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-[11px] px-2.5 py-1.5">
          {error}
        </div>
      )}
    </div>
  );
};

export const OcrDocumentSection: React.FC<Props> = ({ contract, onRefresh }) => {
  const [busy, setBusy] = useState<TargetKind | null>(null);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<Record<string, string>>({});
  const [markdownRefreshKey, setMarkdownRefreshKey] = useState(0);
  const hasDocument = Boolean(contract.documentUrl);
  const safeDocumentUrl = getSafeDocumentUrl(contract.documentUrl);

  const amendments = useMemo<ContractAmendment[]>(
    () => [...contract.amendments].sort((a, b) => a.amendmentNo - b.amendmentNo),
    [contract.amendments],
  );

  const setErr = (key: string, msg: string | null) => {
    setError((prev) => {
      const next = { ...prev };
      if (msg === null) delete next[key];
      else next[key] = msg;
      return next;
    });
  };

  const runContractOcr = async (file: File) => {
    setBusy('contract');
    setErr('contract', null);
    setStatus('Extrahuji text a strukturovaná data…');
    try {
      const result = await contractExtractionService.extractFromDocument(file, setStatus);

      if (result.rawText && result.rawText.trim().length > 0) {
        try {
          await contractService.createMarkdownVersion({
            entityType: 'contract',
            contractId: contract.id,
            sourceKind: 'ocr',
            contentMd: result.rawText,
            sourceFileName: result.sourceFileName,
            ocrProvider: result.ocrProvider,
            ocrModel: result.ocrModel,
            metadata: { confidence: result.confidence || {} },
          });
        } catch (mdErr) {
          console.warn('Nepodařilo se uložit MD verzi smlouvy:', mdErr);
        }
      }

      await contractService.updateContract(contract.id, {
        extractionJson: {
          fields: result.fields,
          confidence: result.confidence,
          ocrProvider: result.ocrProvider,
          ocrModel: result.ocrModel,
          sourceFileName: result.sourceFileName,
          extractedAt: new Date().toISOString(),
        },
        extractionConfidence:
          typeof result.confidence === 'object' && result.confidence !== null
            ? averageConfidence(result.confidence)
            : undefined,
      });
      setStatus('');
      setMarkdownRefreshKey((k) => k + 1);
      await onRefresh();
    } catch (err) {
      setErr('contract', err instanceof Error ? err.message : 'OCR selhalo.');
      setStatus('');
    } finally {
      setBusy(null);
    }
  };

  const runAmendmentOcr = async (amendment: ContractAmendment, file: File) => {
    const key = `amend-${amendment.id}`;
    setBusy({ amendmentId: amendment.id });
    setErr(key, null);
    setStatus('Extrahuji data dodatku…');
    try {
      const result = await contractExtractionService.extractAmendmentFromDocument(file);

      if (result.rawText && result.rawText.trim().length > 0) {
        try {
          await contractService.createMarkdownVersion({
            entityType: 'amendment',
            amendmentId: amendment.id,
            sourceKind: 'ocr',
            contentMd: result.rawText,
            sourceFileName: result.sourceFileName,
            ocrProvider: result.ocrProvider,
            ocrModel: result.ocrModel,
            metadata: { confidence: result.confidence || {} },
          });
        } catch (mdErr) {
          console.warn('Nepodařilo se uložit MD verzi dodatku:', mdErr);
        }
      }

      await contractService.updateAmendment(amendment.id, {
        extractionJson: {
          fields: result.fields,
          confidence: result.confidence,
          ocrProvider: result.ocrProvider,
          ocrModel: result.ocrModel,
          sourceFileName: result.sourceFileName,
          extractedAt: new Date().toISOString(),
        },
        extractionConfidence:
          typeof result.confidence === 'object' && result.confidence !== null
            ? averageConfidence(result.confidence)
            : undefined,
      });
      setStatus('');
      setMarkdownRefreshKey((k) => k + 1);
      await onRefresh();
    } catch (err) {
      setErr(key, err instanceof Error ? err.message : 'OCR selhalo.');
      setStatus('');
    } finally {
      setBusy(null);
    }
  };

  const isContractBusy = busy === 'contract';

  return (
    <section id="sec-ocr" className="py-4 border-b border-dashed border-slate-200 dark:border-slate-800">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-[11px] uppercase tracking-widest text-slate-600 dark:text-slate-500 font-bold">
          OCR dokumenty
        </h3>
        {status && (
          <span className="text-[11px] text-primary animate-pulse">{status}</span>
        )}
      </div>

      <div className="space-y-3">
        <DocumentRow
          title="Smlouva"
          subtitle={
            [contract.contractNumber, formatDate(contract.signedAt)].filter(Boolean).join(' · ') ||
            undefined
          }
          ocrDone={contract.extractionConfidence != null}
          confidence={contract.extractionConfidence}
          busy={isContractBusy}
          busyLabel="Zpracovávám…"
          error={error.contract}
          onPickFile={(f) => void runContractOcr(f)}
          actionLabel={
            contract.extractionConfidence != null ? 'Spustit OCR znovu' : 'Vybrat dokument a spustit OCR'
          }
          documentUrl={safeDocumentUrl}
          hasDocument={hasDocument}
        />

        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-slate-600 dark:text-slate-500 mb-2">
            Dodatky ({amendments.length})
          </div>
          {amendments.length === 0 ? (
            <div className="text-xs text-slate-600 dark:text-slate-500 italic">Žádné dodatky.</div>
          ) : (
            <div className="space-y-2">
              {amendments.map((a) => {
                const key = `amend-${a.id}`;
                const isBusy =
                  busy && typeof busy === 'object' && busy.amendmentId === a.id;
                return (
                  <DocumentRow
                    key={a.id}
                    title={`Dodatek č. ${a.amendmentNo}`}
                    subtitle={
                      [a.reason, a.signedAt ? formatDate(a.signedAt) : null]
                        .filter(Boolean)
                        .join(' · ') || undefined
                    }
                    ocrDone={a.extractionConfidence != null}
                    confidence={a.extractionConfidence}
                    busy={Boolean(isBusy)}
                    busyLabel="Zpracovávám…"
                    error={error[key]}
                    onPickFile={(f) => void runAmendmentOcr(a, f)}
                    actionLabel={
                      a.extractionConfidence != null ? 'Spustit OCR znovu' : 'Vybrat dokument a spustit OCR'
                    }
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-4 mt-2 border-t border-slate-200 dark:border-slate-800">
          <MarkdownVersionsList
            entityType="contract"
            entityId={contract.id}
            entityLabel={contract.title || contract.vendorName || 'Smlouva'}
            refreshKey={markdownRefreshKey}
          />
        </div>
      </div>
    </section>
  );
};

const SOURCE_KIND_LABEL: Record<ContractMarkdownSourceKind, string> = {
  ocr: 'OCR',
  manual_edit: 'Ruční úprava',
  manual_upload: 'Ruční upload',
  import: 'Import',
};

const formatMarkdownDateTime = (value?: string): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('cs-CZ');
};

interface MarkdownVersionsListProps {
  entityType: ContractMarkdownEntityType;
  entityId: string;
  entityLabel: string;
  refreshKey: number;
}

const MarkdownVersionsList: React.FC<MarkdownVersionsListProps> = ({
  entityType,
  entityId,
  entityLabel,
  refreshKey,
}) => {
  const [versions, setVersions] = useState<ContractMarkdownVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await contractService.getMarkdownVersions({ entityType, entityId });
        if (!cancelled) setVersions(data);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Nepodařilo se načíst MD verze.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, refreshKey]);

  return (
    <>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="text-[10.5px] uppercase tracking-wider text-slate-600 dark:text-slate-500">
          MD verze ({versions.length})
        </div>
        {versions.length > 0 && (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="text-[11px] text-primary hover:underline"
          >
            Zobrazit náhled →
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-[11px] text-slate-600 dark:text-slate-500 italic">Načítám…</div>
      ) : loadError ? (
        <div className="rounded-md bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-[11px] px-2.5 py-1.5">
          {loadError}
        </div>
      ) : versions.length === 0 ? (
        <div className="text-[11px] text-slate-600 dark:text-slate-500 italic">
          Žádné MD verze. Spuštěním OCR se vytvoří první verze.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {versions.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="w-full flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span className="rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 text-[10px] font-semibold">
                    v{v.versionNo}
                  </span>
                  <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold">
                    {SOURCE_KIND_LABEL[v.sourceKind]}
                  </span>
                  <span className="text-xs text-slate-900 dark:text-slate-200 truncate">
                    {v.sourceFileName || 'dokument.md'}
                  </span>
                </div>
                <span className="text-[10.5px] text-slate-600 dark:text-slate-500 whitespace-nowrap">
                  {formatMarkdownDateTime(v.createdAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {previewOpen && (
        <Modal
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          title={`MD verze — ${entityLabel}`}
          size="2xl"
        >
          <div className="min-h-[60vh]">
            <MarkdownDocumentPanel
              key={`md-panel-${entityType}-${entityId}-${refreshKey}`}
              entityType={entityType}
              entityId={entityId}
              entityLabel={entityLabel}
              editable
              enableSearch
              fitParent
            />
          </div>
        </Modal>
      )}
    </>
  );
};

const averageConfidence = (confidence: Record<string, unknown>): number | undefined => {
  const values = Object.values(confidence).filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  );
  if (values.length === 0) return undefined;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
};
