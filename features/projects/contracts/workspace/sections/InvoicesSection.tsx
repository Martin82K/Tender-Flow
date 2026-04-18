import React, { useState } from 'react';
import type { ContractInvoice, ContractInvoiceStatus, ContractWithDetails } from '@/types';
import { contractService } from '@/services/contractService';
import { InvoiceDialog } from '../../forms/InvoiceDialog';
import { formatDate, formatMoney } from '../../utils/format';

interface Props {
  contract: ContractWithDetails;
  onRefresh: () => Promise<void> | void;
}

const STATUS_STYLE: Record<ContractInvoiceStatus, { label: string; className: string }> = {
  paid: { label: 'Zaplaceno', className: 'bg-green-500/15 text-green-400' },
  approved: { label: 'Schváleno', className: 'bg-blue-500/15 text-blue-400' },
  issued: { label: 'Vystaveno', className: 'bg-amber-500/15 text-amber-400' },
  overdue: { label: 'Po splatnosti', className: 'bg-red-500/15 text-red-400' },
};

const today = () => new Date().toISOString().slice(0, 10);

const deriveStatus = (invoice: ContractInvoice): ContractInvoiceStatus => {
  if (invoice.status === 'issued' && invoice.dueDate && invoice.dueDate < today()) {
    return 'overdue';
  }
  return invoice.status;
};

export const InvoicesSection: React.FC<Props> = ({ contract, onRefresh }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContractInvoice | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (i: ContractInvoice) => {
    setEditing(i);
    setDialogOpen(true);
  };

  const handlePaid = async (id: string) => {
    await contractService.markInvoicePaid(id);
    await onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Smazat tuto fakturu?')) return;
    await contractService.deleteInvoice(id);
    await onRefresh();
  };

  const remainingToInvoice = Math.max(0, (contract.currentTotal || 0) - (contract.invoicedSum || 0));

  return (
    <section id="sec-faktury" className="py-4 border-b border-dashed border-slate-800">
      <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-3 flex items-center gap-2">
        Fakturace
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-200">
          {contract.invoices.length}
        </span>
      </h3>

      {contract.invoices.length === 0 ? (
        <div className="text-xs text-slate-500 flex items-center gap-3">
          K této smlouvě zatím neexistují žádné faktury.
          <button
            type="button"
            onClick={openCreate}
            className="px-2 py-1 text-xs font-semibold text-primary hover:text-primary/80 hover:underline transition"
          >
            + Nová faktura
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 mb-3">
            <div>
              <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Nafakturováno</div>
              <div className="text-sm font-semibold text-blue-400 tabular-nums">
                {formatMoney(contract.invoicedSum, contract.currency)}
              </div>
            </div>
            <div className="w-px bg-slate-800 self-stretch" />
            <div>
              <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Zaplaceno</div>
              <div className="text-sm font-semibold text-green-400 tabular-nums">
                {formatMoney(contract.paidSum, contract.currency)}
              </div>
            </div>
            <div className="w-px bg-slate-800 self-stretch" />
            <div>
              <div className="text-[10.5px] uppercase tracking-wider text-slate-500">
                Zbývá vyfakturovat
              </div>
              <div className="text-sm font-semibold text-slate-100 tabular-nums">
                {formatMoney(remainingToInvoice, contract.currency)}
              </div>
            </div>
            {contract.overdueSum > 0 && (
              <>
                <div className="w-px bg-slate-800 self-stretch" />
                <div>
                  <div className="text-[10.5px] uppercase tracking-wider text-slate-500">
                    Po splatnosti
                  </div>
                  <div className="text-sm font-semibold text-red-400 tabular-nums">
                    {formatMoney(contract.overdueSum, contract.currency)}
                  </div>
                </div>
              </>
            )}
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10.5px] uppercase tracking-wider text-slate-500">
                <th className="text-left px-2.5 py-2">Č. faktury</th>
                <th className="text-left px-2.5 py-2">DUZP</th>
                <th className="text-left px-2.5 py-2">Splatnost</th>
                <th className="text-right px-2.5 py-2">Částka</th>
                <th className="text-left px-2.5 py-2">Stav</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {contract.invoices.map((inv) => {
                const effective = deriveStatus(inv);
                const style = STATUS_STYLE[effective];
                return (
                  <tr key={inv.id} className="border-b border-slate-800">
                    <td className="px-2.5 py-2 font-semibold text-slate-200">{inv.invoiceNumber}</td>
                    <td className="px-2.5 py-2 text-slate-400">{formatDate(inv.issueDate)}</td>
                    <td className="px-2.5 py-2 text-slate-400">{formatDate(inv.dueDate)}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums text-slate-200">
                      {formatMoney(inv.amount, inv.currency)}
                    </td>
                    <td className="px-2.5 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${style.className}`}
                      >
                        {style.label}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 text-right whitespace-nowrap">
                      {effective !== 'paid' && (
                        <button
                          type="button"
                          onClick={() => handlePaid(inv.id)}
                          className="px-2 py-1 rounded hover:bg-slate-800 text-green-400 text-xs"
                          title="Označit jako zaplacenou"
                        >
                          ✓
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(inv)}
                        className="px-2 py-1 rounded hover:bg-slate-800 text-slate-400"
                        title="Upravit"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(inv.id)}
                        className="px-2 py-1 rounded hover:bg-slate-800 text-slate-400"
                        title="Smazat"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3">
            <button
              type="button"
              onClick={openCreate}
              className="px-3 py-1.5 rounded-lg border border-primary/40 text-primary text-xs font-semibold hover:bg-primary/10 hover:border-primary transition"
            >
              + Nová faktura
            </button>
          </div>
        </>
      )}

      {dialogOpen && (
        <InvoiceDialog
          contract={contract}
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
