import React, { useEffect, useMemo, useState } from 'react';
import type {
  ContractInvoiceStatus,
  InvestorFinancials,
  InvestorInvoice,
  ProjectDetails,
} from '@/types';
import { formatDecimal, parseDecimal } from '@/utils/formatters';
import { formatMoney } from '../utils/format';

interface Props {
  projectDetails?: ProjectDetails;
  onUpdateDetails: (updates: Partial<ProjectDetails>) => void;
}

const DEFAULT_INVESTOR: InvestorFinancials = {
  sodPrice: 0,
  amendments: [],
  invoices: [],
};

const statusLabels: Record<ContractInvoiceStatus, string> = {
  issued: 'Vystaveno',
  approved: 'Schváleno',
  paid: 'Zaplaceno',
  overdue: 'Po splatnosti',
};

const inputClass =
  'w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-800 dark:bg-slate-950 dark:text-white';

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const defaultDueDate = (): string => {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);
  return dueDate.toISOString().slice(0, 10);
};

const cloneInvestorFinancials = (projectDetails?: ProjectDetails): InvestorFinancials => ({
  sodPrice: projectDetails?.investorFinancials?.sodPrice || 0,
  amendments: [...(projectDetails?.investorFinancials?.amendments || [])],
  invoices: [...(projectDetails?.investorFinancials?.invoices || [])],
});

