import React, { useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { contractService } from '@/services/contractService';
import type {
  ContractInvoice,
  ContractInvoiceStatus,
  ContractWithDetails,
} from '@/types';

interface Props {
  contract: ContractWithDetails;
  initial: ContractInvoice | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary';
const labelClass = 'block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1';

const defaultDueDate = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
};

export const InvoiceDialog: React.FC<Props> = ({ contract, initial, onClose, onSaved }) => {
  const isEditing = Boolean(initial?.id);
  const [form, setForm] = useState({
    invoiceNumber: initial?.invoiceNumber ?? '',
    issueDate: initial?.issueDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    dueDate: initial?.dueDate?.slice(0, 10) ?? defaultDueDate(),
    amount: initial?.amount?.toString() ?? '',
    currency: initial?.currency ?? contract.currency ?? 'CZK',
    status: (initial?.status ?? 'issued') as ContractInvoiceStatus,
    paidAt: initial?.paidAt?.slice(0, 10) ?? '',
    documentUrl: initial?.documentUrl ?? '',
    note: initial?.note ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.invoiceNumber.trim()) {
      setError('Číslo faktury je povinné.');
      return;
    }
    const amount = Number.parseFloat(form.amount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Částka musí být kladné číslo.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        contractId: contract.id,
        invoiceNumber: form.invoiceNumber,
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        amount,
        currency: form.currency,
        status: form.status,
        paidAt: form.status === 'paid' ? form.paidAt || new Date().toISOString().slice(0, 10) : form.paidAt || undefined,
        documentUrl: form.documentUrl || undefined,
        note: form.note || undefined,
      };
      if (isEditing && initial) {
        await contractService.updateInvoice(initial.id, payload);
      } else {
        await contractService.createInvoice(payload);
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se uložit fakturu');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={isEditing ? 'Upravit fakturu' : 'Nová faktura'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Č. faktury *</label>
            <input
              className={inputClass}
              value={form.invoiceNumber}
              onChange={(e) => setForm((s) => ({ ...s, invoiceNumber: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Stav</label>
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as ContractInvoiceStatus }))}
            >
              <option value="issued">Vystaveno</option>
              <option value="approved">Schváleno</option>
              <option value="paid">Zaplaceno</option>
              <option value="overdue">Po splatnosti</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>DUZP *</label>
            <input
              type="date"
              className={inputClass}
              value={form.issueDate}
              onChange={(e) => setForm((s) => ({ ...s, issueDate: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Splatnost *</label>
            <input
              type="date"
              className={inputClass}
              value={form.dueDate}
              onChange={(e) => setForm((s) => ({ ...s, dueDate: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Částka *</label>
            <input
              className={inputClass}
              value={form.amount}
              onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
              inputMode="decimal"
              required
            />
          </div>
          <div>
            <label className={labelClass}>Měna</label>
            <select
              className={inputClass}
              value={form.currency}
              onChange={(e) => setForm((s) => ({ ...s, currency: e.target.value }))}
            >
              <option value="CZK">CZK</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </div>
          {form.status === 'paid' && (
            <div>
              <label className={labelClass}>Zaplaceno dne</label>
              <input
                type="date"
                className={inputClass}
                value={form.paidAt}
                onChange={(e) => setForm((s) => ({ ...s, paidAt: e.target.value }))}
              />
            </div>
          )}
        </div>
        <div>
          <label className={labelClass}>Odkaz na dokument</label>
          <input
            className={inputClass}
            value={form.documentUrl}
            onChange={(e) => setForm((s) => ({ ...s, documentUrl: e.target.value }))}
            placeholder="https://…"
          />
        </div>
        <div>
          <label className={labelClass}>Poznámka</label>
          <textarea
            rows={2}
            className={`${inputClass} resize-none`}
            value={form.note}
            onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Zrušit
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-primary/40 text-primary hover:bg-primary/10 hover:border-primary transition disabled:opacity-50"
          >
            {submitting ? 'Ukládám…' : isEditing ? 'Uložit změny' : 'Vytvořit fakturu'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
