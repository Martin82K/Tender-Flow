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
      ? 'bg-emerald-500/15 text-emerald-400'
      : percent >= 50
        ? 'bg-amber-500/15 text-amber-400'
        : 'bg-red-500/15 text-red-400';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      {percent} %
    </span>
  );
};

const DocumentRow: React.FC<{
  title: string;
  subtitle?: string;
  documentUrl?: string | null;
  confidence?: number | null;
  busy?: boolean;
  busyLabel?: string;
  error?: string | null;
  onPickFile: (file: File) => void;
  onOpen?: () => Promise<void> | void;
  actionLabel: string;
}> = ({ title, subtitle, documentUrl, confidence, busy, busyLabel, error, onPickFile, onOpen, actionLabel }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-100 truncate">{title}</div>
          {subtitle && <div className="text-[11px] text-slate-500 truncate">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-2">
          {documentUrl ? (
            <>
              <span className="rounded-full bg-emerald-500/15 text-emerald-400 px-2 py-0.5 text-[10px] font-semibold">
                Nahráno
              </span>
              <ConfidencePill value={confidence} />
            </>
          ) : (
            <span className="rounded-full bg-slate-500/15 text-slate-400 px-2 py-0.5 text-[10px] font-semibold">
              Bez dokumentu
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {documentUrl && onOpen && (
          <button
            type="button"
            onClick={() => onOpen()}
            className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-200 text-xs hover:bg-slate-800"
          >
            ↓ Otevřít dokument
          </button>
        )}
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
      </div>
      {error && (
        <div className="rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] px-2.5 py-1.5">
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

  const openDocument = async (documentRef: string | null | undefined) => {
    if (!documentRef) return;
    try {
      const url = await contractService.resolveContractDocumentUrl(documentRef);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setErr('open', err instanceof Error ? err.message : 'Nepodařilo se otevřít dokument.');
    }
  };

  const isContractBusy = busy === 'contract';

  return (
    <section id="sec-ocr" className="py-4 border-b border-dashed border-slate-800">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">
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
          documentUrl={contract.documentUrl}
          confidence={contract.extractionConfidence}
          busy={isContractBusy}
          busyLabel="Zpracovávám…"
          error={error.contract}
          onPickFile={(f) => void runContractOcr(f)}
          onOpen={() => openDocument(contract.documentUrl)}
          actionLabel={contract.documentUrl ? 'Nahradit a spustit OCR' : 'Nahrát a spustit OCR'}
        />

        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500 mb-2">
            Dodatky ({amendments.length})
          </div>
          {amendments.length === 0 ? (
            <div className="text-xs text-slate-500 italic">Žádné dodatky.</div>
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
                    documentUrl={a.documentUrl}
                    confidence={a.extractionConfidence}
                    busy={Boolean(isBusy)}
                    busyLabel="Zpracovávám…"
                    error={error[key]}
                    onPickFile={(f) => void runAmendmentOcr(a, f)}
                    onOpen={() => openDocument(a.documentUrl)}
                    actionLabel={a.documentUrl ? 'Nahradit a spustit OCR' : 'Nahrát a spustit OCR'}
                  />
                );
              })}
            </div>
          )}
        </div>

        {error.open && (
          <div className="rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] px-2.5 py-1.5">
            {error.open}
          </div>
        )}

        <div className="pt-4 mt-2 border-t border-slate-800">
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
        <div className="text-[10.5px] uppercase tracking-wider text-slate-500">
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
        <div className="text-[11px] text-slate-500 italic">Načítám…</div>
      ) : loadError ? (
        <div className="rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] px-2.5 py-1.5">
          {loadError}
        </div>
      ) : versions.length === 0 ? (
        <div className="text-[11px] text-slate-500 italic">
          Žádné MD verze. Spuštěním OCR se vytvoří první verze.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {versions.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="w-full flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-left hover:bg-slate-900 hover:border-slate-700 transition"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span className="rounded-full bg-slate-800 text-slate-300 px-2 py-0.5 text-[10px] font-semibold">
                    v{v.versionNo}
                  </span>
                  <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold">
                    {SOURCE_KIND_LABEL[v.sourceKind]}
                  </span>
                  <span className="text-xs text-slate-200 truncate">
                    {v.sourceFileName || 'dokument.md'}
                  </span>
                </div>
                <span className="text-[10.5px] text-slate-500 whitespace-nowrap">
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
