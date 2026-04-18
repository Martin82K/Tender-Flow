import React from 'react';
import type { ContractWithDetails } from '@/types';
import { formatMoney, formatPercent } from '../../utils/format';

export const FinancialSection: React.FC<{ contract: ContractWithDetails }> = ({ contract }) => {
  const amendmentsDelta = (contract.currentTotal || 0) - (contract.basePrice || 0);
  return (
    <section id="sec-finance" className="py-4 border-b border-dashed border-slate-800">
      <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-3">
        Finanční údaje
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Cena díla (bez DPH)</div>
          <div className="text-sm font-semibold text-slate-100 tabular-nums">
            {formatMoney(contract.basePrice, contract.currency)}
          </div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Dodatky (rozdíl)</div>
          <div
            className={`text-sm font-semibold tabular-nums ${
              amendmentsDelta > 0 ? 'text-red-400' : 'text-slate-100'
            }`}
          >
            {amendmentsDelta > 0 ? '+' : ''}
            {formatMoney(amendmentsDelta, contract.currency)}
          </div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Hodnota po dodatcích</div>
          <div className="text-sm font-semibold text-slate-100 tabular-nums">
            {formatMoney(contract.currentTotal, contract.currency)}
          </div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Zařízení staveniště</div>
          <div className="text-sm font-semibold text-slate-100">
            {formatPercent(contract.siteSetupPercent)}
          </div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Záruční doba</div>
          <div className="text-sm font-semibold text-slate-100">
            {contract.warrantyMonths ? `${contract.warrantyMonths} měsíců` : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Splatnost</div>
          <div className="text-sm font-semibold text-slate-100">{contract.paymentTerms || '—'}</div>
        </div>
      </div>
    </section>
  );
};
