import React from 'react';
import type { ContractWithDetails } from '@/types';
import { addMonthsIso, daysUntil, formatDate, formatMoney } from '../../utils/format';
import { computeRetention } from '../../utils/retention';

export const WarrantySection: React.FC<{ contract: ContractWithDetails }> = ({ contract }) => {
  const warrantyStart = contract.completionDate || contract.signedAt;
  const usingSignedAtFallback = !contract.completionDate && Boolean(contract.signedAt);
  const warrantyEnd = addMonthsIso(warrantyStart, contract.warrantyMonths ?? null);
  const d = daysUntil(warrantyEnd);
  const breakdown = computeRetention(contract);

  return (
    <section id="sec-zaruka" className="py-4 border-b border-dashed border-slate-200 dark:border-slate-800">
      <h3 className="text-[11px] uppercase tracking-widest text-slate-600 dark:text-slate-500 font-bold mb-3">Záruka</h3>
      {usingSignedAtFallback && (
        <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
          Chybí termín dokončení díla. Záruka se počítá od data podpisu smlouvy — pro přesný výpočet doplňte termín dokončení ve smlouvě.
        </div>
      )}
      {!warrantyStart && (
        <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-600 dark:text-red-400">
          Chybí termín dokončení díla i datum podpisu — nelze spočítat záruční dobu.
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <div
          className={
            'flex-1 min-w-[180px] rounded-lg bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3' +
            (usingSignedAtFallback ? ' border-l-[3px] !border-l-amber-500' : '')
          }
        >
          <div className="text-[10.5px] uppercase tracking-wider text-slate-600 dark:text-slate-500">
            Začátek záruky {usingSignedAtFallback && <span className="text-amber-600 dark:text-amber-400">(dle podpisu)</span>}
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatDate(warrantyStart)}</div>
        </div>
        <div className="flex-1 min-w-[180px] rounded-lg bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3">
          <div className="text-[10.5px] uppercase tracking-wider text-slate-600 dark:text-slate-500">Délka</div>
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {contract.warrantyMonths ? `${contract.warrantyMonths} měsíců` : '—'}
          </div>
        </div>
        <div className="flex-1 min-w-[180px] rounded-lg bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 border-l-[3px] !border-l-amber-500 p-3">
          <div className="text-[10.5px] uppercase tracking-wider text-slate-600 dark:text-slate-500">Konec záruky</div>
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {formatDate(warrantyEnd)}{' '}
            {d !== null && (
              <span className="text-[11px] text-slate-600 dark:text-slate-500 font-normal">(za {d} dní)</span>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-[180px] rounded-lg bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3">
          <div className="text-[10.5px] uppercase tracking-wider text-slate-600 dark:text-slate-500">
            Uvolnění poz. dlouh.
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {formatMoney(breakdown.longAmount, contract.currency)}
          </div>
        </div>
      </div>
    </section>
  );
};
