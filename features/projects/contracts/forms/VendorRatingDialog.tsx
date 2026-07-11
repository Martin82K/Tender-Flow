import React, { useEffect, useRef, useState } from 'react';
import { useAuthIdentity } from '@shared/auth/AuthIdentityContext';
import { Modal } from '@/shared/ui/Modal';
import { StarRating } from '@/shared/ui/StarRating';
import { contractMutationsApi } from '../api';
import type { ContractWithDetails } from '@/types';

interface Props {
  contract: ContractWithDetails;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

type VendorRatingErrorCode =
  | 'CONTRACT_VENDOR_RATING_AUTH_REQUIRED'
  | 'CONTRACT_VENDOR_RATING_DEMO_READ_ONLY'
  | 'CONTRACT_VENDOR_RATING_SAVE_FAILED';

interface VendorRatingErrorState {
  userId: string;
  code: VendorRatingErrorCode;
  message: string;
}

const labelClass = 'block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1';
const inputClass =
  'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary';

const formatError = (code: VendorRatingErrorCode, message: string): string =>
  `${message} Kód chyby: ${code}`;

export const VendorRatingDialog: React.FC<Props> = ({ contract, onClose, onSaved }) => {
  const identity = useAuthIdentity();
  const normalizedUserId = identity?.id.trim() ?? '';
  const authError = !normalizedUserId
    ? formatError(
        'CONTRACT_VENDOR_RATING_AUTH_REQUIRED',
        'Pro úpravu hodnocení je nutné přihlášení.',
      )
    : identity?.role === 'demo'
      ? formatError(
          'CONTRACT_VENDOR_RATING_DEMO_READ_ONLY',
          'Demo režim je pouze pro čtení.',
        )
      : null;
  const activeUserId = authError ? null : normalizedUserId;
  const identityKey = activeUserId ?? `blocked:${identity?.role ?? 'anonymous'}:${normalizedUserId}`;
  const activeUserIdRef = useRef<string | null>(activeUserId);
  activeUserIdRef.current = activeUserId;
  const mountedRef = useRef(true);
  const previousIdentityKeyRef = useRef(identityKey);
  const [rating, setRating] = useState<number>(contract.vendorRating ?? 0);
  const [note, setNote] = useState<string>(contract.vendorRatingNote ?? '');
  const [submittingForUserId, setSubmittingForUserId] = useState<string | null>(null);
  const [error, setError] = useState<VendorRatingErrorState | null>(null);
  const submitting = activeUserId !== null && submittingForUserId === activeUserId;
  const visibleError =
    authError ??
    (error?.userId === activeUserId ? formatError(error.code, error.message) : null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (previousIdentityKeyRef.current === identityKey) return;
    previousIdentityKeyRef.current = identityKey;
    setRating(contract.vendorRating ?? 0);
    setNote(contract.vendorRatingNote ?? '');
    setSubmittingForUserId(null);
    setError(null);
    onClose();
  }, [contract.vendorRating, contract.vendorRatingNote, identityKey, onClose]);

  const updateRating = async (nextRating: number | null, nextNote: string | null) => {
    if (!activeUserId) return;
    const requestUserId = activeUserId;
    setSubmittingForUserId(requestUserId);
    setError(null);

    try {
      await contractMutationsApi.updateVendorRating(contract.id, {
        rating: nextRating,
        note: nextNote,
      });
      if (!mountedRef.current || activeUserIdRef.current !== requestUserId) return;
      await onSaved();
    } catch {
      if (mountedRef.current && activeUserIdRef.current === requestUserId) {
        setError({
          userId: requestUserId,
          code: 'CONTRACT_VENDOR_RATING_SAVE_FAILED',
          message: 'Hodnocení se nepodařilo uložit. Zkuste to prosím znovu.',
        });
      }
    } finally {
      if (mountedRef.current) {
        setSubmittingForUserId((current) =>
          current === requestUserId ? null : current,
        );
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await updateRating(rating > 0 ? rating : null, note.trim() || null);
  };

  const handleClear = async () => {
    await updateRating(null, null);
  };

  return (
    <Modal isOpen onClose={onClose} title={`Hodnocení dodavatele — ${contract.vendorName}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {visibleError && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2">
            {visibleError}
          </div>
        )}
        <div>
          <label className={labelClass}>Hvězdy (0–5)</label>
          <div className="flex items-center gap-3">
            <StarRating
              value={rating}
              onChange={setRating}
              allowClear
              readOnly={!activeUserId}
              size="md"
            />
            <span className="text-sm text-slate-500 tabular-nums">
              {rating > 0 ? `${rating} / 5` : 'Bez hodnocení'}
            </span>
          </div>
        </div>
        <div>
          <label className={labelClass}>Poznámka</label>
          <textarea
            rows={4}
            className={`${inputClass} resize-none`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={!activeUserId || submitting}
            placeholder="Kvalita, dodržení termínů, komunikace, závady v záruce…"
          />
        </div>
        {contract.vendorRatingAt && (
          <p className="text-[11px] text-slate-500">
            Poslední úprava: {new Date(contract.vendorRatingAt).toLocaleString('cs-CZ')}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={handleClear}
            disabled={
              !activeUserId ||
              submitting ||
              (contract.vendorRating == null && !contract.vendorRatingNote)
            }
            className="px-3 py-2 text-xs rounded-lg text-red-500 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Smazat hodnocení
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={!activeUserId || submitting}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-primary/40 text-primary hover:bg-primary/10 hover:border-primary transition disabled:opacity-50"
            >
              {submitting ? 'Ukládám…' : 'Uložit'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
