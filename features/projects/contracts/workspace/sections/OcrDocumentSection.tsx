import React, { useMemo, useRef, useState } from 'react';
import type { ContractAmendment, ContractWithDetails } from '@/types';
import { contractService } from '@/services/contractService';
import { contractExtractionService } from '@/services/contractExtractionService';
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
    setStatus('Nahrávám dokument…');
    try {
      const documentUrl = await contractService.uploadContractDocument(file, contract.id);
      setStatus('Extrahuji text a strukturovaná data…');
      const result = await contractExtractionService.extractFromDocument(file, setStatus);
      await contractService.updateContract(contract.id, {
        documentUrl,
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
    setStatus('Nahrávám dokument dodatku…');
    try {
      const documentUrl = await contractService.uploadContractDocument(file, contract.id);
      setStatus('Extrahuji data dodatku…');
      const result = await contractExtractionService.extractAmendmentFromDocument(file);
      await contractService.updateAmendment(amendment.id, {
        documentUrl,
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
      </div>
    </section>
  );
};

const averageConfidence = (confidence: Record<string, unknown>): number | undefined => {
  const values = Object.values(confidence).filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  );
  if (values.length === 0) return undefined;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
};
