import React, { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Modal } from '@shared/ui/Modal';
import { decimal, evaluateExpression, filterItems, formatBudgetNumber, multiplyMoney, sumMoney } from '../model/budgetModel';
import type { BudgetFilters } from '../model/budgetModel';
import { aggregateBudget, visibleBudgetRows } from '../model/budgetTree';
import { isPriced } from '../model/types';
import type { BudgetNode } from '../model/types';
import { BudgetFilter } from './BudgetFilter';
export interface BudgetColumn { key: string; label: string; width: number; numeric?: boolean; hidden?: boolean; pinned?: boolean }
export const DEFAULT_COLUMNS: BudgetColumn[] = [
  { key: 'kind',label:'Typ',width:65,pinned:true }, {key:'code',label:'Kód',width:145,pinned:true},
  {key:'description',label:'Popis',width:420}, {key:'unit',label:'MJ',width:75}, {key:'quantity',label:'Množství',width:125,numeric:true},
  {key:'unitPrice',label:'J. cena',width:125,numeric:true}, {key:'total',label:'Celkem (Kč)',width:145,numeric:true},
  {key:'tenders',label:'Výběrové řízení',width:180}, {key:'tags',label:'Štítky',width:150},
];
interface Props {
  nodes: BudgetNode[]; scope: string; filters: BudgetFilters; onFilters: (f: BudgetFilters) => void;
  selected: Set<string>; onSelected: (s: Set<string>) => void; showVV: boolean; wrap: boolean; density: number;
  columns: BudgetColumn[]; onColumns: (c: BudgetColumn[]) => void; canPrices: boolean; editable: boolean;
  figures?: Record<string,string>; onEdit: (node: BudgetNode) => Promise<void>; jumpId?: string; onNotice: (message: string) => void;
}
const numberLabel = formatBudgetNumber;
const isQuantityDetail = (node: BudgetNode) => node.kind === 'VV' || node.kind === 'note';
const rowHeight = (node: BudgetNode, density: number) => isQuantityDetail(node) ? Math.max(24, density / 2) : density;
export function BudgetTable(props: Props) {
  const {nodes,scope,filters,onFilters,selected,onSelected,showVV,wrap,density,columns,onColumns,canPrices,editable,onEdit,jumpId,onNotice}=props;
  const scroll=useRef<HTMLDivElement>(null); const header=useRef<HTMLDivElement>(null); const footer=useRef<HTMLDivElement>(null);
  const [collapsed,setCollapsed]=useState(new Set<string>()); const [expanded,setExpanded]=useState(new Set<string>());
  const [filter,setFilter]=useState<BudgetColumn|null>(null); const [detail,setDetail]=useState<BudgetNode|null>(null);
  const editLock=useRef(false);
  const [editError,setEditError]=useState(''); const [busy,setBusy]=useState(false);
  const items=useMemo(()=>nodes.filter(n=>isPriced(n)&&(!scope||n.sheetId===scope)),[nodes,scope]);
  const matched=useMemo(()=>filterItems(items,filters),[items,filters]);
  const mutedItems=useMemo(()=>new Set(items.filter((_,index)=>index%2===1).map(item=>item.id)),[items]);
  const rows=useMemo(()=>visibleBudgetRows(nodes,new Set(matched.map(n=>n.id)),collapsed,showVV),[nodes,matched,collapsed,showVV]);
  const aggregate=useMemo(()=>aggregateBudget(nodes),[nodes]);
  const visibleColumns=useMemo(()=>columns.filter(c=>!c.hidden&&(canPrices||!['unitPrice','total'].includes(c.key))).sort((a,b)=>Number(Boolean(b.pinned))-Number(Boolean(a.pinned))),[columns,canPrices]);
  const grid=`42px ${visibleColumns.map(c=>`${c.width}px`).join(' ')}`;
  const width=42+visibleColumns.reduce((sum,c)=>sum+c.width,0);
  const lefts=new Map<string,number>(); let left=42; visibleColumns.forEach(c=>{ if(c.pinned){lefts.set(c.key,left);left+=c.width;} });
  const virtual=useVirtualizer({count:rows.length,getScrollElement:()=>scroll.current,estimateSize:i=>rowHeight(rows[i],density),getItemKey:i=>rows[i].id,overscan:12});
  React.useLayoutEffect(()=>{
    // Preserve measured sizes and resize mounted rows even while scrolling; measureElement defers then.
    scroll.current?.querySelectorAll<HTMLDivElement>('[data-index]').forEach(row=>virtual.resizeItem(Number(row.dataset.index),row.offsetHeight));
  },[wrap,showVV,expanded,columns,density,virtual]);
  React.useEffect(()=>{
    if(!jumpId)return;
    const byId=new Map(nodes.map(n=>[n.id,n]));let parent:string|null=jumpId;const next=new Set(collapsed);while(parent){next.delete(parent);parent=byId.get(parent)?.parentId??null;}
    setCollapsed(next);
    const target=visibleBudgetRows(nodes,new Set(matched.map(n=>n.id)),next,showVV).findIndex(n=>n.id===jumpId);
    if(target<0)onNotice('Položky cílového oddílu skrývají aktivní filtry. Filtry zůstaly zachované.');
    else requestAnimationFrame(()=>virtual.scrollToIndex(target,{align:'start'}));
    // A jump is an explicit navigation action; filter edits must not repeatedly move the viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[jumpId]);
  const toggle=(set:Set<string>,id:string)=>{const next=new Set(set);next.has(id)?next.delete(id):next.add(id);return next;};
  const groups=useMemo(()=>{
    const byId=new Map(nodes.map(n=>[n.id,n])); const result=new Map<string,BudgetNode[]>();
    for(const item of matched){let parent=item.parentId;const seen=new Set<string>();while(parent&&!seen.has(parent)){seen.add(parent);const list=result.get(parent)||[];list.push(item);result.set(parent,list);parent=byId.get(parent)?.parentId??null;}}
    return result;
  },[nodes,matched]);
  const groupItems=(node:BudgetNode)=>groups.get(node.id)||[];
  const totals=[['CELKEM ROZPOČET',aggregate.total],...(scope?[['CELKEM SOUPIS',aggregate.byId.get(scope)||'0.00']]:[]),['VÝSLEDKY FILTRU',sumMoney(matched.map(n=>n.total))],...(selected.size?[['VÝBĚR',sumMoney(nodes.filter(n=>selected.has(n.id)&&isPriced(n)).map(n=>n.total))]]:[])];
  return <div className="tf-budget-table flex min-h-0 min-w-0 flex-1 flex-col">
    <div ref={header} className="overflow-hidden shrink-0">
      <div role="row" className="tf-budget-grid tf-budget-heading" style={{gridTemplateColumns:grid,width}}><div><input aria-label="Vybrat všechny výsledky filtru" type="checkbox" checked={matched.length>0&&matched.every(n=>selected.has(n.id))} onChange={e=>onSelected(e.target.checked?new Set([...selected,...matched.map(n=>n.id)]):new Set([...selected].filter(id=>!matched.some(n=>n.id===id))))}/></div>
        {visibleColumns.map(c=><div key={c.key} className="relative" style={c.pinned?{position:'sticky',left:lefts.get(c.key),zIndex:3}:undefined}>
          <button className={filters[c.key]&&Object.keys(filters[c.key]).length?'tf-budget-active':''} onClick={()=>setFilter(c)}>{c.label} ▾</button>
          <span role="separator" aria-label={`Šířka ${c.label}`} aria-orientation="vertical" tabIndex={0} className="tf-budget-resize" onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft')onColumns(columns.map(col=>col.key===c.key?{...col,width:Math.max(60,col.width+(e.key==='ArrowRight'?10:-10))}:col));}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.dataset.start=String(e.clientX);e.currentTarget.dataset.width=String(c.width);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId)){const w=Math.max(60,Math.min(1000,Number(e.currentTarget.dataset.width)+e.clientX-Number(e.currentTarget.dataset.start)));onColumns(columns.map(col=>col.key===c.key?{...col,width:w}:col));}}}/>
          <input aria-label={`Filtr ${c.label}`} value={filters[c.key]?.search||''} placeholder="Hledat…" onChange={e=>onFilters({...filters,[c.key]:{...filters[c.key],search:e.target.value}})}/>
        </div>)}
      </div>
    </div>
    <div ref={scroll} className="tf-budget-scroll min-h-0 flex-1 overflow-auto" onScroll={e=>{if(header.current)header.current.scrollLeft=e.currentTarget.scrollLeft;if(footer.current)footer.current.scrollLeft=e.currentTarget.scrollLeft;}}>
      <div style={{height:virtual.getTotalSize(),width,position:'relative'}}>
      {virtual.getVirtualItems().map(v=>{const n=rows[v.index];const priced=isPriced(n);const detailRow=isQuantityDetail(n);const itemId=detailRow?n.parentId??n.id:n.id;const group=['object','sheet','section'].includes(n.kind);return <div key={n.id} data-index={v.index} ref={virtual.measureElement} role="row" className={`tf-budget-grid tf-budget-row ${mutedItems.has(itemId)?'tf-budget-row-muted':''} ${detailRow?'tf-budget-quantity-detail':''} ${group?'tf-budget-group':''} ${selected.has(itemId)?'tf-budget-selected':''}`} style={{gridTemplateColumns:grid,width,position:'absolute',top:0,transform:`translateY(${v.start}px)`,minHeight:rowHeight(n,density)}}>
        <div className="tf-budget-check">{(priced||group)&&<input aria-label={`Vybrat ${n.code||n.description}`} type="checkbox" checked={priced?selected.has(n.id):groupItems(n).length>0&&groupItems(n).every(i=>selected.has(i.id))} onChange={e=>{if(priced)onSelected(toggle(selected,n.id));else {const ids=groupItems(n).map(i=>i.id);onSelected(e.target.checked?new Set([...selected,...ids]):new Set([...selected].filter(id=>!ids.includes(id))));}}}/>}</div>
        {visibleColumns.map(c=>{
          let value:React.ReactNode='';
          if(c.key==='description')value=<><button className={`tf-budget-description ${wrap||expanded.has(n.id)?'tf-budget-wrap':''}`} onClick={()=>group?setCollapsed(toggle(collapsed,n.id)):setDetail(n)}>{group?`${collapsed.has(n.id)?'▸':'▾'} `:''}{n.description}</button>{priced&&<button className="tf-budget-description-toggle" onClick={()=>setExpanded(toggle(expanded,n.id))}>{expanded.has(n.id)?'Zkrátit popis':'Celý popis'}</button>}</>;
          else if(c.key==='total')value=group?<>{numberLabel(aggregate.byId.get(n.id),true)}{aggregate.incompleteIds.has(n.id)&&<small className="tf-budget-incomplete block">Neúplný součet</small>}</>:priced&&n.total===null?<span className="tf-budget-incomplete">Chybí cena</span>:numberLabel(n.total,true);
          else if(c.key==='quantity'||c.key==='unitPrice')value=numberLabel(n[c.key] as string|null,c.key==='unitPrice');
          else if(c.key==='kind')value=group?'':n.kind==='note'?n.sourceType:n.kind;
          else value=Array.isArray(n[c.key])?(n[c.key] as string[]).join(', '):String(n[c.key]??'');
          return <div key={c.key} className={`${c.numeric?'tf-budget-number':''} ${wrap?'tf-budget-wrap':''}`} style={c.pinned?{position:'sticky',left:lefts.get(c.key),zIndex:2}:undefined} onDoubleClick={()=>{if(priced&&editable)setDetail(n);}} onContextMenu={e=>{e.preventDefault();const raw=n[c.key];onFilters({...filters,[c.key]:{selected:Array.isArray(raw)?raw as string[]:[raw===null?'':String(raw??'')]}});}}>{value}</div>;
        })}
      </div>;})}
      </div>
      {!matched.length&&<div className="p-8" role="status">Žádné položky neodpovídají rozsahu a filtrům.</div>}
    </div>
    <div ref={footer} className="tf-budget-totals overflow-hidden shrink-0">{totals.map(([label,total])=><div className="tf-budget-grid" style={{gridTemplateColumns:grid,width}} key={label}><div/>{visibleColumns.map((c,i)=><div className={c.numeric?'tf-budget-number':''} key={c.key}>{c.key==='total'?numberLabel(total,true):c.key==='description'?label:i===0&&!visibleColumns.some(c=>c.key==='description')?label:''}</div>)}</div>)}{aggregate.incomplete&&<p role="status">Součet neobsahuje položky bez ceny.</p>}</div>
    {filter&&<BudgetFilter column={filter.key} label={filter.label} numeric={filter.numeric} items={items} filters={filters} onChange={f=>onFilters({...filters,[filter.key]:f})} onClose={()=>setFilter(null)}/>}
    {detail&&<Modal isOpen title={`Položka ${detail.code}`} onClose={()=>{if(!busy){setDetail(null);setEditError('');}}} persistent={busy}>
      <form className="tf-budget-controls flex flex-col gap-3" onSubmit={async e=>{e.preventDefault();if(editLock.current||!editable||!isPriced(detail))return;editLock.current=true;setBusy(true);try{const quantity=decimal(detail.quantity);const price=decimal(detail.unitPrice);await onEdit({...detail,quantity,unitPrice:price,total:quantity!==null&&price!==null?multiplyMoney(quantity,price):null});setDetail(null);setEditError('');}catch(error){setEditError(error instanceof Error?error.message:'Uložení selhalo.');}finally{editLock.current=false;setBusy(false);}}}>
        <p>{detail.source.sheet} · řádek {detail.source.row}</p>
        <label>Úplný popis<textarea rows={5} disabled={busy||!editable||!isPriced(detail)} value={detail.description} onChange={e=>setDetail({...detail,description:e.target.value})}/></label>
        <div className="flex gap-2"><label>Množství<input disabled={busy||!editable||!isPriced(detail)} value={detail.quantity??''} onChange={e=>setDetail({...detail,quantity:e.target.value})}/></label>{canPrices&&<label>Jednotková cena<input disabled={busy||!editable||!isPriced(detail)} value={detail.unitPrice??''} onChange={e=>setDetail({...detail,unitPrice:e.target.value})}/></label>}</div>
        <h4>Výkaz výměr a poznámky</h4>{nodes.filter(n=>n.parentId===detail.id).map(n=><div key={n.id}><p>{n.description} · {numberLabel(n.quantity)} {n.unit}</p>{editable&&n.kind==='VV'&&!/^(Součet|Mezisoučet)$/i.test(n.description)&&<button type="button" onClick={()=>{try{const result=evaluateExpression(n.description,props.figures||{});setDetail({...detail,quantity:result});setEditError(`Výsledek ${result} je připraven v množství. Potvrďte jej uložením položky.`);}catch(e){setEditError(e instanceof Error?e.message:'Výraz nelze přepočítat.');}}}>Přepočítat výraz a připravit množství</button>}</div>)}
        {editError&&<p role="alert">{editError}</p>}{editable&&isPriced(detail)&&<button disabled={busy} type="submit">{busy?'Ukládání…':'Uložit změnu'}</button>}
      </form>
    </Modal>}
  </div>;
}
