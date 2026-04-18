import React from 'react';
import type { ContractWithDetails } from '@/types';
import { addMonthsIso, daysUntil, formatDate, formatMoney } from '../../utils/format';
import { computeRetention } from '../../utils/retention';

export const WarrantySection: React.FC<{ contract: ContractWithDetails }> = ({ contract }) => {
  const warrantyEnd = addMonthsIso(contract.signedAt, contract.warrantyMonths ?? null);
  const d = daysUntil(warrantyEnd);
  const breakdown = computeRetention(contract);

  return (
    <section id="sec-zaruka" className="py-4 border-b border-dashed border-slate-800">
      <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-3">Záruka</h3>
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[180px] rounded-lg bg-slate-950/60 border border-slate-800 p-3">
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Začátek záruky</div>
          <div className="text-sm font-bold text-slate-100">{formatDate(contract.signedAt)}</div>
        </div>
        <div className="flex-1 min-w-[180px] rounded-lg bg-slate-950/60 border border-slate-800 p-3">
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Délka</div>
          <div className="text-sm font-bold text-slate-100">
            {contract.warrantyMonths ? `${contract.warrantyMonths} měsíců` : '—'}
          </div>
        </div>
        <div className="flex-1 min-w-[180px] rounded-lg bg-slate-950/60 border border-slate-800 border-l-[3px] border-l-amber-500 p-3">
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Konec záruky</div>
          <div className="text-sm font-bold text-slate-100">
            {formatDate(warrantyEnd)}{' '}
            {d !== null && (
              <span className="text-[11px] text-slate-500 font-normal">(za {d} dní)</span>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-[180px] rounded-lg bg-slate-950/60 border border-slate-800 p-3">
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500">
            Uvolnění poz. dlouh.
          </div>
          <div className="text-sm font-bold text-slate-100 tabular-nums">
            {formatMoney(breakdown.longAmount, contract.currency)}
          </div>
        </div>
      </div>
    </section>
  );
};
