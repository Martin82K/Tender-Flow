import React, { useState } from 'react';
import type { ContractWithDetails } from '@/types';
import { StatusPill } from '../../list/StatusPill';
import { formatDate, formatMoney } from '../../utils/format';
import { VendorRatingDialog } from '../../forms/VendorRatingDialog';

const Star: React.FC<{ filled: boolean }> = ({ filled }) => (
  <span className={filled ? 'text-amber-400' : 'text-slate-700'}>{filled ? '★' : '☆'}</span>
);

interface Props {
  contract: ContractWithDetails;
  onChanged?: () => Promise<void> | void;
}

export const HeaderSection: React.FC<Props> = ({ contract, onChanged }) => {
  const rating = contract.vendorRating ?? 0;
  const [ratingOpen, setRatingOpen] = useState(false);

  return (
    <section id="sec-hlavicka" className="py-4 border-b border-dashed border-slate-800">
      <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-3">
        Hlavička
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Dodavatel</div>
          <div className="text-sm font-semibold text-slate-100">{contract.vendorName}</div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500">IČ</div>
          <div className="text-sm font-semibold text-slate-100">{contract.vendorIco || '—'}</div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Stav</div>
          <div className="mt-0.5">
            <StatusPill status={contract.status} />
          </div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500">
            Hodnota (po dodatcích)
          </div>
          <div className="text-sm font-semibold text-slate-100 tabular-nums">
            {formatMoney(contract.currentTotal, contract.currency)}
          </div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Datum podpisu</div>
          <div className="text-sm font-semibold text-slate-100">{formatDate(contract.signedAt)}</div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Hodnocení</div>
          <button
            type="button"
            onClick={() => setRatingOpen(true)}
            className="group mt-0.5 inline-flex items-center gap-2 text-sm tracking-[0.2em] rounded-md px-1.5 py-0.5 -ml-1.5 hover:bg-slate-800/60 transition-colors"
            aria-label="Upravit hodnocení dodavatele"
            title={
              contract.vendorRatingNote
                ? `Poznámka: ${contract.vendorRatingNote}`
                : 'Kliknutím upravit hodnocení'
            }
          >
            <span className="tabular-nums">
              {contract.vendorRating != null
                ? [1, 2, 3, 4, 5].map((n) => <Star key={n} filled={n <= rating} />)
                : (
                  <span className="text-slate-500 text-xs tracking-normal">Neohodnoceno</span>
                )}
            </span>
            <span className="material-symbols-outlined text-[14px] text-slate-500 group-hover:text-slate-300 tracking-normal">
              edit
            </span>
          </button>
        </div>
      </div>
      {ratingOpen && (
        <VendorRatingDialog
          contract={contract}
          onClose={() => setRatingOpen(false)}
          onSaved={async () => {
            setRatingOpen(false);
            await onChanged?.();
          }}
        />
      )}
    </section>
  );
};
