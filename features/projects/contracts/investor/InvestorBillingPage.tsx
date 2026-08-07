import React, { useEffect, useMemo, useState } from 'react';
import type {
  Amendment,
  ContractInvoiceStatus,
  InvestorFinancials,
  InvestorInvoice,
  ProjectDetails,
} from '@/types';
import { formatDecimal, parseDecimal } from '@/shared/formatting/decimalFormatters';
import { NumericInput } from '@/shared/ui/NumericInput';
import { formatMoney } from '../utils/format';
import {
  computeInvestorInvoiceBreakdown,
  computeInvestorTotals,
} from './investorBillingModel';

interface Props {
  projectDetails?: ProjectDetails;
  onUpdateDetails: (updates: Partial<ProjectDetails>) => void | Promise<void>;
}

const DEFAULT_INVESTOR: InvestorFinancials = {
  sodPrice: 0,
  retentionAPercent: 0,
  retentionBPercent: 0,
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
  'w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:border-transparent disabled:bg-transparent disabled:px-0 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-transparent';
const labelClass = 'mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500';

const todayIso = (): string => new Date().toISOString().slice(0, 10);
const currentPeriod = (): string => todayIso().slice(0, 7);

const defaultDueDate = (): string => {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);
  return dueDate.toISOString().slice(0, 10);
};

const cloneInvestorFinancials = (projectDetails?: ProjectDetails): InvestorFinancials => ({
  ...DEFAULT_INVESTOR,
  ...(projectDetails?.investorFinancials || {}),
  amendments: [...(projectDetails?.investorFinancials?.amendments || [])],
  invoices: [...(projectDetails?.investorFinancials?.invoices || [])],
});

