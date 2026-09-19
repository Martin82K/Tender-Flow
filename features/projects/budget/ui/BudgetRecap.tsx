import React, { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { aggregateBudget } from '../model/budgetTree';
import { formatBudgetNumber, normalizeSearch } from '../model/budgetModel';
import type { BudgetNode } from '../model/types';
export function BudgetRecap({nodes,onJump,prices}:{nodes:BudgetNode[];onJump:(n:BudgetNode)=>void;prices:boolean}) {
  const [search,setSearch]=useState('');const [collapsed,setCollapsed]=useState(new Set<string>());const scroll=useRef<HTMLDivElement>(null);
  const totals=useMemo(()=>aggregateBudget(nodes),[nodes]);
  const byId=useMemo(()=>new Map(nodes.map(n=>[n.id,n])),[nodes]);
  const rows=useMemo(()=>nodes.filter(n=>['object','sheet','section'].includes(n.kind)).filter(n=>{
    if(search)return normalizeSearch(`${n.code} ${n.description} ${n.source.sheet}`).includes(normalizeSearch(search));
    let parent=n.parentId;while(parent){if(collapsed.has(parent))return false;parent=byId.get(parent)?.parentId??null;}return true;
  }),[nodes,search,collapsed,byId]);
  const virtual=useVirtualizer({count:rows.length,getScrollElement:()=>scroll.current,estimateSize:()=>64,overscan:8});
  return <aside className="tf-budget-recap flex min-h-0 flex-col"><h3>Rekapitulace</h3><p className="tf-budget-muted">Celý rozpočet{prices ? ` · ${formatBudgetNumber(totals.total,true)} Kč` : ''}</p>{prices&&totals.incomplete&&<p role="status" className="tf-budget-incomplete">Neúplný součet. Některým položkám chybí cena.</p>}<input aria-label="Hledat oddíl" placeholder="Objekt, soupis nebo oddíl…" value={search} onChange={e=>setSearch(e.target.value)}/>{!rows.length&&<p role="status" className="tf-budget-muted py-4">{search?'Žádný oddíl neodpovídá hledání.':'Rozpočet neobsahuje žádné oddíly.'}</p>}<div ref={scroll} className="min-h-0 flex-1 overflow-auto"><div style={{height:virtual.getTotalSize(),position:'relative'}}>{virtual.getVirtualItems().map(v=>{const n=rows[v.index];return <div key={n.id} className="tf-budget-recap-row" style={{position:'absolute',top:v.start,height:v.size,left:0,right:0}}><button aria-label={`${collapsed.has(n.id)?'Rozbalit':'Sbalit'} ${n.description}`} onClick={()=>setCollapsed(old=>{const next=new Set(old);next.has(n.id)?next.delete(n.id):next.add(n.id);return next;})}>{collapsed.has(n.id)?'▸':'▾'}</button><button onClick={()=>onJump(n)}><span title={`${n.code} ${n.description}`}>{n.code} {n.description}</span>{prices&&<small>{formatBudgetNumber(totals.byId.get(n.id)||'0',true)} Kč{totals.incompleteIds.has(n.id)&&<span className="tf-budget-incomplete">Neúplný součet</span>}</small>}</button></div>;})}</div></div></aside>;
}
