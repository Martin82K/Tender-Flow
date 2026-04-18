import React, { useState } from 'react';
import type { ContractAmendment, ContractWithDetails } from '@/types';
import { contractService } from '@/services/contractService';
import { AmendmentDialog } from '../../forms/AmendmentDialog';
import { formatDate, formatMoney } from '../../utils/format';

interface Props {
  contract: ContractWithDetails;
  onRefresh: () => Promise<void> | void;
}

export const AmendmentsSection: React.FC<Props> = ({ contract, onRefresh }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContractAmendment | null>(null);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Smazat tento dodatek?')) return;
    await contractService.deleteAmendment(id);
    await onRefresh();
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (a: ContractAmendment) => {
    setEditing(a);
    setDialogOpen(true);
  };

  return (
    <section id="sec-dodatky" className="py-4 border-b border-dashed border-slate-800">
      <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-3 flex items-center gap-2">
        Dodatky
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-200">
          {contract.amendments.length}
        </span>
      </h3>

      {contract.amendments.length === 0 ? (
        <div className="text-xs text-slate-500 flex items-center gap-3">
          K této smlouvě zatím nejsou žádné dodatky.
          <button
            type="button"
            onClick={openCreate}
            className="px-2 py-1 text-xs font-semibold text-primary hover:text-primary/80 hover:underline transition"
          >
            + Nový dodatek
          </button>
        </div>
      ) : (
        <>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10.5px] uppercase tracking-wider text-slate-500">
                <th className="text-left px-2.5 py-2">Č.</th>
                <th className="text-left px-2.5 py-2">Datum</th>
                <th className="text-right px-2.5 py-2">Změna hodnoty</th>
                <th className="text-left px-2.5 py-2">Důvod</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {contract.amendments.map((a) => (
                <tr key={a.id} className="border-b border-slate-800">
                  <td className="px-2.5 py-2 text-slate-200">Dodatek č. {a.amendmentNo}</td>
                  <td className="px-2.5 py-2 text-slate-400">{formatDate(a.signedAt)}</td>
                  <td
                    className={`px-2.5 py-2 text-right tabular-nums ${
                      a.deltaPrice > 0
                        ? 'text-red-400 font-semibold'
                        : a.deltaPrice < 0
                          ? 'text-green-400 font-semibold'
                          : 'text-slate-300'
                    }`}
                  >
                    {a.deltaPrice > 0 ? '+' : ''}
                    {formatMoney(a.deltaPrice, contract.currency)}
                  </td>
                  <td className="px-2.5 py-2 text-slate-400">{a.reason || '—'}</td>
                  <td className="px-2.5 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(a)}
                      className="px-2 py-1 rounded hover:bg-slate-800 text-slate-400"
                      title="Upravit"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(a.id)}
                      className="px-2 py-1 rounded hover:bg-slate-800 text-slate-400"
                      title="Smazat"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3">
            <button
              type="button"
              onClick={openCreate}
              className="px-3 py-1.5 rounded-lg border border-primary/40 text-primary text-xs font-semibold hover:bg-primary/10 hover:border-primary transition"
            >
              + Nový dodatek
            </button>
          </div>
        </>
      )}

      {dialogOpen && (
        <AmendmentDialog
          contractId={contract.id}
          initial={editing}
          onClose={() => setDialogOpen(false)}
          onSaved={async () => {
            setDialogOpen(false);
            await onRefresh();
          }}
        />
      )}
    </section>
  );
};
