import React from 'react';
import type { ContractWithDetails } from '@/types';
import { contractService } from '@/services/contractService';
import { computeRetention } from '../../utils/retention';
import { formatDate, formatMoney } from '../../utils/format';

interface Props {
  contract: ContractWithDetails;
  onRefresh: () => Promise<void> | void;
}

const statusPill = (status: 'held' | 'released' | undefined, percent: number) => {
  if (percent === 0) {
    return (
      <span className="inline-block rounded-full bg-green-500/15 text-green-400 px-2 py-0.5 text-[10.5px] font-semibold">
        neuplatňuje se
      </span>
    );
  }
  if (status === 'released') {
    return (
      <span className="inline-block rounded-full bg-green-500/15 text-green-400 px-2 py-0.5 text-[10.5px] font-semibold">
        uvolněno
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full bg-amber-500/15 text-amber-400 px-2 py-0.5 text-[10.5px] font-semibold">
      drží se
    </span>
  );
};

export const RetentionSection: React.FC<Props> = ({ contract, onRefresh }) => {
  const breakdown = computeRetention(contract);

  const release = async (kind: 'short' | 'long') => {
    try {
      await contractService.releaseRetention(contract.id, kind);
      await onRefresh();
    } catch (err) {
      console.error('Failed to release retention', err);
    }
  };

  return (
    <section id="sec-poz" className="py-4 border-b border-dashed border-slate-800">
      <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-3 flex items-center gap-2">
        Pozastávky
        <span className="text-[10px] normal-case tracking-normal text-slate-400 rounded-full bg-slate-800 px-2 py-0.5">
          KRÁTKODOBÁ + DLOUHODOBÁ
        </span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-950/60 border border-slate-800 border-l-[3px] border-l-blue-500 p-4 flex flex-col gap-1.5">
          <h4 className="flex items-center justify-between text-xs font-semibold text-slate-300 m-0">
            Krátkodobá pozastávka
            <span className="rounded-full bg-blue-500/15 text-blue-400 px-2 py-0.5 text-[10.5px] font-semibold">
              do převzetí
            </span>
          </h4>
          <div className="text-3xl font-bold text-slate-100 tabular-nums">
            {breakdown.shortPercent} %
          </div>
          <div className="text-sm text-slate-400 tabular-nums">
            {formatMoney(breakdown.shortAmount, contract.currency)}
          </div>
          <div className="flex justify-between items-center mt-1 text-xs text-slate-400">
            <span>Očekávané uvolnění</span>
            <strong className="text-slate-200">
              {formatDate(contract.retentionShortReleaseOn) || 'po převzetí díla'}
            </strong>
          </div>
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Stav</span>
            {statusPill(contract.retentionShortStatus, breakdown.shortPercent)}
          </div>
          {breakdown.shortPercent > 0 && contract.retentionShortStatus !== 'released' && (
            <button
              type="button"
              onClick={() => release('short')}
              className="mt-2 w-fit px-3 py-1 text-xs rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300"
            >
              Označit jako uvolněnou
            </button>
          )}
        </div>

        <div className="rounded-xl bg-slate-950/60 border border-slate-800 border-l-[3px] border-l-purple-500 p-4 flex flex-col gap-1.5">
          <h4 className="flex items-center justify-between text-xs font-semibold text-slate-300 m-0">
            Dlouhodobá pozastávka
            <span className="rounded-full bg-purple-500/15 text-purple-400 px-2 py-0.5 text-[10.5px] font-semibold">
              do konce záruky
            </span>
          </h4>
          <div className="text-3xl font-bold text-slate-100 tabular-nums">
            {breakdown.longPercent} %
          </div>
          <div className="text-sm text-slate-400 tabular-nums">
            {formatMoney(breakdown.longAmount, contract.currency)}
          </div>
          <div className="flex justify-between items-center mt-1 text-xs text-slate-400">
            <span>Uvolnění (záruka)</span>
            <strong className="text-slate-200">{formatDate(contract.retentionLongReleaseOn)}</strong>
          </div>
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Stav</span>
            {statusPill(contract.retentionLongStatus, breakdown.longPercent)}
          </div>
          {breakdown.longPercent > 0 && contract.retentionLongStatus !== 'released' && (
            <button
              type="button"
              onClick={() => release('long')}
              className="mt-2 w-fit px-3 py-1 text-xs rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300"
            >
              Označit jako uvolněnou
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 px-3 py-2 rounded-lg bg-slate-950/60 border border-dashed border-slate-800 flex justify-between text-xs text-slate-300">
        <span>Celkem pozastávka</span>
        <strong className="tabular-nums">
          {breakdown.totalPercent} % · {formatMoney(breakdown.totalAmount, contract.currency)}
        </strong>
      </div>
      <p className="text-[11.5px] text-slate-500 mt-2">
        Hodnoty jsou ukládány <strong>samostatně</strong>, nesčítají se do jednoho políčka. OCR parser
        hledá dvojici a každé hodnotě přiřadí vlastní confidence.
      </p>
    </section>
  );
};
