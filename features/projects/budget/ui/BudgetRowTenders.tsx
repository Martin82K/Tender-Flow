import React, { useRef, useState } from 'react';
import { ThemedNativeSelect } from '@shared/ui/ThemedNativeSelect';
import type { BudgetAllocation } from '../model/types';

export interface BudgetRowTenderProps {
  categories?: readonly { id: string; title: string }[];
  allocations?: readonly BudgetAllocation[];
  canAllocate?: boolean;
  allocationDisabledReason?: string;
  onCreateTender?: (name: string) => Promise<{id:string;title:string;warning?:string}>;
  onAllocate?: (itemId: string, categoryId: string) => Promise<void>;
  onAllocateSelection?: (itemIds: readonly string[], categoryId: string) => Promise<void>;
  onRemoveSelection?: (itemIds: readonly string[]) => Promise<void>;
  onRemoveAllocation?: (allocation: BudgetAllocation) => Promise<void>;
}
interface Props {
  inline?: boolean;
  itemIds: readonly string[];
  categories?: BudgetRowTenderProps['categories'];
  disabled?: boolean;
  disabledReason?: string;
  onAssign: (categoryId: string) => Promise<void>;
  onCreateTender?: BudgetRowTenderProps['onCreateTender'];
  onRemove?: () => Promise<void>;
  onClose?: () => void;
}
export function BudgetSelectionTenders({inline=false,itemIds,categories=[],disabled,disabledReason,onAssign,onCreateTender,onRemove,onClose}:Props) {
  const [creating,setCreating]=useState(false),[name,setName]=useState(''),[error,setError]=useState(''),[warning,setWarning]=useState(''),[busy,setBusy]=useState(false);
  const [created,setCreated]=useState<{id:string;title:string}|null>(null);
  const options=created&&!categories.some(c=>c.id===created.id)?[...categories,created]:categories;
  const selectionKey=JSON.stringify([...itemIds].sort());
  const latest=useRef({selectionKey,onAssign,disabled});latest.current={selectionKey,onAssign,disabled};
  const lock=useRef(false);
  const mounted=useRef(true);React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const run=async(action:()=>Promise<void>)=>{
    if(disabled||!itemIds.length||lock.current)return;
    lock.current=true;setBusy(true);setError('');
    try{await action();}catch(e){const message=e instanceof Error?e.message:'Přiřazení nelze uložit.';setError(/failed to fetch|networkerror|network request failed/i.test(message)?'Spojení se serverem selhalo. Výsledek zápisu není potvrzený; zopakujte stejný výběr VŘ.':message);}finally{lock.current=false;setBusy(false);}
  };
  return <section className={`tf-budget-assignment-strip${inline?' tf-budget-assignment-inline':''}`} aria-label="Přiřazení VŘ výběru">
    {!inline&&<small>{itemIds.length} položek · celé množství</small>}
    <div className="tf-budget-assignment-select">
      {creating?<input autoFocus aria-label="Název nového VŘ" placeholder="Název nového VŘ" maxLength={255} value={name} disabled={busy||disabled} onChange={e=>setName(e.target.value)}/>:<ThemedNativeSelect compact searchable wrapOptions menuMinWidth={420} menuAlign="end" className="w-full" aria-label="VŘ pro vybrané položky" value="" disabled={busy||disabled||!itemIds.length} onChange={e=>{const id=e.target.value;if(id)void run(()=>onAssign(id));}}><option value="">{busy?'Ukládání…':'Přiřadit VŘ'}</option>{options.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</ThemedNativeSelect>}
    </div>
    {onCreateTender&&(creating?<button disabled={busy||disabled||!name.trim()} onClick={()=>void run(async()=>{
      const tender=await onCreateTender(name);if(!mounted.current)return;setCreated(tender);setCreating(false);setName('');setWarning(tender.warning??'');
      if(latest.current.selectionKey!==selectionKey||latest.current.disabled)throw new Error('Výběr nebo oprávnění se změnily. Nové VŘ je uložené; vyberte je znovu.');
      await latest.current.onAssign(tender.id);setCreating(false);setName('');
    })}>Vytvořit a přiřadit</button>:<button aria-label="Nové VŘ" title="Nové VŘ" disabled={busy||disabled} onClick={()=>setCreating(true)}>+</button>)}
    {onRemove&&!creating&&<button disabled={busy||disabled} onClick={()=>void run(onRemove)}>Odebrat VŘ</button>}
    {(creating||onClose)&&<button aria-label="Zavřít přiřazení" disabled={busy} onClick={()=>{if(creating)setCreating(false);else onClose?.();}}>×</button>}
    {disabled&&disabledReason&&<small role="status" className="tf-budget-assignment-message">{disabledReason}</small>}
    {warning&&<small role="status" className="tf-budget-assignment-message">{warning}</small>}
    {error&&<small role="alert" className="tf-budget-assignment-message">{error}</small>}
  </section>;
}
