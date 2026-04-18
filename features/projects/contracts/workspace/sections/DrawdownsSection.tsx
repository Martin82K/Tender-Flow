import React from 'react';
import type { ContractWithDetails } from '@/types';
import { formatMoney } from '../../utils/format';

export const DrawdownsSection: React.FC<{ contract: ContractWithDetails }> = ({ contract }) => {
  const invoiced = contract.invoicedSum || 0;
  const percentage = contract.currentTotal > 0
    ? Math.min(100, Math.round((invoiced / contract.currentTotal) * 100))
    : 0;
  const remaining = Math.max(0, contract.currentTotal - invoiced);

  return (
    <section id="sec-cerpani" className="py-4 border-b border-dashed border-slate-800">
      <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-3">
        Čerpání
      </h3>

      <div className="flex flex-wrap gap-4 mb-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Hodnota smlouvy</div>
          <div className="text-sm font-semibold text-slate-100 tabular-nums">
            {formatMoney(contract.currentTotal, contract.currency)}
          </div>
        </div>
        <div className="w-px bg-slate-800 self-stretch" />
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Vyčerpáno</div>
          <div className="text-sm font-semibold text-green-400 tabular-nums">
            {formatMoney(invoiced, contract.currency)}
          </div>
        </div>
        <div className="w-px bg-slate-800 self-stretch" />
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Zbývá</div>
          <div className="text-sm font-semibold text-slate-100 tabular-nums">
            {formatMoney(remaining, contract.currency)}
          </div>
        </div>
      </div>

      <div className="h-2 rounded bg-slate-800 overflow-hidden">
        <span
          className="block h-full bg-gradient-to-r from-amber-500 to-green-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-[11.5px] text-slate-500 mt-2">
        Čerpání se počítá automaticky z fakturace po jejím schválení.
      </p>

      {contract.drawdowns.length > 0 && (
        <table className="w-full text-xs mt-3">
          <thead>
            <tr className="border-b border-slate-800 text-[10.5px] uppercase tracking-wider text-slate-500">
              <th className="text-left px-2.5 py-2">Období</th>
              <th className="text-right px-2.5 py-2">Požadováno</th>
              <th className="text-right px-2.5 py-2">Schváleno</th>
              <th className="text-left px-2.5 py-2">Poznámka</th>
            </tr>
          </thead>
          <tbody>
            {contract.drawdowns.map((d) => (
              <tr key={d.id} className="border-b border-slate-800">
                <td className="px-2.5 py-2 text-slate-200">{d.period}</td>
                <td className="px-2.5 py-2 text-right tabular-nums text-slate-300">
                  {formatMoney(d.claimedAmount, contract.currency)}
                </td>
                <td className="px-2.5 py-2 text-right tabular-nums text-green-400">
                  {formatMoney(d.approvedAmount, contract.currency)}
                </td>
                <td className="px-2.5 py-2 text-slate-400">{d.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};
