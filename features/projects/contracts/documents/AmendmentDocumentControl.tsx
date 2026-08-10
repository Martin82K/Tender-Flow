import React, { useState } from 'react';
import { contractQueriesApi } from '../api';
import { attachAmendmentDocument } from '../utils/attachAmendmentDocument';
import type { ContractAmendment } from '@/types';

interface Props {
  amendment: ContractAmendment;
  projectId: string;
  onChanged: () => Promise<void> | void;
  compact?: boolean;
}

export const AmendmentDocumentControl: React.FC<Props> = ({
  amendment,
  projectId,
  onChanged,
  compact = false,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasDocument = Boolean(amendment.documentStoragePath || amendment.documentUrl);
  const isPdf = amendment.documentMimeType === 'application/pdf'
    || amendment.documentFileName?.toLowerCase().endsWith('.pdf');

  const handleAttach = async (file: File) => {
    if (hasDocument || busy) return;
    setBusy(true);
    setError(null);
    try {
      await attachAmendmentDocument({ amendmentId: amendment.id, projectId, file });
      await onChanged();
    } catch (attachError) {
      setError(
        attachError instanceof Error
          ? attachError.message
          : 'Dokument dodatku se nepodařilo připojit.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = async () => {
    setError(null);
    try {
      await contractQueriesApi.openAmendmentDocument(amendment);
    } catch (openError) {
      setError(
        openError instanceof Error
          ? openError.message
          : 'Dokument dodatku se nepodařilo otevřít.',
      );
    }
  };

  return (
    <div
      className={compact ? 'inline-flex flex-col items-start gap-1' : 'flex flex-col items-start gap-1'}
      onClick={(event) => event.stopPropagation()}
    >
      {hasDocument ? (
        <button
          type="button"
          onClick={() => void handleOpen()}
          aria-label={`Otevřít dokument dodatku č. ${amendment.amendmentNo}`}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold ${
            isPdf
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
              : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300'
          }`}
        >
          <span className="material-symbols-outlined text-[15px]">description</span>
          {isPdf ? 'PDF' : 'DOCX'}
        </button>
      ) : busy ? (
        <span className="text-[10px] font-semibold text-primary" role="status">
          Připojuji…
        </span>
      ) : (
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/10">
          <span className="material-symbols-outlined text-[15px]">attach_file</span>
          Připojit
          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            aria-label={`Připojit dokument k dodatku č. ${amendment.amendmentNo}`}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void handleAttach(file);
              event.currentTarget.value = '';
            }}
          />
        </label>
      )}
      {error ? <span className="text-[10px] text-red-600 dark:text-red-400">{error}</span> : null}
    </div>
  );
};
