import React, { useMemo } from 'react';
import type { Bid, ContractWithDetails } from '@/types';
import { resolveBidContractLink } from '../model/contractBidLink';

interface Props {
  bid: Bid;
  contracts: ContractWithDetails[];
  onOpenContract: (contractId: string) => void;
  onToggleContracted: (bid: Bid) => void;
  loading?: boolean;
  error?: string | null;
}

export const WinnerContractButton: React.FC<Props> = ({
  bid,
  contracts,
  onOpenContract,
  onToggleContracted,
  loading = false,
  error = null,
}) => {
  const link = useMemo(
    () => resolveBidContractLink(bid, contracts),
    [bid, contracts],
  );

  if (loading || error) {
    const label = loading ? 'Načítám smlouvu vítěze' : 'Smlouvu vítěze se nepodařilo načíst';
    return (
      <button
        type="button"
        disabled
        aria-label={label}
        title={error || label}
        className="absolute -top-2 right-6 z-10 rounded-full bg-slate-500 p-1 text-white shadow-sm opacity-80"
      >
        <span className={`material-symbols-outlined block text-[16px] ${loading ? 'animate-spin' : ''}`}>
          {loading ? 'progress_activity' : 'error'}
        </span>
      </button>
    );
  }

  if (link.ambiguous) {
    return (
      <button
        type="button"
        disabled
        aria-label="Více smluv odpovídá tomuto vítězi"
        title="Více smluv odpovídá tomuto vítězi. Otevřete seznam smluv a vazbu upřesněte."
        className="absolute -top-2 right-6 z-10 rounded-full bg-amber-500 p-1 text-amber-950 shadow-sm opacity-80"
      >
        <span className="material-symbols-outlined block text-[16px]">warning</span>
      </button>
    );
  }

  if (link.contract) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpenContract(link.contract!.id);
        }}
        aria-label={`Otevřít smlouvu ${link.contract.title}`}
        title={`Otevřít smlouvu: ${link.contract.title}`}
        className="absolute -top-2 right-6 z-10 rounded-full bg-emerald-500 p-1 text-white shadow-sm transition-all hover:scale-110 hover:bg-emerald-400"
      >
        <span className="material-symbols-outlined block text-[16px]">open_in_new</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggleContracted(bid);
      }}
      aria-label={bid.contracted ? 'Zasmluvněno' : 'Označit jako zasmluvněno'}
      title={bid.contracted ? 'Zasmluvněno ✓' : 'Označit jako zasmluvněno'}
      className={`absolute -top-2 right-6 z-10 rounded-full p-1 shadow-sm transition-all hover:scale-110 ${
        bid.contracted
          ? 'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-300 animate-pulse'
          : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
      }`}
    >
      <span className="material-symbols-outlined block text-[16px]">
        {bid.contracted ? 'task_alt' : 'description'}
      </span>
    </button>
  );
};
