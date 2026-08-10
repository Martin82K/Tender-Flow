import React, { useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { NumericInput } from '@/shared/ui/NumericInput';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import { MarkdownDocumentPanel } from '@/shared/contracts/MarkdownDocumentPanel';
import { contractMutationsApi } from '../api';
import { contractExtractionService } from '@/services/contractExtractionService';
import { buildContractUpdateFromOcr } from '../utils/contractOcrUpdate';
import {
  deleteContractWithDocuments,
  updateContractWithDocumentChange,
} from '../utils/contractCrud';
import { validateContractDocument } from '@/shared/contracts/contractDocument';
import type {
  Contract,
  ContractRetentionStatus,
  ContractStatus,
  ContractExtractionResult,
  ContractWithDetails,
} from '@/types';

interface Props {
  projectId: string;
  contract?: ContractWithDetails | null;
  onClose: () => void;
  onSaved: (warning?: string) => Promise<void> | void;
  onDeleted?: (warning?: string) => Promise<void> | void;
}

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary';
const numericInputClass =
  'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary';
const labelClass = 'block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1';

const toUndef = (v: number | null): number | undefined =>
  v === null || !Number.isFinite(v) ? undefined : v;

const averageConfidence = (confidence: Record<string, number>): number | undefined => {
  const values = Object.values(confidence).filter(
    (value) => typeof value === 'number' && Number.isFinite(value),
  );
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const ContractEditDialog: React.FC<Props> = ({
  projectId,
  contract,
  onClose,
  onSaved,
  onDeleted,
}) => {
  const isEditing = Boolean(contract?.id);

  const [form, setForm] = useState({
    title: contract?.title ?? '',
    contractNumber: contract?.contractNumber ?? '',
    vendorName: contract?.vendorName ?? '',
    vendorIco: contract?.vendorIco ?? '',
    status: (contract?.status ?? 'draft') as ContractStatus,
    signedAt: contract?.signedAt?.slice(0, 10) ?? '',
    effectiveFrom: contract?.effectiveFrom?.slice(0, 10) ?? '',
    effectiveTo: contract?.effectiveTo?.slice(0, 10) ?? '',
    completionDate: contract?.completionDate?.slice(0, 10) ?? '',
    currency: contract?.currency ?? 'CZK',
    basePrice: (contract?.basePrice ?? null) as number | null,
    retentionShortPercent: (contract?.retentionShortPercent ?? null) as number | null,
    retentionShortAmount: (contract?.retentionShortAmount ?? null) as number | null,
    retentionShortReleaseOn: contract?.retentionShortReleaseOn?.slice(0, 10) ?? '',
    retentionShortStatus: (contract?.retentionShortStatus ?? 'held') as ContractRetentionStatus,
    retentionLongPercent: (contract?.retentionLongPercent ?? null) as number | null,
    retentionLongAmount: (contract?.retentionLongAmount ?? null) as number | null,
    retentionLongReleaseOn: contract?.retentionLongReleaseOn?.slice(0, 10) ?? '',
    retentionLongStatus: (contract?.retentionLongStatus ?? 'held') as ContractRetentionStatus,
    siteSetupPercent: (contract?.siteSetupPercent ?? null) as number | null,
    warrantyMonths: (contract?.warrantyMonths ?? null) as number | null,
    paymentTerms: contract?.paymentTerms ?? '',
    scopeSummary: contract?.scopeSummary ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('');
  const [ocrResult, setOcrResult] = useState<ContractExtractionResult | null>(null);
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [attachOriginal, setAttachOriginal] = useState(true);
  const [ocrAppliedFields, setOcrAppliedFields] = useState<string[]>([]);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [removeDocument, setRemoveDocument] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleChange = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleOcrFile = async (file: File) => {
    setError(null);
    setOcrBusy(true);
    setOcrStatus('Kontroluji dokument…');
    setOcrResult(null);
    try {
      await validateContractDocument(file);
      setOcrFile(file);
      setAttachOriginal(true);
      const result = await contractExtractionService.extractFromDocument(file, setOcrStatus);
      const { updates, appliedFields } = buildContractUpdateFromOcr(result);
      setForm((previous) => ({
        ...previous,
        title: updates.title ?? previous.title,
        contractNumber: updates.contractNumber ?? previous.contractNumber,
        vendorName: updates.vendorName ?? previous.vendorName,
        vendorIco: updates.vendorIco ?? previous.vendorIco,
        signedAt: updates.signedAt ?? previous.signedAt,
        effectiveFrom: updates.effectiveFrom ?? previous.effectiveFrom,
        effectiveTo: updates.effectiveTo ?? previous.effectiveTo,
        completionDate: updates.completionDate ?? previous.completionDate,
        currency: updates.currency ?? previous.currency,
        basePrice: updates.basePrice ?? previous.basePrice,
        retentionShortPercent:
          updates.retentionShortPercent ?? updates.retentionPercent ?? previous.retentionShortPercent,
        retentionLongPercent: updates.retentionLongPercent ?? previous.retentionLongPercent,
        siteSetupPercent: updates.siteSetupPercent ?? previous.siteSetupPercent,
        warrantyMonths: updates.warrantyMonths ?? previous.warrantyMonths,
        paymentTerms: updates.paymentTerms ?? previous.paymentTerms,
        scopeSummary: updates.scopeSummary ?? previous.scopeSummary,
      }));
      setOcrAppliedFields(appliedFields);
      setOcrResult(result);
      setOcrStatus('OCR dokončeno. Zkontrolujte předvyplněné hodnoty.');
    } catch (ocrError) {
      setError(ocrError instanceof Error ? ocrError.message : 'OCR zpracování selhalo.');
      setOcrStatus('');
    } finally {
      setOcrBusy(false);
    }
  };

  const handleReplacementFile = async (file: File) => {
    setError(null);
    try {
      await validateContractDocument(file);
      setReplacementFile(file);
      setRemoveDocument(false);
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : 'Vybranou přílohu nelze použít.',
      );
    }
  };

  const handleDelete = async () => {
    if (!contract || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const result = await deleteContractWithDocuments(contract);
      setDeleteConfirmOpen(false);
      await (onDeleted ?? onSaved)(result.cleanupWarning ?? undefined);
    } catch (deleteError) {
      setDeleteConfirmOpen(false);
      setError(
        deleteError instanceof Error ? deleteError.message : 'Smlouvu se nepodařilo smazat.',
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.vendorName.trim()) {
      setError('Název smlouvy a dodavatel jsou povinní.');
      return;
    }

    if (ocrBusy) {
      setError('Počkejte prosím na dokončení OCR.');
      return;
    }

    setSubmitting(true);
    setError(null);
    let uploadedStoragePath: string | undefined;
    let createdContractId: string | undefined;
    try {
      const documentMetadata =
        !isEditing && ocrFile && attachOriginal
          ? await contractMutationsApi.uploadContractDocument(ocrFile, projectId)
          : {};
      uploadedStoragePath = documentMetadata.documentStoragePath;
      const payload = {
        projectId,
        vendorName: form.vendorName,
        vendorIco: form.vendorIco.trim() || undefined,
        title: form.title,
        contractNumber: form.contractNumber || undefined,
        status: form.status,
        signedAt: form.signedAt || undefined,
        effectiveFrom: form.effectiveFrom || undefined,
        effectiveTo: form.effectiveTo || undefined,
        completionDate: form.completionDate || undefined,
        currency: form.currency,
        basePrice: toUndef(form.basePrice) ?? 0,
        retentionShortPercent: toUndef(form.retentionShortPercent),
        retentionShortAmount: toUndef(form.retentionShortAmount),
        retentionShortReleaseOn: form.retentionShortReleaseOn || undefined,
        retentionShortStatus: form.retentionShortStatus,
        retentionLongPercent: toUndef(form.retentionLongPercent),
        retentionLongAmount: toUndef(form.retentionLongAmount),
        retentionLongReleaseOn: form.retentionLongReleaseOn || undefined,
        retentionLongStatus: form.retentionLongStatus,
        siteSetupPercent: toUndef(form.siteSetupPercent),
        warrantyMonths:
          form.warrantyMonths !== null && Number.isFinite(form.warrantyMonths)
            ? Math.round(form.warrantyMonths)
            : undefined,
        paymentTerms: form.paymentTerms || undefined,
        scopeSummary: form.scopeSummary || undefined,
        source: isEditing
          ? contract?.source || 'manual'
          : ocrResult
            ? 'ai_extracted' as const
            : 'manual' as const,
        ...documentMetadata,
        extractionConfidence: ocrResult
          ? averageConfidence(ocrResult.confidence)
          : contract?.extractionConfidence,
        extractionJson: ocrResult
          ? {
              fields: ocrResult.fields,
              confidence: ocrResult.confidence,
              appliedContractFields: ocrAppliedFields,
              ocrProvider: ocrResult.ocrProvider,
              ocrModel: ocrResult.ocrModel,
              sourceFileName: ocrResult.sourceFileName,
              extractedAt: new Date().toISOString(),
            }
          : contract?.extractionJson,
      } satisfies Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>;

      if (isEditing && contract) {
        const result = await updateContractWithDocumentChange({
          contract,
          updates: payload,
          replacementFile,
          removeDocument,
        });
        await onSaved(result.cleanupWarning ?? undefined);
      } else {
        const created = await contractMutationsApi.createContract(payload);
        createdContractId = created.id;
        if (ocrResult?.rawText?.trim()) {
          try {
            await contractMutationsApi.createMarkdownVersion({
              entityType: 'contract',
              contractId: created.id,
              sourceKind: 'ocr',
              contentMd: ocrResult.rawText,
              sourceFileName: ocrResult.sourceFileName || ocrFile?.name,
              ocrProvider: ocrResult.ocrProvider,
              ocrModel: ocrResult.ocrModel,
              metadata: { confidence: ocrResult.confidence },
            });
          } catch (markdownError) {
            console.error('Contract OCR markdown save failed:', markdownError);
          }
        }
        await onSaved();
      }
    } catch (err) {
      if (uploadedStoragePath && !createdContractId) {
        await contractMutationsApi.deleteContractDocument(uploadedStoragePath);
      }
      setError(err instanceof Error ? err.message : 'Nepodařilo se uložit smlouvu');
    } finally {
      setSubmitting(false);
    }
  };

  const showOcrPanel = isEditing && contract;
  const hasStoredDocument = Boolean(contract?.documentStoragePath || contract?.documentUrl);

  return (
    <>
    <Modal
      isOpen
      onClose={onClose}
      title={isEditing ? 'Upravit smlouvu' : 'Nová smlouva'}
      size={showOcrPanel ? 'full' : '2xl'}
    >
      <div
        className={
          showOcrPanel
            ? 'grid grid-cols-1 lg:grid-cols-2 gap-5 h-[78vh]'
            : ''
        }
      >
        {showOcrPanel && (
          <div className="min-h-0 overflow-hidden">
            <MarkdownDocumentPanel
              entityType="contract"
              entityId={contract.id}
              entityLabel={contract.title || contract.vendorName || 'Smlouva'}
              editable={false}
              fitParent
              enableSearch
            />
          </div>
        )}
        <div className={showOcrPanel ? 'overflow-y-auto pr-1' : ''}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2">
            {error}
          </div>
        )}

        {!isEditing ? (
          <section className="rounded-xl border border-primary/25 bg-primary/5 p-4" data-help-id="contract-create-ocr">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Předvyplnit smlouvu z OCR
                </div>
                <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  Nahrajte PDF nebo DOCX. Smlouvu lze uložit až po dokončení zpracování.
                </div>
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-primary/40 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10">
                {ocrBusy ? 'Zpracovávám…' : ocrResult ? 'Načíst jiný dokument' : 'Nahrát smlouvu přes OCR'}
                <input
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  disabled={ocrBusy || submitting}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleOcrFile(file);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
            {ocrStatus ? (
              <div className="mt-3 text-xs text-primary" role="status">{ocrStatus}</div>
            ) : null}
            {ocrFile && !ocrBusy ? (
              <label className="mt-3 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={attachOriginal}
                  disabled={ocrBusy || submitting}
                  onChange={(event) => setAttachOriginal(event.target.checked)}
                  className="accent-primary"
                />
                Připojit originální soubor ke smlouvě
                <span className="truncate text-slate-500">({ocrFile.name})</span>
              </label>
            ) : null}
          </section>
        ) : null}

        {isEditing && contract ? (
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Příloha smlouvy
            </div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {replacementFile
                ? `Po uložení bude připojen soubor ${replacementFile.name}.`
                : removeDocument
                  ? 'Po uložení bude současná příloha odpojena a odstraněna.'
                  : hasStoredDocument
                    ? contract.documentFileName || 'Smlouva obsahuje připojený dokument.'
                    : 'Smlouva zatím nemá připojený dokument.'}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-primary/40 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10">
                {hasStoredDocument ? 'Nahradit přílohu' : 'Připojit přílohu'}
                <input
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  aria-label={hasStoredDocument ? 'Nahradit přílohu smlouvy' : 'Připojit přílohu smlouvy'}
                  disabled={submitting || deleting}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) void handleReplacementFile(file);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
              {hasStoredDocument && !removeDocument ? (
                <button
                  type="button"
                  onClick={() => {
                    setReplacementFile(null);
                    setRemoveDocument(true);
                  }}
                  disabled={submitting || deleting}
                  className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  Odpojit a smazat přílohu
                </button>
              ) : null}
              {replacementFile || removeDocument ? (
                <button
                  type="button"
                  onClick={() => {
                    setReplacementFile(null);
                    setRemoveDocument(false);
                  }}
                  disabled={submitting || deleting}
                  className="rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-slate-200 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Zrušit změnu přílohy
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Název smlouvy *</label>
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Číslo smlouvy</label>
            <input
              className={inputClass}
              value={form.contractNumber}
              onChange={(e) => handleChange('contractNumber', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Dodavatel *</label>
            <input
              className={inputClass}
              value={form.vendorName}
              onChange={(e) => handleChange('vendorName', e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>IČ</label>
            <input
              className={inputClass}
              value={form.vendorIco}
              onChange={(e) => handleChange('vendorIco', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Stav</label>
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => handleChange('status', e.target.value as ContractStatus)}
            >
              <option value="draft">Rozpracováno</option>
              <option value="active">Aktivní</option>
              <option value="closed">Uzavřeno</option>
              <option value="cancelled">Zrušeno</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Datum podpisu</label>
            <input
              type="date"
              className={inputClass}
              value={form.signedAt}
              onChange={(e) => handleChange('signedAt', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Účinnost od</label>
            <input
              type="date"
              className={inputClass}
              value={form.effectiveFrom}
              onChange={(e) => handleChange('effectiveFrom', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Účinnost do</label>
            <input
              type="date"
              className={inputClass}
              value={form.effectiveTo}
              onChange={(e) => handleChange('effectiveTo', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Termín dokončení díla</label>
            <input
              type="date"
              className={inputClass}
              value={form.completionDate}
              onChange={(e) => handleChange('completionDate', e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-500">Počátek záruční doby (předání díla).</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Cena díla (bez DPH)</label>
            <NumericInput
              value={form.basePrice}
              onChange={(v) => handleChange('basePrice', v)}
              allowNegative={false}
              maxFractionDigits={2}
              className={numericInputClass}
              suffix={form.currency}
            />
          </div>
          <div>
            <label className={labelClass}>Měna</label>
            <select
              className={inputClass}
              value={form.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
            >
              <option value="CZK">CZK</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Zařízení staveniště (%)</label>
            <NumericInput
              value={form.siteSetupPercent}
              onChange={(v) => handleChange('siteSetupPercent', v)}
              allowNegative={false}
              maxFractionDigits={2}
              className={numericInputClass}
              suffix="%"
            />
          </div>
        </div>

        <fieldset
          data-help-id="contracts-retention-fields"
          className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
        >
          <legend className="px-2 text-xs uppercase tracking-wider text-slate-500">
            Pozastávky — samostatná pole
          </legend>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              data-help-id="contracts-retention-short"
              className="rounded-lg border-l-[3px] border-l-blue-500 bg-slate-50 dark:bg-slate-900/40 p-3 space-y-2"
            >
              <div className="text-xs font-semibold text-blue-500">
                Krátkodobá — do převzetí
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>%</label>
                  <NumericInput
                    value={form.retentionShortPercent}
                    onChange={(v) => handleChange('retentionShortPercent', v)}
                    allowNegative={false}
                    maxFractionDigits={2}
                    className={numericInputClass}
                    placeholder="7"
                    suffix="%"
                  />
                </div>
                <div>
                  <label className={labelClass}>Částka</label>
                  <NumericInput
                    value={form.retentionShortAmount}
                    onChange={(v) => handleChange('retentionShortAmount', v)}
                    allowNegative={false}
                    maxFractionDigits={2}
                    className={numericInputClass}
                    placeholder="vypočítá se"
                    suffix={form.currency}
                  />
                </div>
                <div>
                  <label className={labelClass}>Uvolnění</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.retentionShortReleaseOn}
                    onChange={(e) => handleChange('retentionShortReleaseOn', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Stav</label>
                  <select
                    className={inputClass}
                    value={form.retentionShortStatus}
                    onChange={(e) =>
                      handleChange('retentionShortStatus', e.target.value as ContractRetentionStatus)
                    }
                  >
                    <option value="held">Drží se</option>
                    <option value="released">Uvolněno</option>
                  </select>
                </div>
              </div>
            </div>

            <div
              data-help-id="contracts-retention-long"
              className="rounded-lg border-l-[3px] border-l-purple-500 bg-slate-50 dark:bg-slate-900/40 p-3 space-y-2"
            >
              <div className="text-xs font-semibold text-purple-500">
                Dlouhodobá — do konce záruky
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>%</label>
                  <NumericInput
                    value={form.retentionLongPercent}
                    onChange={(v) => handleChange('retentionLongPercent', v)}
                    allowNegative={false}
                    maxFractionDigits={2}
                    className={numericInputClass}
                    placeholder="3"
                    suffix="%"
                  />
                </div>
                <div>
                  <label className={labelClass}>Částka</label>
                  <NumericInput
                    value={form.retentionLongAmount}
                    onChange={(v) => handleChange('retentionLongAmount', v)}
                    allowNegative={false}
                    maxFractionDigits={2}
                    className={numericInputClass}
                    placeholder="vypočítá se"
                    suffix={form.currency}
                  />
                </div>
                <div>
                  <label className={labelClass}>Uvolnění</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.retentionLongReleaseOn}
                    onChange={(e) => handleChange('retentionLongReleaseOn', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Stav</label>
                  <select
                    className={inputClass}
                    value={form.retentionLongStatus}
                    onChange={(e) =>
                      handleChange('retentionLongStatus', e.target.value as ContractRetentionStatus)
                    }
                  >
                    <option value="held">Drží se</option>
                    <option value="released">Uvolněno</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Hodnoty se ukládají samostatně, nesčítají se. Dlouhodobá drží až do konce záruční doby.
          </p>
        </fieldset>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Záruční doba (měsíce)</label>
            <NumericInput
              value={form.warrantyMonths}
              onChange={(v) => handleChange('warrantyMonths', v)}
              allowNegative={false}
              maxFractionDigits={0}
              className={numericInputClass}
              suffix="měs."
            />
          </div>
          <div>
            <label className={labelClass}>Splatnost</label>
            <input
              className={inputClass}
              value={form.paymentTerms}
              onChange={(e) => handleChange('paymentTerms', e.target.value)}
              placeholder="30 dní od doručení faktury"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Předmět díla</label>
          <textarea
            className={`${inputClass} resize-none`}
            rows={3}
            value={form.scopeSummary}
            onChange={(e) => handleChange('scopeSummary', e.target.value)}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          {isEditing ? (
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={submitting || deleting}
              className="mr-auto px-4 py-2 text-sm font-semibold rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              Smazat smlouvu
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Zrušit
          </button>
          <button
            type="submit"
            disabled={submitting || ocrBusy}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-primary/40 text-primary hover:bg-primary/10 hover:border-primary transition disabled:opacity-50"
          >
            {ocrBusy ? 'Čekám na OCR…' : submitting ? 'Ukládám…' : isEditing ? 'Uložit změny' : 'Vytvořit smlouvu'}
          </button>
        </div>
      </form>
        </div>
      </div>
    </Modal>
    <ConfirmationModal
      isOpen={deleteConfirmOpen}
      title="Smazat smlouvu?"
      message={`Opravdu chcete smazat smlouvu „${contract?.title || ''}“ včetně jejích dodatků, faktur a připojených souborů? Tuto akci nelze vrátit.`}
      confirmLabel={deleting ? 'Mažu…' : 'Smazat'}
      onCancel={() => setDeleteConfirmOpen(false)}
      onConfirm={() => void handleDelete()}
      variant="danger"
    />
    </>
  );
};
