import React, { useState } from 'react';
import { Modal } from '@shared/ui/Modal';
import { ThemedNativeSelect } from '@shared/ui/ThemedNativeSelect';
import { exportBudget } from '../api/budgetExport';
import type { BudgetExportScope } from '../api/budgetExport';
import type { BudgetAllocation, BudgetNode } from '../model/types';
interface Props {
  nodes: BudgetNode[]; allocations: BudgetAllocation[]; categories: Array<{id:string;title:string}>;
  canViewPrices: boolean; selectedIds?: string[]; onClose: () => void;
}
export function BudgetExportDialog({nodes,allocations,categories,canViewPrices,selectedIds,onClose}:Props) {
  const [scope,setScope]=useState<'whole'|'tender'|'selection'>(selectedIds?.length?'selection':'whole');
  const [categoryId,setCategoryId]=useState('');
  const [prices,setPrices]=useState(false);
  const [error,setError]=useState('');
  const activeCategory=categories.find(category=>category.id===categoryId);
  const download=()=>{
    setError('');
    try {
      const exportScope:BudgetExportScope=scope==='tender'?{kind:scope,categoryId,title:activeCategory?.title??''}:scope==='selection'?{kind:scope,itemIds:selectedIds??[]}:{kind:scope};
      const includePrices=prices&&canViewPrices;
      exportBudget(nodes,includePrices?'rozpocet-s-cenami.xlsx':'poptavkovy-soupis.xlsx',{scope:exportScope,allocations,includePrices,canViewPrices});
      onClose();
    } catch(cause) {setError(cause instanceof Error?cause.message:'Export se nepodařilo vytvořit.');}
  };
  return <Modal isOpen title="Export rozpočtu do XLSX" onClose={onClose}><div className="tf-budget-controls flex flex-col gap-3">
    <label>Rozsah exportu<ThemedNativeSelect aria-label="Rozsah exportu" value={scope} onChange={event=>setScope(event.target.value as typeof scope)}>
      <option value="whole">Celý rozpočet</option><option value="tender">Vybrané VŘ</option>
      {!!selectedIds?.length&&<option value="selection">Vybrané položky ({selectedIds.length})</option>}
    </ThemedNativeSelect></label>
    {scope==='tender'&&<label>Výběrové řízení<ThemedNativeSelect aria-label="Výběrové řízení" value={categoryId} onChange={event=>setCategoryId(event.target.value)}><option value="">Vyberte VŘ</option>{categories.map(category=><option key={category.id} value={category.id}>{category.title}</option>)}</ThemedNativeSelect></label>}
    <label><input type="checkbox" checked={prices&&canViewPrices} disabled={!canViewPrices} onChange={event=>setPrices(event.target.checked)}/>Zahrnout ceny rozpočtu</label>
    <p>{prices&&canViewPrices?'Export obsahuje jednotkové ceny a součty.':'Poptávkový soupis má prázdné jednotkové ceny. Po jejich doplnění se částky a rekapitulace spočítají; neúplné součty zůstanou prázdné. Interní ceny neobsahuje.'}</p>
    <p>Soubor zachová objekty, soupisy a oddíly včetně pododdílů a přidá rekapitulaci. U VŘ obsahuje pouze přiřazená množství. Filtry zobrazení rozsah exportu nemění.</p>
    {!canViewPrices&&<p>Vaše oprávnění dovoluje pouze export bez cen.</p>}
    {error&&<p role="alert">{error}</p>}
    <button disabled={scope==='tender'&&!activeCategory} onClick={download}>Stáhnout XLSX</button>
  </div></Modal>;
}
