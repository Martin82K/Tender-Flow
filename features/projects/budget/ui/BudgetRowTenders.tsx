import React, { useRef, useState } from 'react';
import { ThemedNativeSelect } from '@shared/ui/ThemedNativeSelect';
import type { BudgetAllocation, BudgetNode } from '../model/types';

export interface BudgetRowTenderProps {
  categories?: readonly { id: string; title: string }[];
  allocations?: readonly BudgetAllocation[];
  canAllocate?: boolean;
  onCreateTender?: (name: string) => Promise<{id:string;title:string}>;
  onAllocate?: (itemId: string, categoryId: string) => Promise<void>;
  onRemoveAllocation?: (allocation: BudgetAllocation) => Promise<void>;
}
export function BudgetRowTenders({ node, categories = [], allocations = [], canAllocate, onAllocate, onRemoveAllocation, onCreateTender }: BudgetRowTenderProps & { node: BudgetNode }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [creating,setCreating]=useState(false);
  const [newName,setNewName]=useState('');
  const [created,setCreated]=useState<{id:string;title:string}|null>(null);
  const options=created&&!categories.some(c=>c.id===created.id)?[...categories,created]:categories;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const assigned = allocations.filter(a => a.itemId === node.id);
  const run = async (action: () => Promise<void>) => {
    if (!canAllocate || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); setCategory(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Přiřazení nelze uložit.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div className="tf-budget-row-tenders">
    <button type="button" aria-label={`VŘ: ${node.code || node.description}`} aria-expanded={open} onClick={() => setOpen(!open)}>{(assigned.length ? [...new Set(assigned.map(a => options.find(c => c.id === a.categoryId)?.title || 'Nedostupné VŘ'))].join(', ') : node.tenders.join(', ')) || 'Přiřadit VŘ'} {open ? '▴' : '▾'}</button>
    {open && <div className="tf-budget-row-tender-fields">
      {assigned.map((a, i) => <div key={`${a.categoryId}:${i}`}><span>{options.find(c => c.id === a.categoryId)?.title || 'Nedostupné VŘ'} · {a.quantity} {node.unit}</span>{canAllocate && onRemoveAllocation && <button type="button" disabled={busy} aria-label={`Odebrat ${options.find(c => c.id === a.categoryId)?.title || 'VŘ'}`} onClick={() => void run(() => onRemoveAllocation(a))}>×</button>}</div>)}
      {canAllocate && onAllocate && <>
        <small>Celá položka: {node.quantity ?? '—'} {node.unit}</small>
        <ThemedNativeSelect searchable aria-label="Cílové VŘ" value={category} disabled={busy} onChange={e => setCategory(e.target.value)}><option value="">Vyberte VŘ</option>{options.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</ThemedNativeSelect>
        <button type="button" disabled={busy || !category} onClick={() => void run(() => onAllocate(node.id, category))}>{busy ? 'Ukládání…' : assigned.length ? 'Změnit VŘ' : 'Přiřadit VŘ'}</button>
        {onCreateTender&&<>
          <button type="button" disabled={busy} aria-expanded={creating} onClick={()=>setCreating(!creating)}>Nové VŘ</button>
          {creating&&<><input aria-label="Název nového VŘ" placeholder="Název VŘ" maxLength={255} value={newName} disabled={busy} onChange={e=>setNewName(e.target.value)}/><small>Nové VŘ se uloží do číselníku stavby.</small><button type="button" disabled={busy||!newName.trim()} onClick={()=>void run(async()=>{const tender=await onCreateTender(newName);setCreated(tender);setCategory(tender.id);await onAllocate(node.id,tender.id);setNewName('');setCreating(false);})}>Vytvořit a přiřadit</button></>}
        </>}
        {!options.length&&!onCreateTender&&<small>Číselník zatím neobsahuje VŘ. Vytvořit je může uživatel s oprávněním upravovat VŘ.</small>}
      </>}
      {error && <p role="alert">{error}</p>}
    </div>}
  </div>;
}
