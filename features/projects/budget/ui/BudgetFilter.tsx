import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '@shared/ui/Modal';
import { decimal, normalizeSearch, uniqueValues } from '../model/budgetModel';
import type { BudgetFilters, ColumnFilter } from '../model/budgetModel';
import type { BudgetNode } from '../model/types';
interface Props { column: string; label: string; items: BudgetNode[]; filters: BudgetFilters; numeric?: boolean; onChange: (filter: ColumnFilter) => void; onClose: () => void }
export function BudgetFilter({ column, label, items, filters, numeric, onChange, onClose }: Props) {
  const current = filters[column] || {}; const [error, setError] = useState('');
  const [bounds, setBounds] = useState({min: current.min || '', max: current.max || ''});
  useEffect(() => { setBounds({min: current.min || '', max: current.max || ''}); }, [current.min, current.max]);
  const values = useMemo(() => uniqueValues(items, column, filters), [items,column,filters]);
  const found = values.filter(v => normalizeSearch(v).includes(normalizeSearch(current.search || '')));
  const selected = current.selected ?? values;
  return <Modal isOpen onClose={onClose} title={`Filtr: ${label}`} footer={<button onClick={onClose}>Hotovo</button>}>
    <div className="tf-budget-controls flex flex-col gap-3">
      <input autoFocus aria-label={`Hledat ${label}`} placeholder="Celý nebo částečný název…" value={current.search || ''} onChange={e => onChange({ ...current, search: e.target.value })} />
      <p className="text-xs">Hledání průběžně filtruje celou tabulku. Výběr hodnot zůstává zachován.</p>
      <div className="flex gap-2"><button onClick={() => onChange({ ...current, selected: undefined })}>Vybrat vše</button><button onClick={() => onChange({ ...current, selected: found })}>Vše nalezené</button><button onClick={() => onChange({ ...current, selected: [] })}>Žádné</button><button onClick={() => { setBounds({min:'',max:''}); setError(''); onChange({}); }}>Vymazat filtr</button></div>
      {numeric && <div className="flex gap-2">{(['min','max'] as const).map(key => <label key={key}>{key === 'min' ? 'Od' : 'Do'}<input aria-label={key === 'min' ? 'Od' : 'Do'} value={bounds[key]} onChange={e => setBounds(old => ({...old,[key]:e.target.value}))} onBlur={e => { try { const value=decimal(e.target.value); onChange({ ...current,[key]:value ?? undefined }); setError(''); } catch { setError('Zadejte platné číslo, například 1 250,50.'); } }} /></label>)}</div>}
      {error && <p role="alert">{error}</p>}
      <div className="max-h-72 overflow-auto">{found.map(value => <label className="flex gap-2 p-1" key={value}><input type="checkbox" checked={selected.includes(value)} onChange={e => onChange({ ...current, selected: e.target.checked ? [...new Set([...selected,value])] : selected.filter(v=>v!==value) })} />{value || '(Prázdné)'}</label>)}{!found.length && <p>Žádné odpovídající hodnoty.</p>}</div>
    </div>
  </Modal>;
}