const formatEditableNumber = (value: number): string =>
  formatDecimal(value || 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const parseEditableNumber = (value: string): number => parseDecimal(value) ?? 0;

const KpiCard: React.FC<{ label: string; value: number; tone?: string; detail?: string }> = ({
  label,
  value,
  tone = 'text-slate-900 dark:text-slate-100',
  detail,
}) => (
  <div
    data-help-id="contracts-investor-kpi-card"
    className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/60"
  >
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-500">
      {label}
    </div>
    <div className={`mt-1 text-lg font-bold tabular-nums ${tone}`}>{formatMoney(value)}</div>
    {detail ? <div className="mt-0.5 text-[11px] text-slate-500">{detail}</div> : null}
  </div>
);

export const InvestorBillingPage: React.FC<Props> = ({ projectDetails, onUpdateDetails }) => {
  const [form, setForm] = useState<InvestorFinancials>(() => cloneInvestorFinancials(projectDetails));
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editableInvoiceIds, setEditableInvoiceIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const next = cloneInvestorFinancials(projectDetails);
    setForm(next);
    setAmountInputs(
      Object.fromEntries(
        (next.invoices || []).map((invoice) => [invoice.id, formatEditableNumber(invoice.amount || 0)]),
      ),
    );
    setDirty(false);
    setSaved(false);
    setSaveError(null);
    setEditableInvoiceIds(new Set());
  }, [projectDetails]);

  const totals = useMemo(() => computeInvestorTotals(form), [form]);
  const invoices = form.invoices || [];

  const markChanged = () => {
    setDirty(true);
    setSaved(false);
    setSaveError(null);
  };

  const updateFinancials = <K extends keyof InvestorFinancials>(key: K, value: InvestorFinancials[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    markChanged();
  };

  const addAmendment = () => {
    const amendment: Amendment = {
      id: crypto.randomUUID(),
      number: '',
      label: '',
      signedAt: '',
      price: 0,
    };
    setForm((current) => ({ ...current, amendments: [...current.amendments, amendment] }));
    markChanged();
  };

  const updateAmendment = <K extends keyof Amendment>(index: number, key: K, value: Amendment[K]) => {
    setForm((current) => {
      const amendments = [...current.amendments];
      amendments[index] = { ...amendments[index], [key]: value };
      return { ...current, amendments };
    });
    markChanged();
  };

  const removeAmendment = (index: number) => {
    setForm((current) => ({
      ...current,
      amendments: current.amendments.filter((_, candidate) => candidate !== index),
    }));
    markChanged();
  };

  const addInvoice = () => {
    const invoice: InvestorInvoice = {
      id: crypto.randomUUID(),
      period: currentPeriod(),
      invoiceNumber: '',
      issueDate: todayIso(),
      dueDate: defaultDueDate(),
      amount: 0,
      currency: 'CZK',
      status: 'issued',
      retentionAPercent: form.retentionAPercent || 0,
      retentionBPercent: form.retentionBPercent || 0,
      paidAmount: 0,
    };
    setForm((current) => ({ ...current, invoices: [...(current.invoices || []), invoice] }));
    setAmountInputs((current) => ({ ...current, [invoice.id]: '0' }));
    setEditableInvoiceIds((current) => new Set(current).add(invoice.id));
    markChanged();
  };

  const updateInvoice = <K extends keyof InvestorInvoice>(
    index: number,
    field: K,
    value: InvestorInvoice[K],
  ) => {
    setForm((current) => {
      const nextInvoices = [...(current.invoices || [])];
      nextInvoices[index] = { ...nextInvoices[index], [field]: value };
      return { ...current, invoices: nextInvoices };
    });
    markChanged();
  };

  const removeInvoice = (index: number) => {
    const invoiceId = invoices[index]?.id;
    setForm((current) => ({
      ...current,
      invoices: (current.invoices || []).filter((_, candidate) => candidate !== index),
    }));
    if (invoiceId) {
      setAmountInputs((current) => {
        const next = { ...current };
        delete next[invoiceId];
        return next;
      });
    }
    markChanged();
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      if ((form.retentionAPercent || 0) + (form.retentionBPercent || 0) > 100) {
        throw new Error('Součet výchozích pozastávek nesmí překročit 100 %.');
      }
      const normalizedInvoices = invoices
        .filter((invoice) => invoice.invoiceNumber.trim() || invoice.amount > 0)
        .map((invoice) => {
          const breakdown = computeInvestorInvoiceBreakdown(invoice);
          return {
            ...invoice,
            period: invoice.period || invoice.issueDate.slice(0, 7),
            invoiceNumber: invoice.invoiceNumber.trim(),
            currency: invoice.currency || 'CZK',
            retentionAAmount: breakdown.retentionAAmount,
            retentionBAmount: breakdown.retentionBAmount,
            paidAmount: breakdown.paidAmount,
            paidAt: invoice.status === 'paid' ? invoice.paidAt || todayIso() : undefined,
            note: invoice.note?.trim() || undefined,
          };
        });
      const nextFinancials: InvestorFinancials = {
        ...DEFAULT_INVESTOR,
        ...form,
        contractNumber: form.contractNumber?.trim() || undefined,
        contractTitle: form.contractTitle?.trim() || undefined,
        customerName: form.customerName?.trim() || undefined,
        amendments: form.amendments.map((amendment) => ({
          ...amendment,
          number: amendment.number?.trim() || undefined,
          label: amendment.label.trim(),
        })),
        invoices: normalizedInvoices,
      };
      await onUpdateDetails({ investorFinancials: nextFinancials });
      setForm(nextFinancials);
      setSaved(true);
      setDirty(false);
      setEditableInvoiceIds(new Set());
    } catch (error) {
      setSaved(false);
      setSaveError(error instanceof Error ? error.message : 'Sekci Investor se nepodařilo uložit.');
    } finally {
      setSaving(false);
    }
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
    <div data-help-id="contracts-investor-page" className="flex-1 min-h-0 overflow-auto p-5">
      <div data-help-id="contracts-investor-kpis" className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <KpiCard label="Smlouva + dodatky" value={totals.contractTotal} detail={`dodatky ${formatMoney(totals.amendmentsTotal)}`} />
        <KpiCard label="Fakturováno" value={totals.invoiced} tone="text-blue-600 dark:text-blue-400" />
        <KpiCard label="Pozastávka A" value={totals.retentionA} tone="text-amber-600 dark:text-amber-400" />
        <KpiCard label="Pozastávka B" value={totals.retentionB} tone="text-purple-600 dark:text-purple-400" />
        <KpiCard label="K úhradě" value={totals.payable} />
        <KpiCard label="Uhrazeno" value={totals.paid} tone="text-emerald-600 dark:text-emerald-400" />
      </div>

      <section className="mt-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Smlouva s objednatelem</h3>
            <p className="text-xs text-slate-500">Základní smlouva a číslované dodatky.</p>
          </div>
          <button type="button" onClick={addAmendment} className="rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10">
            + Přidat dodatek
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div><label className={labelClass}>Číslo smlouvy</label><input className={inputClass} value={form.contractNumber || ''} onChange={(event) => updateFinancials('contractNumber', event.target.value)} /></div>
          <div><label className={labelClass}>Název smlouvy</label><input className={inputClass} value={form.contractTitle || ''} onChange={(event) => updateFinancials('contractTitle', event.target.value)} /></div>
          <div><label className={labelClass}>Objednatel</label><input className={inputClass} value={form.customerName || ''} onChange={(event) => updateFinancials('customerName', event.target.value)} /></div>
          <div><label className={labelClass}>Datum podpisu</label><input type="date" className={inputClass} value={form.signedAt || ''} onChange={(event) => updateFinancials('signedAt', event.target.value)} /></div>
          <div><label className={labelClass}>Cena smlouvy</label><NumericInput value={form.sodPrice} onChange={(value) => updateFinancials('sodPrice', value || 0)} allowNegative={false} maxFractionDigits={2} suffix="CZK" /></div>
          <div><label className={labelClass}>Pozastávka A – do předání</label><NumericInput value={form.retentionAPercent ?? 0} onChange={(value) => updateFinancials('retentionAPercent', value || 0)} allowNegative={false} maxFractionDigits={2} suffix="%" /></div>
          <div><label className={labelClass}>Pozastávka B – po dobu záruky</label><NumericInput value={form.retentionBPercent ?? 0} onChange={(value) => updateFinancials('retentionBPercent', value || 0)} allowNegative={false} maxFractionDigits={2} suffix="%" /></div>
          <div className="flex items-end text-xs text-slate-500">Zbývá fakturovat: <strong className="ml-1 text-slate-800 dark:text-slate-200">{formatMoney(totals.remainingToInvoice)}</strong></div>
        </div>

        {form.amendments.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead><tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wider text-slate-500 dark:border-slate-800"><th className="px-2 py-2">Číslo dodatku</th><th className="px-2 py-2">Název / důvod</th><th className="px-2 py-2">Datum</th><th className="px-2 py-2 text-right">Změna ceny</th><th className="w-12" /></tr></thead>
              <tbody>
                {form.amendments.map((amendment, index) => (
                  <tr key={amendment.id} className="border-b border-slate-100 dark:border-slate-800/70">
                    <td className="p-2"><input aria-label={`Číslo dodatku ${index + 1}`} className={inputClass} value={amendment.number || ''} onChange={(event) => updateAmendment(index, 'number', event.target.value)} /></td>
                    <td className="p-2"><input aria-label={`Název dodatku ${index + 1}`} className={inputClass} value={amendment.label} onChange={(event) => updateAmendment(index, 'label', event.target.value)} /></td>
                    <td className="p-2"><input aria-label={`Datum dodatku ${index + 1}`} type="date" className={inputClass} value={amendment.signedAt || ''} onChange={(event) => updateAmendment(index, 'signedAt', event.target.value)} /></td>
                    <td className="p-2"><NumericInput value={amendment.price} onChange={(value) => updateAmendment(index, 'price', value || 0)} allowNegative maxFractionDigits={2} suffix="CZK" /></td>
                    <td><button type="button" aria-label={`Smazat dodatek ${index + 1}`} onClick={() => removeAmendment(index)} className="rounded p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><span className="material-symbols-outlined text-[17px]">delete</span></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section data-help-id="contracts-investor-panel" className="mt-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Fakturace objednateli</h3><p className="text-xs text-slate-500">Vystavená částka se automaticky rozdělí na pozastávky a čistou částku k úhradě.</p></div>
          <div className="flex gap-2">
            <button type="button" onClick={addInvoice} data-help-id="contracts-investor-add-invoice" className="rounded-lg border border-primary/40 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10">+ Přidat fakturu</button>
            <button type="button" onClick={save} data-help-id="contracts-investor-save" disabled={saving || !dirty} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Ukládám…' : 'Uložit'}</button>
          </div>
        </div>

        {dirty && !saving ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300">Změny nejsou uložené. Pro trvalé smazání použijte Uložit.</div> : null}
        {saved ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300">Sekce Investor byla uložena.</div> : null}
        {saveError ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">{saveError}</div> : null}

        {invoices.length === 0 ? (
          <div data-help-id="contracts-investor-empty" className="mt-4 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600 dark:border-slate-800 dark:text-slate-500">Zatím není zadaná žádná faktura na investora.</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1500px] text-xs">
              <thead><tr className="border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800"><th className="px-2 py-2">Období</th><th className="px-2 py-2">Číslo faktury</th><th className="px-2 py-2">Vystaveno</th><th className="px-2 py-2">Splatnost</th><th className="px-2 py-2 text-right">Fakturováno</th><th className="px-2 py-2 text-right">Pozastávka A</th><th className="px-2 py-2 text-right">Pozastávka B</th><th className="px-2 py-2 text-right">K úhradě</th><th className="px-2 py-2 text-right">Uhrazeno</th><th className="px-2 py-2">Stav</th><th className="w-20" /></tr></thead>
              <tbody>
                {invoices.map((invoice, index) => {
                  const editable = editableInvoiceIds.has(invoice.id);
                  let breakdown;
                  try {
                    breakdown = computeInvestorInvoiceBreakdown(invoice);
                  } catch {
                    breakdown = { grossAmount: invoice.amount || 0, retentionAAmount: 0, retentionBAmount: 0, payableAmount: 0, paidAmount: 0 };
                  }
                  return (
                    <tr key={invoice.id} className="border-b border-slate-100 align-top dark:border-slate-800/70">
                      <td className="p-2"><input aria-label={`Období faktury ${index + 1}`} type="month" className={inputClass} value={invoice.period || ''} disabled={!editable} onChange={(event) => updateInvoice(index, 'period', event.target.value)} /></td>
                      <td className="p-2"><input aria-label={`Číslo faktury ${index + 1}`} className={inputClass} placeholder="Číslo faktury" value={invoice.invoiceNumber} disabled={!editable} onChange={(event) => updateInvoice(index, 'invoiceNumber', event.target.value)} /></td>
                      <td className="p-2"><input aria-label={`Datum vystavení ${index + 1}`} type="date" className={inputClass} value={invoice.issueDate} disabled={!editable} onChange={(event) => updateInvoice(index, 'issueDate', event.target.value)} /></td>
                      <td className="p-2"><input aria-label={`Splatnost faktury ${index + 1}`} type="date" className={inputClass} value={invoice.dueDate} disabled={!editable} onChange={(event) => updateInvoice(index, 'dueDate', event.target.value)} /></td>
                      <td className="p-2"><input aria-label={`Fakturovaná částka ${index + 1}`} className={`${inputClass} text-right tabular-nums`} inputMode="decimal" value={amountInputs[invoice.id] ?? formatEditableNumber(invoice.amount || 0)} disabled={!editable} onChange={(event) => { setAmountInputs((current) => ({ ...current, [invoice.id]: event.target.value })); updateInvoice(index, 'amount', parseEditableNumber(event.target.value)); }} onBlur={() => setAmountInputs((current) => ({ ...current, [invoice.id]: formatEditableNumber(invoices[index]?.amount || 0) }))} /></td>
                      <td className="p-2 text-right"><div className="flex items-center justify-end gap-1"><input aria-label={`Pozastávka A procento ${index + 1}`} type="number" min="0" max="100" step="0.01" className={`${inputClass} max-w-16 text-right`} value={invoice.retentionAPercent || 0} disabled={!editable} onChange={(event) => updateInvoice(index, 'retentionAPercent', Number(event.target.value))} /><span>%</span></div><div className="mt-1 tabular-nums text-amber-600">{formatMoney(breakdown.retentionAAmount)}</div></td>
                      <td className="p-2 text-right"><div className="flex items-center justify-end gap-1"><input aria-label={`Pozastávka B procento ${index + 1}`} type="number" min="0" max="100" step="0.01" className={`${inputClass} max-w-16 text-right`} value={invoice.retentionBPercent || 0} disabled={!editable} onChange={(event) => updateInvoice(index, 'retentionBPercent', Number(event.target.value))} /><span>%</span></div><div className="mt-1 tabular-nums text-purple-600">{formatMoney(breakdown.retentionBAmount)}</div></td>
                      <td className="p-2 text-right font-semibold tabular-nums">{formatMoney(breakdown.payableAmount)}</td>
                      <td className="p-2 text-right font-semibold tabular-nums text-emerald-600">{formatMoney(breakdown.paidAmount)}</td>
                      <td className="p-2"><select aria-label={`Stav faktury ${index + 1}`} className={inputClass} value={invoice.status} disabled={!editable} onChange={(event) => updateInvoice(index, 'status', event.target.value as ContractInvoiceStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
                      <td className="p-2"><div className="flex"><button type="button" onClick={() => setEditableInvoiceIds((current) => new Set(current).add(invoice.id))} disabled={editable} aria-label="Upravit fakturu" className="grid h-8 w-8 place-items-center rounded text-slate-500 hover:bg-primary/10 hover:text-primary disabled:text-primary"><span className="material-symbols-outlined text-[17px]">edit</span></button><button type="button" onClick={() => removeInvoice(index)} aria-label="Smazat fakturu" className="grid h-8 w-8 place-items-center rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><span className="material-symbols-outlined text-[17px]">delete</span></button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
