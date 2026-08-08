import React from 'react';
import { AmendmentDocumentControl } from '../documents/AmendmentDocumentControl';
import { formatDate, formatMoney } from '../utils/format';
import type { ContractAmendment } from '@/types';
import type { ContractColumnId } from './contractTablePreferences';

interface Props {
  amendment: ContractAmendment;
  projectId: string;
  currency: string;
  columns: ContractColumnId[];
  onChanged: () => Promise<void> | void;
}

export const ContractAmendmentRow: React.FC<Props> = ({
  amendment,
  projectId,
  currency,
  columns,
  onChanged,
}) => (
  <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/40">
    {columns.map((column) => {
      switch (column) {
        case 'vendor':
          return (
            <td key={column} className="px-2.5 py-2 text-slate-800 dark:text-slate-200">
              <div className="flex items-center gap-1.5 pl-5 font-semibold">
                <span aria-hidden="true" className="text-slate-400">↳</span>
                Dodatek č. {amendment.amendmentNo}
              </div>
            </td>
          );
        case 'number':
          return (
            <td key={column} className="px-2.5 py-2 text-slate-600 dark:text-slate-400">
              <div>{formatDate(amendment.signedAt)}</div>
              <div className="whitespace-normal break-words text-[11px]">
                {amendment.reason || 'Bez uvedeného důvodu'}
              </div>
            </td>
          );
        case 'document':
          return (
            <td key={column} className="px-2.5 py-2">
              <AmendmentDocumentControl
                amendment={amendment}
                projectId={projectId}
                onChanged={onChanged}
                compact
              />
            </td>
          );
        case 'status':
          return (
            <td key={column} className="px-2.5 py-2">
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Dodatek
              </span>
            </td>
          );
        case 'total':
          return (
            <td
              key={column}
              className={`px-2.5 py-2 text-right font-semibold tabular-nums ${
                amendment.deltaPrice > 0
                  ? 'text-red-600 dark:text-red-400'
                  : amendment.deltaPrice < 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {amendment.deltaPrice > 0 ? '+' : ''}
              {formatMoney(amendment.deltaPrice, currency)}
            </td>
          );
        default:
          return <td key={column} className="px-2.5 py-2" aria-hidden="true" />;
      }
    })}
  </tr>
);
