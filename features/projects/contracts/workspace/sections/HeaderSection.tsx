import React from 'react';
import type { ContractWithDetails } from '@/types';
import { StatusPill } from '../../list/StatusPill';
import { formatDate, formatMoney } from '../../utils/format';

const Star: React.FC<{ filled: boolean }> = ({ filled }) => (
  <span className={filled ? 'text-amber-400' : 'text-slate-700'}>{filled ? '★' : '☆'}</span>
);

export const HeaderSection: React.FC<{ contract: ContractWithDetails }> = ({ contract }) => {
  const rating = contract.vendorRating ?? 0;
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
          <div className="text-sm tabular-nums tracking-[0.2em]">
            {contract.vendorRating != null ? (
              [1, 2, 3, 4, 5].map((n) => <Star key={n} filled={n <= rating} />)
            ) : (
              <span className="text-slate-500 text-xs">Neohodnoceno</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