const formatEditableNumber = (value: number): string =>
  formatDecimal(value || 0, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const parseEditableNumber = (value: string): number => parseDecimal(value) ?? 0;

export const InvestorBillingPage: React.FC<Props> = ({
  projectDetails,
  onUpdateDetails,
}) => {
  const [form, setForm] = useState<InvestorFinancials>(() =>
    cloneInvestorFinancials(projectDetails),
  );
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const next = cloneInvestorFinancials(projectDetails);
    setForm(next);
    setAmountInputs(
      Object.fromEntries(
        (next.invoices || []).map((invoice) => [
          invoice.id,
          formatEditableNumber(invoice.amount || 0),
        ]),
      ),
    );
  }, [projectDetails]);

  const totals = useMemo(() => {
    const amendmentsTotal = form.amendments.reduce(
      (sum, amendment) => sum + (amendment.price || 0),
      0,
    );
    const invoices = form.invoices || [];
    const invoiced = invoices.reduce((sum, invoice) => sum + (invoice.amount || 0), 0);
    const paid = invoices
      .filter((invoice) => invoice.status === 'paid')
      .reduce((sum, invoice) => sum + (invoice.amount || 0), 0);

    return {
      budget: (form.sodPrice || 0) + amendmentsTotal,
      amendmentsTotal,
      invoiced,
      paid,
      remainingToInvoice: Math.max(0, (form.sodPrice || 0) + amendmentsTotal - invoiced),
    };
  }, [form]);

  const invoices = form.invoices || [];

  const addInvoice = () => {
    const invoice: InvestorInvoice = {
      id: `ii${Date.now()}`,
      invoiceNumber: '',
      issueDate: todayIso(),
      dueDate: defaultDueDate(),
      amount: 0,
      currency: 'CZK',
      status: 'issued',
    };
    setForm((prev) => ({
      ...prev,
      invoices: [...(prev.invoices || []), invoice],
    }));
    setAmountInputs((prev) => ({
      ...prev,
      [invoice.id]: '0',
    }));
    setSaved(false);
  };

  const updateInvoice = (
    index: number,
    field: keyof Pick<
      InvestorInvoice,
      'invoiceNumber' | 'issueDate' | 'dueDate' | 'amount' | 'status' | 'paidAt' | 'note'
    >,
    value: string | number,
  ) => {
    setForm((prev) => {
      const nextInvoices = [...(prev.invoices || [])];
      nextInvoices[index] = {
        ...nextInvoices[index],
        [field]: field === 'status' ? (value as ContractInvoiceStatus) : value,
      };
      return { ...prev, invoices: nextInvoices };
    });
    setSaved(false);
  };

  const removeInvoice = (index: number) => {
    setForm((prev) => ({
      ...prev,
      invoices: (prev.invoices || []).filter((_, i) => i !== index),
    }));
    setSaved(false);
  };

  const save = () => {
    const nextFinancials: InvestorFinancials = {
      ...DEFAULT_INVESTOR,
      ...form,
      invoices: invoices
        .filter((invoice) => invoice.invoiceNumber.trim() || invoice.amount > 0)
        .map((invoice) => ({
          ...invoice,
          invoiceNumber: invoice.invoiceNumber.trim(),
          currency: invoice.currency || 'CZK',
          paidAt: invoice.status === 'paid' ? invoice.paidAt || todayIso() : undefined,
          note: invoice.note?.trim() || undefined,
        })),
    };
    onUpdateDetails({ investorFinancials: nextFinancials });
    setSaved(true);
  };

  if (!projectDetails) {
    return (
      <div className="p-5">
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600 dark:border-slate-800 dark:text-slate-500">
          Nejdřív načtěte projekt, potom půjde spravovat investor.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto p-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-500">
            Rozpočet investora
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatMoney(totals.budget)}
          </div>
          <div className="mt-1 text-xs text-slate-600 dark:text-slate-500">
            dodatky {formatMoney(totals.amendmentsTotal)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-500">
            Fakturováno
          </div>
          <div className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatMoney(totals.invoiced)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-500">
            Uhrazeno
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatMoney(totals.paid)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-500">
            Zbývá fakturovat
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatMoney(totals.remainingToInvoice)}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Investor
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-500">
              Fakturace na investora pro porovnání proti dodavatelským nákladům.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addInvoice}
              className="rounded-lg border border-primary/40 px-3 py-2 text-xs font-semibold text-primary transition hover:border-primary hover:bg-primary/10"
            >
              + Přidat fakturu
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-dark"
            >
              Uložit
            </button>
          </div>
        </div>

        {saved ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300">
            Fakturace investora byla uložena.
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          {invoices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600 dark:border-slate-800 dark:text-slate-500">
              Zatím není zadaná žádná faktura na investora.
            </div>
          ) : (
            <>
              <div className="hidden xl:grid xl:grid-cols-[minmax(150px,1.2fr)_145px_145px_minmax(135px,0.8fr)_140px_32px] gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span>Číslo faktury</span>
                <span>Vystaveno</span>
                <span>Splatnost</span>
                <span className="text-right">Částka</span>
                <span>Stav</span>
                <span />
              </div>
              {invoices.map((invoice, index) => (
                <div
                  key={invoice.id}
                  className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/30 sm:grid-cols-2 xl:grid-cols-[minmax(150px,1.2fr)_145px_145px_minmax(135px,0.8fr)_140px_32px] xl:border-0 xl:bg-transparent xl:p-0 xl:dark:bg-transparent"
                >
                  <input
                    className={inputClass}
                    value={invoice.invoiceNumber}
                    onChange={(event) =>
                      updateInvoice(index, 'invoiceNumber', event.target.value)
                    }
                    placeholder="Číslo faktury"
                  />
                  <input
                    type="date"
                    className={inputClass}
                    value={invoice.issueDate}
                    onChange={(event) =>
                      updateInvoice(index, 'issueDate', event.target.value)
                    }
                  />
                  <input
                    type="date"
                    className={inputClass}
                    value={invoice.dueDate}
                    onChange={(event) =>
                      updateInvoice(index, 'dueDate', event.target.value)
                    }
                  />
                  <input
                    className={`${inputClass} text-right tabular-nums`}
                    inputMode="decimal"
                    value={amountInputs[invoice.id] ?? formatEditableNumber(invoice.amount || 0)}
                    onChange={(event) => {
                      setAmountInputs((prev) => ({
                        ...prev,
                        [invoice.id]: event.target.value,
                      }));
                      updateInvoice(index, 'amount', parseEditableNumber(event.target.value));
                    }}
                    onBlur={() =>
                      setAmountInputs((prev) => ({
                        ...prev,
                        [invoice.id]: formatEditableNumber(
                          invoices[index]?.amount || 0,
                        ),
                      }))
                    }
                  />
                  <select
                    className={inputClass}
                    value={invoice.status}
                    onChange={(event) =>
                      updateInvoice(index, 'status', event.target.value)
                    }
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeInvoice(index)}
                    className="grid h-9 w-9 place-items-center rounded-lg text-red-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                    aria-label="Smazat fakturu"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      delete
                    </span>
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
