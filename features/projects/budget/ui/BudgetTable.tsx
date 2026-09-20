import React, { useMemo, useRef, useState } from 'react';
import { ThemedNativeSelect } from '@shared/ui/ThemedNativeSelect';
import { useVirtualizer } from '@tanstack/react-virtual';
import { decimal, evaluateQuantityExpression, filterItems, formatBudgetNumber, multiplyMoney, sumMoney } from '../model/budgetModel';
import type { BudgetFilters } from '../model/budgetModel';
import { aggregateBudget, visibleBudgetRows } from '../model/budgetTree';
import { isPriced } from '../model/types';
import type { BudgetNode } from '../model/types';
import type { BudgetRowTenderProps } from './BudgetRowTenders';
import { BudgetFilter } from './BudgetFilter';
export interface BudgetColumn { key: string; label: string; width: number; numeric?: boolean; hidden?: boolean; pinned?: boolean }
export const DEFAULT_COLUMNS: BudgetColumn[] = [
  { key: 'kind',label:'Typ',width:65,pinned:true }, {key:'code',label:'Kód',width:145,pinned:true},
  {key:'description',label:'Popis',width:420}, {key:'unit',label:'MJ',width:75}, {key:'quantity',label:'Množství',width:125,numeric:true},
  {key:'unitPrice',label:'J. cena',width:125,numeric:true}, {key:'total',label:'Celkem (Kč)',width:145,numeric:true},
  {key:'tenders',label:'Výběrové řízení',width:180},
];
interface Props extends BudgetRowTenderProps {
  pendingTenderItems?: ReadonlySet<string>;
  nodes: BudgetNode[]; scope: string; filters: BudgetFilters; onFilters: (f: BudgetFilters) => void;
  selected: Set<string>; onSelected: (s: Set<string>) => void; showVV: boolean; showNotes?: boolean; wrap: boolean; density: number;
  columns: BudgetColumn[]; onColumns: (c: BudgetColumn[]) => void; canPrices: boolean; editable: boolean;
  expandedVV?: Set<string>; onExpandedVV?: (value: Set<string>) => void;
  figures?: Record<string,string>; onEdit: (node: BudgetNode, editedFields?: readonly string[]) => Promise<void>; jumpId?: string; jumpRequest?: number; onNotice: (message: string) => void;
}
const numberLabel = formatBudgetNumber;
const editableFields = new Set(['code', 'description', 'unit', 'quantity', 'unitPrice', 'total', 'kind']);
const isQuantityDetail = (node: BudgetNode) => node.kind === 'VV' || node.kind === 'note';
const rowHeight = (node: BudgetNode, density: number) => isQuantityDetail(node) ? Math.max(24, density / 2) : density;
interface BudgetContext { x: number; y: number; filter?: { column: string; values: string[] } }
export function BudgetTable(props: Props) {
  const {nodes,scope,filters,onFilters,selected,onSelected,showVV,showNotes=false,wrap,density,columns,onColumns,canPrices,editable,onEdit,jumpId,onNotice}=props;
  const scroll=useRef<HTMLDivElement>(null); const header=useRef<HTMLDivElement>(null); const footer=useRef<HTMLDivElement>(null);
  const [collapsed,setCollapsed]=useState(new Set<string>());
  const [localVV,setLocalVV]=useState(new Set<string>());
  const expandedVV=props.expandedVV??localVV;const setExpandedVV=props.onExpandedVV??setLocalVV;
  const quantityParents=useMemo(()=>new Set(nodes.filter(n=>n.kind==='VV').map(n=>n.parentId)),[nodes]);
  const visibleVV=showVV?true:expandedVV;
  const [filter,setFilter]=useState<BudgetColumn|null>(null); const [detail,setDetail]=useState<BudgetNode|null>(null);
  const filterOrigin=useRef<HTMLButtonElement|null>(null);
  const editLock=useRef(false);
  const anchor=useRef<string|null>(null);
  const [cell,setCell]=useState<{node:BudgetNode;column:BudgetColumn;value:string}|null>(null);
  const inlineCell=useRef<HTMLDivElement>(null);
  React.useEffect(()=>{if(cell)inlineCell.current?.querySelector<HTMLElement>('[role="combobox"], [role="option"][tabindex="0"], input, button')?.focus();},[cell?.node.id,cell?.column.key]);
  const openDetail=(node:BudgetNode)=>{if(editLock.current)return;setCell(null);setEditError('');setDetail(node);};
  const selectRow=(node:BudgetNode,event:React.MouseEvent)=>{
    if(event.detail>1)return;
    if(event.shiftKey&&anchor.current){
      const selectable=rows.filter(isPriced);const start=selectable.findIndex(n=>n.id===anchor.current);const end=selectable.findIndex(n=>n.id===node.id);
      if(start>=0&&end>=0){const range=selectable.slice(Math.min(start,end),Math.max(start,end)+1).map(n=>n.id);onSelected(new Set(event.metaKey||event.ctrlKey?[...selected,...range]:range));return;}
    }
    anchor.current=node.id;
    onSelected(event.metaKey||event.ctrlKey?toggle(selected,node.id):new Set([node.id]));
  };
  const saveCell=async()=>{
    if(!cell||!editable||editLock.current)return;
    editLock.current=true;setBusy(true);setEditError('');
    try{
      const latest=nodes.find(node=>node.id===cell.node.id);
      if(!latest)throw new Error('Položka již není dostupná.');
      if(JSON.stringify(latest[cell.column.key])!==JSON.stringify(cell.node[cell.column.key]))throw new Error('Hodnota se mezitím změnila. Zrušte úpravu a otevřete aktuální buňku.');
      const edited={...latest,[cell.column.key]:cell.column.numeric?decimal(cell.value):cell.value};
      if(['quantity','unitPrice'].includes(cell.column.key))edited.total=edited.quantity!==null&&edited.unitPrice!==null?multiplyMoney(edited.quantity,edited.unitPrice):null;
      await onEdit(edited,[cell.column.key,...(['quantity','unitPrice'].includes(cell.column.key)&&edited.total!==latest.total?['total']:[])]);setCell(null);
    }catch(error){setEditError(error instanceof Error?error.message:'Uložení selhalo.');}
    finally{editLock.current=false;setBusy(false);}
  };
  const [editError,setEditError]=useState(''); const [busy,setBusy]=useState(false);
  const tableRef=useRef<HTMLDivElement>(null);const menuRef=useRef<HTMLDivElement>(null);const menuOrigin=useRef<HTMLElement|null>(null);
  const [contextMenu,setContextMenu]=useState<BudgetContext|null>(null);
  const openContextMenu=(x:number,y:number,origin:HTMLElement,filter?:BudgetContext['filter'])=>{
    const table=tableRef.current;if(!table)return;
    const rect=table.getBoundingClientRect();const scaleX=rect.width/table.offsetWidth||1;const scaleY=rect.height/table.offsetHeight||1;
    menuOrigin.current=origin.closest<HTMLElement>('button,[tabindex]')??table;
    setContextMenu({x:(x-rect.left)/scaleX,y:(y-rect.top)/scaleY,filter});
  };
  const closeContextMenu=(restoreFocus=false)=>{
    setContextMenu(null);
    if(restoreFocus)(menuOrigin.current?.isConnected?menuOrigin.current:tableRef.current)?.focus();
  };
  React.useLayoutEffect(()=>{
    const menu=menuRef.current;const table=tableRef.current;if(!contextMenu||!menu||!table)return;
    menu.style.left=`${Math.max(4,Math.min(contextMenu.x,table.clientWidth-menu.offsetWidth-4))}px`;
    menu.style.top=`${Math.max(4,Math.min(contextMenu.y,table.clientHeight-menu.offsetHeight-4))}px`;
    menu.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  },[contextMenu]);
  React.useEffect(()=>{
    if(!contextMenu)return;
    const dismiss=()=>setContextMenu(null);
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!menuRef.current?.contains(event.target))dismiss();};
    document.addEventListener('pointerdown',outside);window.addEventListener('resize',dismiss);window.addEventListener('scroll',dismiss,true);
    return ()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',dismiss);window.removeEventListener('scroll',dismiss,true);};
  },[contextMenu]);
  const items=useMemo(()=>nodes.filter(n=>isPriced(n)&&(!scope||n.sheetId===scope)),[nodes,scope]);
  const matched=useMemo(()=>filterItems(items,filters),[items,filters]);
  const expandableIds=useMemo(()=>new Set(nodes.filter(n=>n.parentId).map(n=>n.parentId!)),[nodes]);
  const mutedItems=useMemo(()=>new Set(items.filter((_,index)=>index%2===1).map(item=>item.id)),[items]);
  const rows=useMemo(()=>visibleBudgetRows(nodes,new Set(matched.map(n=>n.id)),collapsed,visibleVV,showNotes),[nodes,matched,collapsed,visibleVV,showNotes]);
  const aggregate=useMemo(()=>aggregateBudget(nodes),[nodes]);
  const visibleColumns=useMemo(()=>columns.filter(c=>c.key!=='tags'&&!c.hidden&&(canPrices||!['unitPrice','total'].includes(c.key))).sort((a,b)=>Number(Boolean(b.pinned))-Number(Boolean(a.pinned))),[columns,canPrices]);
  const grid=`44px 42px ${visibleColumns.map(c=>`${c.width}px`).join(' ')}`;
  const width=86+visibleColumns.reduce((sum,c)=>sum+c.width,0);
  const lefts=new Map<string,number>(); let left=86; visibleColumns.forEach(c=>{ if(c.pinned){lefts.set(c.key,left);left+=c.width;} });
  const virtual=useVirtualizer({count:rows.length,getScrollElement:()=>scroll.current,estimateSize:i=>rowHeight(rows[i],density),getItemKey:i=>rows[i].id,overscan:12,useAnimationFrameWithResizeObserver:true});
  const virtualRows=virtual.getVirtualItems();
  React.useEffect(()=>{
    if(cell&&!busy&&(!visibleColumns.some(c=>c.key===cell.column.key)||!virtualRows.some(v=>rows[v.index]?.id===cell.node.id))){
      setCell(null);setEditError('');onNotice('Rozpracovaná úprava byla zrušena, protože buňka již není viditelná.');
    }
  },[cell,busy,virtualRows,rows,visibleColumns,onNotice]);
  React.useLayoutEffect(()=>{
    // Preserve measured sizes and resize mounted rows even while scrolling; measureElement defers then.
    scroll.current?.querySelectorAll<HTMLDivElement>('[data-index]').forEach(row=>virtual.resizeItem(Number(row.dataset.index),row.offsetHeight));
  },[wrap,showVV,columns,density,virtual]);
  React.useEffect(()=>{
    if(!jumpId)return;
    const byId=new Map(nodes.map(n=>[n.id,n]));let parent:string|null=jumpId;const next=new Set(collapsed);while(parent){next.delete(parent);parent=byId.get(parent)?.parentId??null;}
    setCollapsed(next);
    const target=visibleBudgetRows(nodes,new Set(matched.map(n=>n.id)),next,visibleVV,showNotes).findIndex(n=>n.id===jumpId);
    if(target<0)onNotice('Položky cílového oddílu skrývají aktivní filtry. Filtry zůstaly zachované.');
    else requestAnimationFrame(()=>virtual.scrollToIndex(target,{align:'start'}));
    // A jump is an explicit navigation action; filter edits must not repeatedly move the viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[jumpId,props.jumpRequest]);
  const toggle=(set:Set<string>,id:string)=>{const next=new Set(set);next.has(id)?next.delete(id):next.add(id);return next;};
  const groups=useMemo(()=>{
    const byId=new Map(nodes.map(n=>[n.id,n])); const result=new Map<string,BudgetNode[]>();
    for(const item of matched){let parent=item.parentId;const seen=new Set<string>();while(parent&&!seen.has(parent)){seen.add(parent);const list=result.get(parent)||[];list.push(item);result.set(parent,list);parent=byId.get(parent)?.parentId??null;}}
    return result;
  },[nodes,matched]);
  const groupItems=(node:BudgetNode)=>groups.get(node.id)||[];
  const totals=[['CELKEM ROZPOČET',aggregate.total],...(scope?[['CELKEM SOUPIS',aggregate.byId.get(scope)||'0.00']]:[]),['VÝSLEDKY FILTRU',sumMoney(matched.map(n=>n.total))],...(selected.size?[['VÝBĚR',sumMoney(nodes.filter(n=>selected.has(n.id)&&isPriced(n)).map(n=>n.total))]]:[])];
  return <div ref={tableRef} role="region" aria-label="Položky rozpočtu" tabIndex={-1} className="tf-budget-table flex min-h-0 min-w-0 flex-1 flex-col" onContextMenu={event=>{
    if((event.target as HTMLElement).closest('input,textarea,select,[role="dialog"]'))return;
    event.preventDefault();openContextMenu(event.clientX,event.clientY,event.target as HTMLElement);
  }} onKeyDown={event=>{
    if((event.target as HTMLElement).closest('input,textarea,select,[role="dialog"]'))return;
    if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10')){
      event.preventDefault();const origin=event.target as HTMLElement;const rect=origin.getBoundingClientRect();openContextMenu(rect.left+12,rect.top+12,origin);
    }
  }}>
    <div ref={header} className="overflow-hidden shrink-0">
      <div role="row" className="tf-budget-grid tf-budget-heading" style={{gridTemplateColumns:grid,width}}><div className="tf-budget-expand"/><div className="tf-budget-check"><input aria-label="Vybrat všechny výsledky filtru" type="checkbox" checked={matched.length>0&&matched.every(n=>selected.has(n.id))} onChange={e=>onSelected(e.target.checked?new Set([...selected,...matched.map(n=>n.id)]):new Set([...selected].filter(id=>!matched.some(n=>n.id===id))))}/></div>
        {visibleColumns.map(c=><div key={c.key} className={`relative ${c.numeric?'tf-budget-number':''}`} style={c.pinned?{position:'sticky',left:lefts.get(c.key),zIndex:3}:undefined}>
          <button type="button" aria-haspopup="dialog" aria-expanded={filter?.key===c.key} title={`Hledat a filtrovat: ${c.label}`} className={filters[c.key]&&Object.keys(filters[c.key]).length?'tf-budget-active':''} onClick={event=>{filterOrigin.current=event.currentTarget;setFilter(c);}}>{c.label} ▾</button>
          <span role="separator" aria-label={`Šířka ${c.label}`} aria-orientation="vertical" tabIndex={0} className="tf-budget-resize" onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft')onColumns(columns.map(col=>col.key===c.key?{...col,width:Math.max(60,col.width+(e.key==='ArrowRight'?10:-10))}:col));}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.dataset.start=String(e.clientX);e.currentTarget.dataset.width=String(c.width);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId)){const w=Math.max(60,Math.min(1000,Number(e.currentTarget.dataset.width)+e.clientX-Number(e.currentTarget.dataset.start)));onColumns(columns.map(col=>col.key===c.key?{...col,width:w}:col));}}}/>
        </div>)}
      </div>
    </div>
    <div ref={scroll} className="tf-budget-scroll min-h-0 flex-1 overflow-auto" onScroll={e=>{if(header.current)header.current.scrollLeft=e.currentTarget.scrollLeft;if(footer.current)footer.current.scrollLeft=e.currentTarget.scrollLeft;}}>
      <div style={{height:virtual.getTotalSize(),width,position:'relative'}}>
      {virtualRows.map(v=>{const n=rows[v.index];const priced=isPriced(n);const detailRow=isQuantityDetail(n);const itemId=detailRow?n.parentId??n.id:n.id;const group=['object','sheet','section'].includes(n.kind);return <div key={n.id} data-index={v.index} ref={virtual.measureElement} role="row" aria-selected={priced?selected.has(n.id):undefined} className={`tf-budget-grid tf-budget-row ${mutedItems.has(itemId)?'tf-budget-row-muted':''} ${detailRow?'tf-budget-quantity-detail':''} ${group?'tf-budget-group':''} ${selected.has(itemId)?'tf-budget-selected':''}`} style={{gridTemplateColumns:grid,width,position:'absolute',top:0,transform:`translateY(${v.start}px)`,minHeight:rowHeight(n,density)}}>
        <div className="tf-budget-expand">{priced&&!showVV&&<button type="button" className="tf-budget-vv" aria-label={`Výkaz výměr: ${n.code||n.description}`} aria-expanded={expandedVV.has(n.id)} disabled={!quantityParents.has(n.id)} title={quantityParents.has(n.id)?"Výkaz výměr":"Položka nemá výkaz výměr"} onClick={()=>setExpandedVV(toggle(expandedVV,n.id))}>VV</button>}{expandableIds.has(n.id)&&(group||(priced&&showVV))&&<button type="button" className="tf-budget-expand-toggle" aria-label={`${collapsed.has(n.id)?'Rozbalit':'Sbalit'} ${n.code||n.description}`} aria-expanded={!collapsed.has(n.id)} title={collapsed.has(n.id)?'Rozbalit':'Sbalit'} onClick={()=>setCollapsed(toggle(collapsed,n.id))}>{collapsed.has(n.id)?'+':'−'}</button>}</div>
        <div className="tf-budget-check">{(priced||group)&&<input aria-label={`Vybrat ${n.code||n.description}`} type="checkbox" checked={priced?selected.has(n.id):groupItems(n).length>0&&groupItems(n).every(i=>selected.has(i.id))} onChange={e=>{if(priced)onSelected(toggle(selected,n.id));else {const ids=groupItems(n).map(i=>i.id);onSelected(e.target.checked?new Set([...selected,...ids]):new Set([...selected].filter(id=>!ids.includes(id))));}}}/>}</div>
        {visibleColumns.map(c=>{
          let value:React.ReactNode='';
          if(c.key==='description')value=<button className={`tf-budget-description ${wrap?'tf-budget-wrap':''}`} onClick={event=>group?setCollapsed(toggle(collapsed,n.id)):priced?selectRow(n,event):openDetail(n)}>{n.description}</button>;
          else if(c.key==='tenders'&&priced)value=<span aria-busy={props.pendingTenderItems?.has(n.id)||undefined}>{n.tenders.join(', ')||'—'}{props.pendingTenderItems?.has(n.id)&&<small className="tf-budget-assignment-pending">Ukládání…</small>}</span>;
          else if(c.key==='total')value=group?<>{numberLabel(aggregate.byId.get(n.id),true)}{aggregate.incompleteIds.has(n.id)&&<small className="tf-budget-incomplete block">Neúplný součet</small>}</>:priced&&n.total===null?<span className="tf-budget-incomplete">Neoceněno</span>:numberLabel(n.total,true);
          else if(c.key==='quantity'||c.key==='unitPrice')value=numberLabel(n[c.key] as string|null,c.key==='unitPrice');
          else if(c.key==='kind')value=group?'':n.kind==='note'?'Poznámka':n.kind==='subtotal'?'Mezisoučet':n.kind;
          else value=Array.isArray(n[c.key])?(n[c.key] as string[]).join(', '):String(n[c.key]??'');
          return <div key={c.key} tabIndex={priced&&editable&&editableFields.has(c.key)?0:undefined} title={priced&&editable&&editableFields.has(c.key)?'Dvojklik nebo F2 pro úpravu buňky':undefined} className={`${c.numeric?'tf-budget-number':''} ${wrap&&c.key==='description'?'tf-budget-wrap':''}`} style={c.pinned?{position:'sticky',left:lefts.get(c.key),zIndex:2}:undefined} onClick={event=>{if(priced&&c.key!=='description'&&!(event.target as HTMLElement).closest('input,button,select,textarea'))selectRow(n,event);}} onDoubleClick={event=>{if((event.target as HTMLElement).closest('input,select,textarea'))return;if(busy||cell)return;if(priced&&editable&&editableFields.has(c.key)){setDetail(null);setEditError('');setCell({node:n,column:c,value:String(n[c.key]??'')});}else if(priced&&c.key==='description')openDetail(n);}} onKeyDown={event=>{if(busy||cell)return;if(priced&&event.key==='F2'&&editable&&editableFields.has(c.key)){event.preventDefault();setDetail(null);setEditError('');setCell({node:n,column:c,value:String(n[c.key]??'')});}}} onContextMenu={event=>{event.preventDefault();event.stopPropagation();const raw=n[c.key];openContextMenu(event.clientX,event.clientY,event.target as HTMLElement,priced?{column:c.key,values:Array.isArray(raw)?raw as string[]:[raw===null?'':String(raw??'')]}:undefined);}}>{cell?.node.id===n.id&&cell.column.key===c.key?<div ref={inlineCell} className="tf-budget-inline-cell" onKeyDown={event=>{if(event.defaultPrevented)return;event.stopPropagation();if(event.key==='Enter'){event.preventDefault();void saveCell();}if(event.key==='Escape'&&!busy){event.preventDefault();setCell(null);setEditError('');}}}>
            {c.key==='kind'?<ThemedNativeSelect autoFocus aria-label="Upravit Typ" disabled={busy||!editable} value={cell.value} onChange={e=>setCell({...cell,value:e.target.value})} onKeyDown={e=>{e.stopPropagation();if(e.key==='Enter')void saveCell();if(e.key==='Escape'&&!busy)setCell(null);}}><option value="K">K</option><option value="M">M</option></ThemedNativeSelect>:<input autoFocus aria-label={`Upravit ${c.label}`} value={cell.value} disabled={busy||!editable} onChange={event=>setCell({...cell,value:event.target.value})} onKeyDown={event=>{event.stopPropagation();if(event.key==='Enter'){event.preventDefault();void saveCell();}if(event.key==='Escape'&&!busy){event.preventDefault();setCell(null);setEditError('');}}}/>}
            <div><button type="button" aria-label="Uložit změnu" disabled={busy||!editable} onClick={()=>void saveCell()}>✓</button><button type="button" aria-label="Zrušit úpravu" disabled={busy} onClick={()=>{setCell(null);setEditError('');}}>×</button></div>
            {editError&&<p role="alert">{editError}</p>}
          </div>:value}</div>;
        })}
      </div>;})}
      </div>
      {!matched.length&&<div className="p-8" role="status">Žádné položky neodpovídají rozsahu a filtrům.</div>}
    </div>
    <div ref={footer} className="tf-budget-totals overflow-hidden shrink-0">{totals.map(([label,total])=><div className="tf-budget-grid" style={{gridTemplateColumns:grid,width}} key={label}><div/><div/>{visibleColumns.map((c,i)=><div className={c.numeric?'tf-budget-number':''} key={c.key}>{c.key==='total'?numberLabel(total,true):c.key==='description'?label:i===0&&!visibleColumns.some(c=>c.key==='description')?label:''}</div>)}</div>)}{aggregate.incomplete&&<p role="status">Součet neobsahuje položky bez ceny.</p>}</div>
    {contextMenu&&<div ref={menuRef} role="menu" aria-label="Akce rozpočtu" className="tf-budget-context-menu" style={{left:contextMenu.x,top:contextMenu.y}} onContextMenu={event=>{event.preventDefault();event.stopPropagation();}} onKeyDown={event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeContextMenu(true);}
      else if(event.key==='Tab')closeContextMenu();
      else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
        event.preventDefault();const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();
      }
    }}>
      <button type="button" role="menuitem" onClick={()=>{setCollapsed(new Set(showVV?expandableIds:nodes.filter(n=>['object','sheet','section'].includes(n.kind)&&expandableIds.has(n.id)).map(n=>n.id)));setContextMenu(null);virtual.scrollToOffset(0);tableRef.current?.focus();}}>Sbalit vše</button>
      <button type="button" role="menuitem" onClick={()=>{setCollapsed(new Set());setContextMenu(null);tableRef.current?.focus();}}>Rozbalit vše</button>
      {contextMenu.filter&&<button type="button" role="menuitem" onClick={()=>{const row=menuOrigin.current?.closest('[data-index]');const node=row?rows[Number(row.getAttribute('data-index'))]:undefined;if(node)openDetail(node);setContextMenu(null);}}>Detail položky</button>}
      {contextMenu.filter&&<button type="button" role="menuitem" className="tf-budget-context-filter" onClick={()=>{const filter=contextMenu.filter!;onFilters({...filters,[filter.column]:{selected:filter.values}});setContextMenu(null);tableRef.current?.focus();}}>Filtrovat podle této hodnoty</button>}
    </div>}
    {filter&&<BudgetFilter column={filter.key} label={filter.label} numeric={filter.numeric} items={items} filters={filters} onChange={f=>onFilters({...filters,[filter.key]:f})} onClose={()=>{setFilter(null);filterOrigin.current?.focus();}}/>}
    {detail&&<section className="tf-budget-inline-detail" aria-label={`Položka ${detail.code}`}><button type="button" disabled={busy} onClick={()=>{setDetail(null);setEditError('');}}>Zavřít detail</button>
      <form className="tf-budget-controls flex flex-col gap-3" onSubmit={async e=>{e.preventDefault();if(editLock.current||!editable||!isPriced(detail))return;editLock.current=true;setBusy(true);try{const quantity=decimal(detail.quantity);const price=decimal(detail.unitPrice);const original=nodes.find(node=>node.id===detail.id);if(!original)throw new Error('Položka již není dostupná.');const numericChanged=quantity!==original.quantity||price!==original.unitPrice;const edited={...detail,quantity,unitPrice:price,total:numericChanged?(quantity!==null&&price!==null?multiplyMoney(quantity,price):null):original.total};const fields=(['description','quantity','unitPrice','total'] as const).filter(key=>edited[key]!==original[key]);await onEdit(edited,fields);setDetail(null);setEditError('');}catch(error){setEditError(error instanceof Error?error.message:'Uložení selhalo.');}finally{editLock.current=false;setBusy(false);}}}>
        <p>{detail.source.sheet} · řádek {detail.source.row}</p>
        <label>Úplný popis<textarea rows={5} disabled={busy||!editable||!isPriced(detail)} value={detail.description} onChange={e=>setDetail({...detail,description:e.target.value})}/></label>
        <div className="flex gap-2"><label>Množství<input disabled={busy||!editable||!isPriced(detail)} value={detail.quantity??''} onChange={e=>setDetail({...detail,quantity:e.target.value})}/></label>{canPrices&&<label>Jednotková cena<input disabled={busy||!editable||!isPriced(detail)} value={detail.unitPrice??''} onChange={e=>setDetail({...detail,unitPrice:e.target.value})}/></label>}</div>
        <h4>Výkaz výměr a poznámky</h4>{nodes.filter(n=>n.parentId===detail.id).map(n=>{
          const canRecalculate=editable&&n.kind==='VV'&&!/^(Součet|Mezisoučet)$/i.test(n.description);
          let result:string|undefined;let reason='';
          if(canRecalculate){try{result=evaluateQuantityExpression(n.description,props.figures||{});}catch(error){reason=error instanceof Error?error.message:'Výraz nelze přepočítat.';}}
          return <div key={n.id}><p>{n.description} · {numberLabel(n.quantity)} {n.unit}</p>{canRecalculate&&<><button type="button" disabled={busy||result===undefined} onClick={()=>{if(result===undefined)return;setDetail({...detail,quantity:result});setEditError(`Výsledek ${result} je připraven v množství. Potvrďte jej uložením položky.`);}}>Přepočítat výraz a připravit množství</button>{reason&&<p>Přepočet není dostupný: {reason}</p>}</>}</div>;
        })}
        {editError&&<p role="alert">{editError}</p>}{editable&&isPriced(detail)&&<button disabled={busy} type="submit">{busy?'Ukládání…':'Uložit změnu'}</button>}
      </form>
    </section>}
  </div>;
}
