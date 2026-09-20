import React, { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { aggregateBudget, budgetRecapTree } from '../model/budgetTree';
import { formatBudgetNumber, normalizeSearch } from '../model/budgetModel';
import type { BudgetNode } from '../model/types';

export function BudgetRecap({nodes,onJump,prices,activeId,prominentTotal=true}:{nodes:BudgetNode[];onJump:(n:BudgetNode)=>void;prices:boolean;activeId?:string;prominentTotal?:boolean}) {
  const [search,setSearch]=useState('');
  const [collapsed,setCollapsed]=useState(new Set<string>());
  const [searchCollapsed,setSearchCollapsed]=useState(new Set<string>());
  const [selectedId,setSelectedId]=useState(activeId??'');
  const [focusedId,setFocusedId]=useState('');
  const [contextMenu,setContextMenu]=useState<{x:number;y:number}|null>(null);
  const panel=useRef<HTMLElement>(null);const scroll=useRef<HTMLDivElement>(null);const menu=useRef<HTMLDivElement>(null);
  const treeId=React.useId();
  const totals=useMemo(()=>aggregateBudget(nodes),[nodes]);
  const entries=useMemo(()=>budgetRecapTree(nodes),[nodes]);
  const byId=useMemo(()=>new Map(entries.map(entry=>[entry.node.id,entry])),[entries]);
  const query=normalizeSearch(search);
  const included=useMemo(()=>{
    if(!query)return new Set(entries.map(entry=>entry.node.id));
    const matching=new Set<string>();
    for(const entry of entries){
      if(normalizeSearch(`${entry.node.code} ${entry.node.description}`).includes(query)||(entry.parentId&&matching.has(entry.parentId)))matching.add(entry.node.id);
    }
    const result=new Set(matching);
    for(const id of matching){let parent=byId.get(id)?.parentId;while(parent){result.add(parent);parent=byId.get(parent)?.parentId;}}
    return result;
  },[entries,byId,query]);
  const expandable=useMemo(()=>new Set(entries.filter(entry=>included.has(entry.node.id)&&entry.parentId).map(entry=>entry.parentId!)),[entries,included]);
  const closed=query?searchCollapsed:collapsed;
  const rows=useMemo(()=>{
    const hidden=new Set<string>();
    return entries.filter(entry=>{
      if(entry.parentId&&(closed.has(entry.parentId)||hidden.has(entry.parentId))){hidden.add(entry.node.id);return false;}
      return included.has(entry.node.id);
    });
  },[entries,included,closed]);
  const virtual=useVirtualizer({count:rows.length,getScrollElement:()=>scroll.current,estimateSize:()=>prices?56:40,getItemKey:index=>rows[index].node.id,overscan:8,useAnimationFrameWithResizeObserver:true});
  const visibleItems=virtual.getVirtualItems();
  const focused=rows.some(entry=>entry.node.id===focusedId)?focusedId:rows[0]?.node.id;
  const setClosed=(next:Set<string>)=>query?setSearchCollapsed(next):setCollapsed(next);
  const focusEntry=(id:string)=>{
    setFocusedId(id);scroll.current?.focus({preventScroll:true});
    const index=rows.findIndex(entry=>entry.node.id===id);
    if(index>=0)virtual.scrollToIndex(index,{align:'auto'});
  };
  const toggle=(id:string)=>{const next=new Set(closed);next.has(id)?next.delete(id):next.add(id);setClosed(next);setFocusedId(id);scroll.current?.focus({preventScroll:true});};
  const select=(node:BudgetNode)=>{setSelectedId(node.id);setFocusedId(node.id);scroll.current?.focus({preventScroll:true});onJump(node);};
  React.useEffect(()=>{if(activeId!==undefined)setSelectedId(activeId);},[activeId]);
  const closeMenu=()=>{setContextMenu(null);scroll.current?.focus({preventScroll:true});};
  const openMenu=(x:number,y:number)=>{
    const element=panel.current;if(!element)return;
    const rect=element.getBoundingClientRect();
    setContextMenu({x:(x-rect.left)/(rect.width/element.offsetWidth||1),y:(y-rect.top)/(rect.height/element.offsetHeight||1)});
  };
  React.useLayoutEffect(()=>{
    if(!contextMenu||!menu.current||!panel.current)return;
    menu.current.style.left=`${Math.max(4,Math.min(contextMenu.x,panel.current.clientWidth-menu.current.offsetWidth-4))}px`;
    menu.current.style.top=`${Math.max(4,Math.min(contextMenu.y,panel.current.clientHeight-menu.current.offsetHeight-4))}px`;
    menu.current.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  },[contextMenu]);
  React.useEffect(()=>{
    if(!contextMenu)return;
    const dismiss=()=>setContextMenu(null);
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!menu.current?.contains(event.target))dismiss();};
    document.addEventListener('pointerdown',outside);window.addEventListener('resize',dismiss);window.addEventListener('scroll',dismiss,true);
    return ()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',dismiss);window.removeEventListener('scroll',dismiss,true);};
  },[contextMenu]);
  const keyboard=(event:React.KeyboardEvent<HTMLDivElement>)=>{
    const id=(event.target as HTMLElement).closest<HTMLElement>('[data-tree-id]')?.dataset.treeId??focused;
    const index=rows.findIndex(entry=>entry.node.id===id);const entry=rows[index];if(!entry)return;
    if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10')){
      event.preventDefault();const rect=(event.target as HTMLElement).getBoundingClientRect();openMenu(rect.left+12,rect.top+20);return;
    }
    if(!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End','Enter',' '].includes(event.key))return;
    event.preventDefault();
    if(event.key==='ArrowDown')focusEntry(rows[Math.min(index+1,rows.length-1)].node.id);
    else if(event.key==='ArrowUp')focusEntry(rows[Math.max(index-1,0)].node.id);
    else if(event.key==='Home')focusEntry(rows[0].node.id);
    else if(event.key==='End')focusEntry(rows[rows.length-1].node.id);
    else if(event.key==='ArrowRight'&&expandable.has(id!)){if(closed.has(id!))toggle(id!);else if(rows[index+1])focusEntry(rows[index+1].node.id);}
    else if(event.key==='ArrowLeft'){if(expandable.has(id!)&&!closed.has(id!))toggle(id!);else if(entry.parentId)focusEntry(entry.parentId);}
    else if(event.key==='Enter'||event.key===' ')select(entry.node);
  };
  return <aside ref={panel} className="tf-budget-recap flex min-h-0 flex-col" onContextMenu={event=>{
    if((event.target as HTMLElement).closest('input,[role="menu"]'))return;
    event.preventDefault();openMenu(event.clientX,event.clientY);
  }}>
    <h3>Rekapitulace</h3>
    {prices&&prominentTotal?<section aria-label="Cena celkem" className="tf-budget-recap-total">
      <div><h4>Cena celkem</h4><p className="tf-budget-muted">Celý rozpočet · bez DPH</p></div>
      <strong>{formatBudgetNumber(totals.total,true)} Kč</strong>
    </section>:<p className="tf-budget-muted">Celý rozpočet{prices?` · ${formatBudgetNumber(totals.total,true)} Kč`:''}</p>}
    {prices&&totals.incomplete&&<p role="status" className="tf-budget-incomplete">Neúplný součet. Některým položkám chybí cena.</p>}
    <input aria-label="Hledat oddíl" placeholder="Objekt, soupis nebo oddíl…" value={search} onChange={event=>{setSearch(event.target.value);setSearchCollapsed(new Set());setFocusedId('');if(scroll.current)scroll.current.scrollTop=0;}}/>
    {prices&&<div className="tf-budget-recap-columns" aria-hidden="true"><span>Objekt / soupis / oddíl</span><span>Cena bez DPH (Kč)</span></div>}
    {!rows.length&&<p role="status" className="tf-budget-muted py-4">{query?'Žádný oddíl neodpovídá hledání.':'Rozpočet neobsahuje žádné oddíly.'}</p>}
    <div ref={scroll} role="tree" aria-label="Strom rozpočtu" tabIndex={0} aria-activedescendant={visibleItems.some(item=>rows[item.index].node.id===focused)?`${treeId}-${focused}`:undefined} className="tf-budget-recap-tree min-h-0 flex-1 overflow-auto" onKeyDown={keyboard}>
      <div role="none" style={{height:virtual.getTotalSize(),position:'relative'}}>{visibleItems.map(item=>{
        const entry=rows[item.index];const n=entry.node;const label=`${n.code} ${n.description}`.trim();const branch=expandable.has(n.id);
        return <div key={n.id} id={`${treeId}-${n.id}`} data-tree-id={n.id} role="treeitem" aria-label={label} aria-level={entry.depth+1} aria-posinset={entry.position} aria-setsize={entry.siblings} aria-selected={selectedId===n.id} aria-expanded={branch?!closed.has(n.id):undefined} className={`tf-budget-recap-row ${focused===n.id?'tf-budget-recap-focused':''}`} style={{position:'absolute',top:item.start,height:item.size,left:0,right:0,paddingLeft:6+entry.depth*16}} onClick={()=>select(n)}>
          <span className="tf-budget-recap-toggle">{branch&&<button type="button" tabIndex={-1} aria-label={`${closed.has(n.id)?'Rozbalit':'Sbalit'} ${label}`} aria-expanded={!closed.has(n.id)} onClick={event=>{event.stopPropagation();toggle(n.id);}}>{closed.has(n.id)?'+':'−'}</button>}</span>
          <span className="tf-budget-recap-label"><span className="tf-budget-recap-name" title={label}>{label}</span>{prices&&<small>{formatBudgetNumber(totals.byId.get(n.id)||'0',true)} Kč{totals.incompleteIds.has(n.id)&&<span className="tf-budget-incomplete">Neúplný součet</span>}</small>}</span>
        </div>;
      })}</div>
    </div>
    {contextMenu&&<div ref={menu} role="menu" aria-label="Akce stromu rozpočtu" className="tf-budget-context-menu" onKeyDown={event=>{
      if(event.key==='Escape'){event.preventDefault();closeMenu();}
      else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
        event.preventDefault();const buttons=Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button')??[]);const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus();
      }else if(event.key==='Tab')setContextMenu(null);
    }}>
      <button type="button" role="menuitem" onClick={()=>{setClosed(new Set(expandable));setFocusedId(rows[0]?.node.id??'');virtual.scrollToOffset(0);closeMenu();}}>Sbalit vše</button>
      <button type="button" role="menuitem" onClick={()=>{setClosed(new Set());closeMenu();}}>Rozbalit vše</button>
    </div>}
  </aside>;
}
