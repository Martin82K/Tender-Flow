import React from 'react';
import type { ContractWithDetails } from '@/types';
import { daysUntil } from '../utils/format';

export type ContractFilterKey =
  | 'all'
  | 'active'
  | 'closed'
  | 'amend'
  | 'unbilled'
  | 'warranty'
  | 'overdue';

const FILTERS: { key: ContractFilterKey; label: string }[] = [
  { key: 'all', label: 'Vše' },
  { key: 'active', label: 'Aktivní' },
  { key: 'closed', label: 'Uzavřené' },
  { key: 'amend', label: 'S dodatky' },
  { key: 'unbilled', label: 'Nedofakturováno' },
  { key: 'warranty', label: 'Záruka do 60 dní' },
  { key: 'overdue', label: 'Po splatnosti' },
];

export const applyContractFilter = (
  contract: ContractWithDetails,
  filter: ContractFilterKey,
): boolean => {
  switch (filter) {
    case 'all':
      return true;
    case 'active':
      return contract.status === 'active';
    case 'closed':
      return contract.status === 'closed';
    case 'amend':
      return (contract.amendments?.length || 0) > 0;
    case 'unbilled':
      return (
        contract.currentTotal > 0 && (contract.invoicedSum || 0) < contract.currentTotal
      );
    case 'warranty': {
      if (!contract.signedAt || !contract.warrantyMonths) return false;
      const signed = new Date(contract.signedAt);
      if (Number.isNaN(signed.getTime())) return false;
      signed.setMonth(signed.getMonth() + contract.warrantyMonths);
      const d = daysUntil(signed.toISOString().slice(0, 10));
      return d !== null && d >= 0 && d <= 60;
    }
    case 'overdue':
      return (contract.overdueSum || 0) > 0;
    default:
      return true;
  }
};

interface Props {
  active: ContractFilterKey;
  onChange: (key: ContractFilterKey) => void;
  counts?: Partial<Record<ContractFilterKey, number>>;
}

export const ContractFilters: React.FC<Props> = ({ active, onChange, counts }) => (
  <div className="flex flex-wrap gap-1.5">
    {FILTERS.map((f) => {
      const count = counts?.[f.key];
      const isActive = active === f.key;
      return (
        <button
          key={f.key}
          type="button"
          onClick={() => onChange(f.key)}
          className={`px-3 py-1 rounded-full text-[11px] font-medium border transition ${
            isActive
              ? 'bg-primary/15 border-primary text-primary'
              : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800'
          }`}
        >
          {f.label}
          {count !== undefined && (
            <span className="ml-1.5 text-[10px] opacity-70">{count}</span>
          )}
        </button>
      );
    })}
  </div>
);
