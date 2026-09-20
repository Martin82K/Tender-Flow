import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChartNoAxesColumnIncreasing, ChevronDown, Import, Layers, Library, List, MoreHorizontal, Network, Settings, LockKeyhole, UnlockKeyhole, ListChecks, ListX } from 'lucide-react';
import { PROJECT_DETAILS_KEYS } from '@shared/queryKeys/projectDetailKeys';
import { ThemedNativeSelect } from '@shared/ui/ThemedNativeSelect';
import { Modal } from '@shared/ui/Modal';
import type { DemandCategory } from '@/types';
import { createBudgetTender } from '../api/createBudgetTender';
import { budgetApi } from '../api/budgetApi';
import type { BudgetAssignmentRequest, BudgetItemEditRequest, BudgetUndoRequest } from '../api/budgetApi';
import { BudgetExportDialog } from './BudgetExportDialog';
import { BudgetSelectionTenders } from './BudgetRowTenders';
import { BudgetTable, DEFAULT_COLUMNS } from './BudgetTable';
import type { BudgetColumn } from './BudgetTable';
import { BudgetVersions } from './BudgetVersions';
import { BudgetCatalogDialog } from './BudgetCatalogDialog';
import { BudgetRecap } from './BudgetRecap';
import { BudgetTenderCatalog } from './BudgetTenderCatalog';
import { BudgetTenderTemplates } from "./BudgetTenderTemplates";
import { BudgetImportDialog } from './BudgetImportDialog';
import { decimal, formatBudgetNumber, allocatedMoney, normalizeSearch, sumMoney } from '../model/budgetModel';
import type { BudgetFilters } from '../model/budgetModel';
import { isPriced } from '../model/types';
import type { BudgetNode, BudgetAllocation, BudgetDocument, BudgetRevision, BudgetSource } from '../model/types';
import { applyBudgetItemEdit, assignWholeItems, syncWholeItemQuantity, validateRevisionAllocations } from '../model/revisions';
import './budget.css';
interface Props { canUseTenders?:boolean; projectId:string; organizationId?:string; userId?:string; categories:DemandCategory[]; readOnly?:boolean; searchQuery?:string; onSearchChange?:(value:string)=>void }
interface ViewSettings { scope:string; showVV:boolean; showNotes:boolean; panel:boolean; wrap:boolean; grid:boolean; density:number; columns:BudgetColumn[]; recent:string[]; pinned:string[] }
const defaults:ViewSettings={scope:'',showVV:false,showNotes:false,panel:true,wrap:false,grid:false,density:44,columns:DEFAULT_COLUMNS,recent:[],pinned:[]};
export function ConstructionBudget({canUseTenders=false,projectId,organizationId,userId,categories:incomingCategories,readOnly=false,searchQuery='',onSearchChange}:Props) {
  const cache=useQueryClient();const key=['construction-budget',projectId,userId];const viewKey=`tf-budget-view:${userId??'guest'}:${projectId}`;
  const [view,setView]=useState<ViewSettings>(()=>{try{const stored={...defaults,...JSON.parse(localStorage.getItem(viewKey)||'{}')};const columns:BudgetColumn[]=stored.columns.filter((column:BudgetColumn)=>column.key!=='tags');return {...stored,columns:columns.some(column=>!column.hidden)?columns:DEFAULT_COLUMNS};}catch{return defaults;}});
  const [createdTenders,setCreatedTenders]=useState<Array<{id:string;title:string;projectId:string}>>([]);
  const categories=useMemo(()=>[...incomingCategories,...createdTenders.filter(t=>t.projectId===projectId&&!incomingCategories.some(c=>c.id===t.id))],[incomingCategories,createdTenders,projectId]);
  const [revisionId,setRevisionId]=useState('');const [tab,setTab]=useState<'items'|'recap'|'versions'|'tenders'>('items');const [filters,setFilters]=useState<BudgetFilters>({});
  const [expandedVV,setExpandedVV]=useState(new Set<string>());
  const [selected,setSelected]=useState(new Set<string>());const [notice,setNotice]=useState('');const [error,setError]=useState('');const [saving,setSaving]=useState(false);
  const [templatesOpen,setTemplatesOpen]=useState(false);
  const [exportSelection,setExportSelection]=useState<string[]|null>(null);
  const [repairOpen,setRepairOpen]=useState(false);
  const [importOpen,setImportOpen]=useState(false);const [importSource,setImportSource]=useState<BudgetSource|undefined>();const [scopeOpen,setScopeOpen]=useState(false);const [scopeSearch,setScopeSearch]=useState('');
  const [jumpId,setJumpId]=useState('');const [jumpRequest,setJumpRequest]=useState(0);const [columnsOpen,setColumnsOpen]=useState(false);const [catalogOpen,setCatalogOpen]=useState(false);
  const [viewOptionsOpen,setViewOptionsOpen]=useState(false);
  const viewOptions=useRef<HTMLDivElement>(null);const viewOptionsButton=useRef<HTMLButtonElement>(null);const viewOptionsId=React.useId();
  const [planOpen,setPlanOpen]=useState(false);
  const [categoryId,setCategoryId]=useState('');
  const [pendingAssignment,setPendingAssignment]=useState<{revisionId:string;allocations:BudgetAllocation[];itemIds:Set<string>}|null>(null);
  const itemEditAttempt=useRef<{key:string;request:BudgetItemEditRequest}|null>(null);
  const assignmentAttempt=useRef<{key:string;request:BudgetAssignmentRequest}|null>(null);
  const undoAttempt=useRef<{key:string;request:BudgetUndoRequest}|null>(null);
  const actionLock=useRef(false);const saveLock=useRef(false);
  const [undo,setUndo]=useState<{revisionId:string;document:BudgetDocument;allocations:BudgetAllocation[];version:number;operationId?:string}|null>(null);
  const index=useQuery({queryKey:[...key,'index'],queryFn:()=>budgetApi.index(projectId),refetchOnMount:'always'});
  const sources=useQuery({queryKey:[...key,'sources'],queryFn:()=>budgetApi.sources(projectId),enabled:!!index.data});
  const activeVersions=index.data?.revisions.filter(r=>!r.deleted_at&&!r.purge_job_id)??[];
  const mainId=activeVersions.find(r=>r.id===index.data?.mainRevisionId)?.id||(index.data?.mainRevisionId===undefined?activeVersions[0]?.id:undefined)||[...activeVersions].sort((a,b)=>(a.created_at||'').localeCompare(b.created_at||'')||a.id.localeCompare(b.id))[0]?.id||'';
  const activeId=revisionId||mainId;
  const previousActiveId=useRef(activeId);
  useEffect(()=>{
    setExpandedVV(new Set());
    if(previousActiveId.current&&previousActiveId.current!==activeId){
      setExportSelection(null);setSelected(new Set());setUndo(null);setFilters({});setJumpId('');setView(old=>({...old,scope:''}));
      setCategoryId('');setScopeOpen(false);setScopeSearch('');setPlanOpen(false);
    }
    previousActiveId.current=activeId;
  },[activeId]);
  const revision=useQuery({queryKey:[...key,'revision',activeId],queryFn:()=>budgetApi.revision(projectId,activeId),enabled:!!activeId&&!!index.data});
  const history=useQuery({queryKey:[...key,'history',activeId,revision.data?.version],queryFn:()=>budgetApi.history(projectId,activeId),enabled:!!activeId&&tab==='versions'&&!!index.data?.permissions.prices});
  const openVersion=(id:string)=>{setRevisionId(id);setSelected(new Set());setUndo(null);setFilters({});setJumpId('');updateView({scope:''});};
  const locked=index.data?.locked??false;
  const permissions=index.data?.permissions;const current=revision.data;const editable=!!permissions?.edit&&!!permissions.prices&&!readOnly&&!locked&&current?.status==='draft'&&!current.deleted_at&&!saving;
  const allocationDisabledReason = saving ? 'Probíhá ukládání. Vyčkejte na jeho dokončení.'
    : current?.deleted_at ? 'Tato verze je v koši. Před úpravami ji obnovte.'
    : readOnly || !permissions?.edit || !permissions.prices || !permissions.allocate ? 'Pro přiřazení VŘ nemáte oprávnění k úpravám tohoto rozpočtu.'
    : locked ? 'Rozpočet je uzamčen. Před přiřazením VŘ jej odemkněte.'
    : current?.status === 'confirmed' ? 'Tato verze je potvrzená. Pro přiřazení VŘ otevřete pracovní verzi v nabídce Verze nebo zvolte Akce → Vytvořit pracovní kopii.'
    : undefined;
  useEffect(()=>{try{localStorage.setItem(viewKey,JSON.stringify(view));}catch{/* Personal view is optional. */}},[view,viewKey]);
  useEffect(()=>{
    if(!viewOptionsOpen)return;
    const dismiss=(event:PointerEvent)=>{if(event.target instanceof Node&&!viewOptions.current?.contains(event.target))setViewOptionsOpen(false);};
    document.addEventListener('pointerdown',dismiss);
    return ()=>document.removeEventListener('pointerdown',dismiss);
  },[viewOptionsOpen]);
  const updateView=(update:Partial<ViewSettings>)=>setView(old=>({...old,...update}));
  const nodes=useMemo(()=>{
    if(!current)return [];
    const categoryNames=new Map(categories.map(c=>[c.id,c.title]));
    const assigned=new Map<string,string[]>();
    for(const a of (pendingAssignment?.revisionId===current.id?pendingAssignment.allocations:current.allocations)){const values=assigned.get(a.itemId)||[];values.push(categoryNames.get(a.categoryId)||'Nedostupné VŘ');assigned.set(a.itemId,values);}
    return current.document.nodes.map(n=>({...n,tenders:[...new Set(assigned.get(n.id)||[])],tags:n.tags}));
  },[current,categories,pendingAssignment]);
  const save=async(document:BudgetDocument,allocations=current?.allocations??[],confirm=false)=>{
    if(locked)throw new Error('Rozpočet je uzamčen.');if(!current)throw new Error('Vyberte verzi rozpočtu.');if(saveLock.current)throw new Error('Počkejte na dokončení ukládání.');validateRevisionAllocations(document,allocations);if(confirm&&(document.issues.some(i=>i.severity==='error')||document.nodes.some(n=>isPriced(n)&&(n.quantity===null||n.unitPrice===null||n.total===null))))throw new Error('Rozpočet nelze potvrdit. Doplňte chybějící množství a ceny v detailu položek; chyby mapování a struktury opravte v editoru importu.');saveLock.current=true;setSaving(true);setError('');
    try{const saved=await budgetApi.save({projectId,sourceId:current.source_id,revision:current,title:current.title,document,allocations,confirm});setUndo({revisionId:current.id,document:current.document,allocations:current.allocations,version:saved.version});cache.setQueryData([...key,'revision',saved.id],saved);await cache.invalidateQueries({queryKey:[...key,'index']});setNotice('Uloženo na serveru.');return saved;}finally{saveLock.current=false;setSaving(false);}
  };
  const saveItem=async(edited:BudgetNode,editedFields?:readonly string[])=>{
    if(!current||!editable)throw new Error('Úprava položky nyní není povolena.');
    if(saveLock.current)throw new Error('Počkejte na dokončení ukládání.');
    if(current.allocations.some(a=>a.itemId===edited.id)&&current.document.nodes.find(n=>n.id===edited.id)?.unit!==edited.unit)throw new Error('Měrnou jednotku přiřazené položky nelze změnit. Nejdříve zrušte její přiřazení do VŘ.');
    const document=applyBudgetItemEdit(current.document,edited,editedFields);
    syncWholeItemQuantity(current.document,document,current.allocations,!!permissions?.allocate);
    const original=current.document.nodes.find(n=>n.id===edited.id)!;
    const fields=(['kind','code','description','unit','quantity','unitPrice','total'] as const).filter(field=>editedFields?.includes(field)??edited[field]!==original[field]);
    if(!fields.length)return;
    const patch=Object.fromEntries(fields.map(field=>[field,edited[field]])) as BudgetItemEditRequest['patch'];
    const retainedIssues=new Set(document.issues);
    const resolvedIssueIndexes=current.document.issues.flatMap((issue,index)=>retainedIssues.has(issue)?[]:[index]);
    const attemptKey=JSON.stringify([projectId,current.id,current.version,edited.id,patch,resolvedIssueIndexes]);
    if(itemEditAttempt.current?.key!==attemptKey)itemEditAttempt.current={key:attemptKey,request:{operationId:crypto.randomUUID(),revisionId:current.id,sourceId:current.source_id,version:current.version,itemId:edited.id,patch,resolvedIssueIndexes}};
    saveLock.current=true;setSaving(true);setError('');
    try{
      const result=await budgetApi.editItem(projectId,itemEditAttempt.current.request);
      if(result.id!==current.id||result.version!==current.version+1||result.node.id!==edited.id)throw new Error('Server vrátil nečekanou verzi. Obnovte rozpočet.');
      const removed=new Set(result.resolvedIssueIndexes);
      const saved={...current,version:result.version,document:{...current.document,nodes:current.document.nodes.map(n=>n.id===result.node.id?result.node:n),issues:current.document.issues.filter((_,index)=>!removed.has(index))},allocations:[...current.allocations.filter(a=>a.itemId!==edited.id),...result.allocations]};
      setUndo({revisionId:current.id,document:current.document,allocations:current.allocations,version:saved.version,operationId:itemEditAttempt.current.request.operationId});
      cache.setQueryData([...key,'revision',saved.id],saved);itemEditAttempt.current=null;
      void cache.invalidateQueries({queryKey:[...key,'index']});setNotice('Uloženo na serveru.');
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      if(/Failed to fetch|NetworkError|Load failed/i.test(message))throw new Error('Spojení se serverem selhalo. Hodnota zůstala rozepsaná; potvrďte ji znovu. Opakování nevytvoří duplicitní zápis.');
      throw error;
    }finally{saveLock.current=false;setSaving(false);}
  };
  const createTender=async(name:string)=>{
    if(!permissions?.editTenders||!permissions.allocate||readOnly||locked)throw new Error('Vytvoření VŘ není povoleno.');
    const {tender,warning}=await createBudgetTender(projectId,name);
    setCreatedTenders(old=>[...old.filter(t=>t.id!==tender.id),{...tender,projectId}]);
    if(warning)setNotice(warning);
    void cache.invalidateQueries({queryKey:['budget-project-tenders',projectId]});
    void cache.invalidateQueries({queryKey:PROJECT_DETAILS_KEYS.detail(projectId)});
    return {...tender,warning};
  };
  const assignTender=async(categoryId:string|null)=>{
    if(!current||!editable||!permissions?.allocate||!selected.size)throw new Error('Přiřazení není povoleno.');
    if(saveLock.current)throw new Error('Počkejte na dokončení ukládání.');
    const ids=[...selected].sort();const attemptKey=JSON.stringify([projectId,current.id,current.version,ids,categoryId]);
    saveLock.current=true;setSaving(true);setError('');
    try{
      if(assignmentAttempt.current?.key!==attemptKey)assignmentAttempt.current={key:attemptKey,request:{operationId:crypto.randomUUID(),sourceId:current.source_id,revisionId:current.id,version:current.version,itemIds:ids,categoryId}};
      const result=await budgetApi.setAssignments(projectId,assignmentAttempt.current.request);
      if(result.id!==current.id||result.version!==current.version+1||JSON.stringify([...result.itemIds].sort())!==JSON.stringify(ids))throw new Error('Server nepotvrdil uložené přiřazení. Obnovte rozpočet.');
      const changed=new Set(result.itemIds);const saved={...current,version:result.version,allocations:[...current.allocations.filter(a=>!changed.has(a.itemId)),...result.allocations]};
      setUndo({revisionId:current.id,document:current.document,allocations:current.allocations,version:saved.version,operationId:assignmentAttempt.current.request.operationId});assignmentAttempt.current=null;
      cache.setQueryData([...key,'revision',saved.id],saved);void cache.invalidateQueries({queryKey:[...key,'index']});setNotice('Přiřazení uloženo na serveru.');
    }finally{saveLock.current=false;setSaving(false);}
  };
  const previewTenderAssignment=async(categoryId:string|null)=>{
    if(!current||!editable||!permissions?.allocate||!selected.size)return;
    setError('');
    setPendingAssignment({revisionId:current.id,itemIds:new Set(selected),allocations:categoryId===null?current.allocations.filter(a=>!selected.has(a.itemId)):assignWholeItems(current.document.nodes,current.allocations,selected,categoryId)});
    try{await assignTender(categoryId);}catch(error){
      const message=error instanceof Error?error.message:'Přiřazení nelze uložit.';
      setError(/statement timeout/i.test(message)?'Server překročil časový limit. Přiřazení se neuložilo; původní hodnota byla obnovena.'
        :/failed to fetch|networkerror|network request failed/i.test(message)?'Spojení se serverem selhalo. Výsledek zápisu není potvrzený; zopakujte stejný výběr VŘ.':message);
    }finally{setPendingAssignment(null);}
  };
  const act=async(action:()=>Promise<unknown>)=>{if(actionLock.current)return;actionLock.current=true;setSaving(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Operace selhala.');}finally{actionLock.current=false;setSaving(false);}};
  const jump=(n:BudgetNode)=>{if(view.scope&&n.sheetId!==view.scope){updateView({scope:''});setNotice('Rozsah změněn na celý rozpočet kvůli vybranému oddílu. Sloupcové filtry zůstaly zachované.');}setTab('items');setJumpId(n.id);setJumpRequest(request=>request+1);};
  const effectiveFilters:BudgetFilters=searchQuery?{...filters,$all:{search:searchQuery}}:filters;
  const activeFilters=Object.entries(effectiveFilters).filter(([,f])=>f.search||f.selected!==undefined||f.min||f.max);
  if(index.isPending)return <div className="p-6" role="status">Načítání oprávnění rozpočtu…</div>;
  if(index.error&&!index.data)return <div className="p-6" role="alert">Rozpočet nelze načíst: {index.error.message}<button onClick={()=>void index.refetch()}>Zkusit znovu</button></div>;
  const sheets=current?.document.sheets.filter(s=>s.role==='items'&&s.selected)||[];
  return <section className={`tf-budget${view.grid?' tf-budget-show-grid':''}`} aria-label="Rozpočet stavby">
    <div className="tf-budget-toolbar"><h2>Rozpočet stavby</h2>{locked&&<strong role="status"><LockKeyhole size={16} aria-hidden="true"/> Rozpočet je uzamčen</strong>}{saving&&<span role="status">Ukládání…</span>}</div>
    <div className="tf-budget-toolbar tf-budget-commandbar" role="group" aria-label="Ovládání rozpočtu">
      <nav className="tf-budget-toolbar" aria-label="Sekce rozpočtu">{(['recap','items','versions',...(canUseTenders?['tenders' as const]:[])] as const).map(t=><button key={t} className="tf-budget-command-button" aria-current={tab===t?'page':undefined} onClick={()=>setTab(t)}>{t==='items'?<List aria-hidden="true"/>:t==='recap'?<ChartNoAxesColumnIncreasing aria-hidden="true"/>:t==='tenders'?<ListChecks aria-hidden="true"/>:<Import aria-hidden="true"/>}{t==='items'?'Položky':t==='recap'?'Rekapitulace':t==='tenders'?'Číselník VŘ':'Importy a verze'}</button>)}</nav>
      {!!activeVersions.length&&<BudgetButtonMenu label="Verze rozpočtu" caption="Verze" icon={<Layers aria-hidden="true"/>}>
        <strong>Verze rozpočtu</strong>
        <div className="tf-budget-version-options">
          {activeVersions.map(r=><button key={r.id} type="button" aria-pressed={r.id===activeId} disabled={saving} onClick={()=>openVersion(r.id)}>{r.title} · {r.status==='confirmed'?'Potvrzená':'Pracovní'}{r.id===mainId?' · Hlavní':''}</button>)}
        </div>
      {activeId===mainId?<span className="tf-budget-main-label">Hlavní verze</span>:current&&!current.deleted_at&&permissions?.edit&&permissions.prices&&!readOnly&&!locked&&<button disabled={saving||revision.isPending||index.data?.mainRevisionId===undefined} title={index.data?.mainRevisionId===undefined?'Nastavení hlavní verze zatím není dostupné':undefined} onClick={()=>void act(async()=>{await budgetApi.setPrimary(projectId,activeId,index.data?.mainRevisionId??null);await cache.invalidateQueries({queryKey:key});setNotice('Hlavní verze rozpočtu byla změněna.');})}>Nastavit jako hlavní</button>}
      </BudgetButtonMenu>}
      {current&&(tab==='items'||tab==='recap')&&<>
        {tab==='items'&&<><button className="tf-budget-command-button" onClick={()=>updateView({panel:!view.panel})}><Network aria-hidden="true"/>{view.panel?'Skrýt':'Zobrazit'} strom</button>{view.scope&&<button className="tf-budget-command-button" onClick={()=>updateView({scope:''})}>Rozsah: {sheets.find(s=>s.id===view.scope)?.title||view.scope} ×</button>}</>}
        <BudgetButtonMenu label="Akce rozpočtu" caption="Akce" icon={<MoreHorizontal aria-hidden="true"/>} closeOnAction>
        {editable&&undo&&undo.revisionId===activeId&&<button onClick={()=>void act(async()=>{if(current.id!==undo.revisionId||current.version!==undo.version)throw new Error('Undo má konflikt s novější verzí.');if(undo.operationId){
          const attemptKey=JSON.stringify([current.id,current.version,undo.operationId]);
          if(undoAttempt.current?.key!==attemptKey)undoAttempt.current={key:attemptKey,request:{operationId:crypto.randomUUID(),sourceId:current.source_id,revisionId:current.id,version:current.version,undoOperationId:undo.operationId}};
          const result=await budgetApi.undoPatch(projectId,undoAttempt.current.request);
          if(result.id!==current.id||result.version!==current.version+1)throw new Error('Server nepotvrdil vrácení změny. Obnovte rozpočet.');
          cache.setQueryData([...key,'revision',current.id],{...current,document:undo.document,allocations:undo.allocations,version:result.version});undoAttempt.current=null;
          void cache.invalidateQueries({queryKey:[...key,'index']});setNotice('Změna vrácena na serveru.');
        }else await save(undo.document,undo.allocations);setUndo(null);})}>Zpět</button>}
        {editable&&<button disabled={!sources.data?.some(s=>s.id===current.source_id)} onClick={()=>setRepairOpen(true)}>Opravit import</button>}
        {editable&&permissions?.confirm&&<button onClick={()=>void act(async()=>{await save(current.document,current.allocations,true);})}>Potvrdit rozpočet</button>}
        {!current.deleted_at&&current.status==='confirmed'&&permissions?.edit&&permissions.prices&&!readOnly&&!locked&&<button disabled={saving||(!permissions.allocate&&current.allocations.length>0)} title={!permissions.allocate&&current.allocations.length>0?'Kopírování přiřazení vyžaduje oprávnění k alokacím.':undefined} onClick={()=>void act(async()=>{const copy=await budgetApi.save({projectId,sourceId:current.source_id,title:`${current.title} · pracovní kopie`,document:{...current.document,origin:'copy',importKey:crypto.randomUUID()},allocations:current.allocations});openVersion(copy.id);await cache.invalidateQueries({queryKey:key});})}>Vytvořit pracovní kopii</button>}
          <button disabled title="Připravujeme">Převzít do plánu VŘ</button>
        </BudgetButtonMenu>
      </>}
        <button className="tf-budget-catalog-trigger tf-budget-command-button" onClick={()=>setCatalogOpen(true)}><Library aria-hidden="true"/>Firemní číselníky</button>
        <button className="tf-budget-command-button" disabled={saving||readOnly||!permissions?.edit||!permissions.prices} aria-pressed={locked} title={locked?'Odemknout rozpočet pro změny':'Uzamknout rozpočet proti změnám'} onClick={()=>void act(async()=>{await budgetApi.setLock(projectId,!locked,index.data?.lockVersion??0);await cache.invalidateQueries({queryKey:key});setNotice(locked?'Rozpočet byl odemčen.':'Rozpočet byl uzamčen proti změnám.');})}>{locked?<LockKeyhole aria-hidden="true"/>:<UnlockKeyhole aria-hidden="true"/>}{locked?'Odemknout rozpočet':'Uzamknout rozpočet'}</button>
        <div ref={viewOptions} className="tf-budget-view-settings" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setViewOptionsOpen(false);}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setViewOptionsOpen(false);viewOptionsButton.current?.focus();}}}>
          <button ref={viewOptionsButton} type="button" className="tf-budget-view-settings-trigger tf-budget-command-button" aria-label="Nastavení zobrazení" title="Nastavení zobrazení" aria-expanded={viewOptionsOpen} aria-controls={viewOptionsId} onClick={()=>setViewOptionsOpen(open=>!open)}><Settings aria-hidden="true"/></button>
          {viewOptionsOpen&&<div id={viewOptionsId} role="group" aria-label="Nastavení zobrazení rozpočtu" className="tf-budget-view-settings-panel">
            <strong>Nastavení zobrazení</strong>
            {current&&tab==='items'&&<button onClick={()=>{setViewOptionsOpen(false);setScopeOpen(true);}}>Rozsah: {sheets.find(s=>s.id===view.scope)?.title||'Celý rozpočet'} ▾</button>}
            <label className="tf-budget-view-settings-wrap">Zalamovat text popisu<input type="checkbox" checked={view.wrap} onChange={e=>updateView({wrap:e.target.checked})}/></label>
            <label className="tf-budget-view-settings-wrap">Zobrazit poznámky<input type="checkbox" checked={view.showNotes} onChange={e=>updateView({showNotes:e.target.checked})}/></label>
            <label className="tf-budget-view-settings-wrap">Zobrazit mřížku<input type="checkbox" checked={view.grid} onChange={e=>updateView({grid:e.target.checked})}/></label>
            <fieldset className="tf-budget-density"><legend>Hustota zobrazení</legend><div><button type="button" aria-pressed={view.density===44} onClick={()=>updateView({density:44})}>Kompaktní</button><button type="button" aria-pressed={view.density===60} onClick={()=>updateView({density:60})}>Pohodlná</button></div><p className="tf-budget-density-help">Mění výšku řádků tabulky.</p></fieldset>
            <button type="button" onClick={()=>{setViewOptionsOpen(false);setColumnsOpen(true);}}>Zobrazení sloupců <span aria-hidden="true">→</span></button>
          </div>}
        </div>
    </div>
    {(error||index.error||revision.error||sources.error)&&<p role="alert" className="tf-budget-error">{error||index.error?.message||revision.error?.message||sources.error?.message}<button onClick={()=>{setError('');void cache.invalidateQueries({queryKey:key});}}>Obnovit</button></p>}
    {notice&&<p role="status" className="tf-budget-notice">{notice}<button aria-label="Zavřít oznámení" onClick={()=>setNotice('')}>×</button></p>}
    {tab==='tenders'?<BudgetTenderCatalog key={`${projectId}:${userId}`} projectId={projectId} userId={userId} readOnly={readOnly||locked||!permissions?.editTenders} canImportTemplates={!!permissions?.edit&&!!permissions.prices&&!!permissions.allocate} onTemplates={()=>setTemplatesOpen(true)}/>:tab==='versions'?<div className="overflow-auto p-4"><div className="tf-budget-toolbar tf-budget-import-actions" role="group" aria-label="Import a export rozpočtu"><strong>{current?.title||'Bez rozpočtu'} · CZK bez DPH</strong><span>{current?`Uložení ${current.version} · ${current.status==='confirmed'?'Potvrzená':'Pracovní'}`:''}</span><button disabled={!nodes.length||saving} onClick={()=>setExportSelection([])}>Exportovat</button>{permissions?.edit&&permissions.prices&&!readOnly&&<button disabled={locked} onClick={()=>{setImportSource(undefined);setImportOpen(true);}}>Importovat</button>}</div><BudgetVersions revisions={index.data?.revisions??[]} sources={sources.data??[]} permissions={permissions!} purgeJobs={index.data?.purgeJobs} onPurge={async(jobId,selection)=>{try{await budgetApi.purge(projectId,jobId,selection);setRevisionId('');setSelected(new Set());setUndo(null);setNotice('Trvalé mazání dokončeno.');}finally{await cache.invalidateQueries({queryKey:key});}}} readOnly={readOnly||locked} categoryNames={new Map(categories.map(c=>[c.id,c.title]))}
      onOpen={id=>{openVersion(id);setTab(index.data?.revisions.find(r=>r.id===id)?.deleted_at?'versions':'items');}}
      onDownload={s=>void act(async()=>{const blob=await budgetApi.download(s);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=s.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);})}
      onConvert={s=>{setImportSource(s);setImportOpen(true);}}
      onChange={async(id,kind,restore,version)=>{await budgetApi.trash(projectId,id,kind,restore,version);setRevisionId('');setSelected(new Set());setUndo(null);await cache.invalidateQueries({queryKey:key});setNotice(restore?'Obnoveno z koše.':'Přesunuto do koše. Částky v plánu VŘ se nezměnily.');}}/>
      <h3>Historie otevřené verze</h3>{history.data?.map(h=><p key={h.id}>{new Date(h.created_at).toLocaleString('cs-CZ')} · {({set_primary:'Nastavení hlavní verze',trash:'Přesunuto do koše',restore:'Obnoveno z koše',create:'Vytvoření',save:'Úprava',confirm:'Potvrzení',apply_tender_plan:'Převzetí do plánu VŘ'} as Record<string,string>)[h.event]||h.event} · verze {h.previous_version??'-'} → {h.new_version}</p>)}
    </div>:revision.isPending&&activeId?<p role="status">Načítání rozpočtu…</p>:!current?<div className="p-10"><h3>Rozpočet zatím neobsahuje žádné položky</h3><p>Nahrajte XLSX jako přílohu nebo jej převeďte na pracovní rozpočet.</p></div>:<>
      {!!activeFilters.length&&<div className="tf-budget-toolbar">{activeFilters.map(([c,f])=><button key={c} onClick={()=>{if(c==='$all'){onSearchChange?.('');return;}const next={...filters};delete next[c];setFilters(next);}}>{c==='$all'?'Hledání':DEFAULT_COLUMNS.find(col=>col.key===c)?.label}: {f.search||''} {f.selected!==undefined?`${f.selected.length} hodnot`:''} {f.min?`od ${f.min}`:''} {f.max?`do ${f.max}`:''} ×</button>)}<button onClick={()=>{setFilters({});onSearchChange?.('');}}>Vymazat všechny filtry</button></div>}
      {<div className="tf-budget-toolbar tf-budget-selection" data-empty={!selected.size} aria-hidden={!selected.size}><strong>Vybráno {selected.size} položek</strong><button disabled={saving} onClick={()=>setExportSelection([...selected])}>Exportovat výběr</button><button onClick={()=>setSelected(new Set())}><ListX size={16} aria-hidden="true"/>Zrušit výběr</button>{selected.size>0&&<BudgetSelectionTenders inline itemIds={[...selected]} categories={categories} disabled={!editable||!permissions?.allocate} disabledReason={allocationDisabledReason} onCreateTender={permissions?.editTenders?createTender:undefined} onAssign={previewTenderAssignment} onRemove={current.allocations.some(a=>selected.has(a.itemId))?()=>previewTenderAssignment(null):undefined}/>}</div>}


      <div className={`tf-budget-workspace ${tab==='recap'?'tf-budget-workspace-recap':''}`}>{(view.panel||tab==='recap')&&<BudgetRecap prominentTotal={tab==='recap'} key={activeId} activeId={jumpId} nodes={nodes} onJump={jump} prices={!!permissions?.prices}/>}{tab==='items'&&<BudgetTable key={`table-${activeId}`} figures={current.document.figures} pendingTenderItems={pendingAssignment?.revisionId===current.id?pendingAssignment.itemIds:undefined} nodes={nodes} scope={view.scope} filters={effectiveFilters} onFilters={next=>{const {$all,...columns}=next;setFilters(columns);}} selected={selected} onSelected={setSelected} showVV={false} showNotes={view.showNotes} expandedVV={expandedVV} onExpandedVV={setExpandedVV} wrap={view.wrap} density={view.density} columns={view.columns} onColumns={columns=>updateView({columns})} canPrices={!!permissions?.prices} editable={editable} jumpId={jumpId} jumpRequest={jumpRequest} onNotice={setNotice} onEdit={saveItem}/>}</div>

    </>}
    {scopeOpen&&<Modal isOpen title="Rozsah rozpočtu" onClose={()=>setScopeOpen(false)}><div className="tf-budget-controls"><label className="tf-budget-field">Hledat soupis<input autoFocus aria-label="Hledat soupis" value={scopeSearch} onChange={e=>setScopeSearch(e.target.value)} placeholder="Kód nebo název soupisu…"/></label><button onClick={()=>{updateView({scope:''});setScopeOpen(false);}}>Celý rozpočet</button><p>Připnuté a nedávné soupisy jsou první. Výběr položek zůstává zachován.</p>{!sheets.some(s=>normalizeSearch(`${s.name} ${s.title}`).includes(normalizeSearch(scopeSearch)))&&<p role="status">Žádný soupis neodpovídá hledání.</p>}{sheets.filter(s=>normalizeSearch(`${s.name} ${s.title}`).includes(normalizeSearch(scopeSearch))).sort((a,b)=>(view.pinned.includes(b.id)?100:0)+(view.recent.includes(b.id)?10:0)-(view.pinned.includes(a.id)?100:0)-(view.recent.includes(a.id)?10:0)).map(s=><div className="flex gap-2 py-1" key={s.id}><button aria-label={`Připnout ${s.title}`} onClick={()=>updateView({pinned:view.pinned.includes(s.id)?view.pinned.filter(id=>id!==s.id):[...view.pinned,s.id]})}>{view.pinned.includes(s.id)?'★':'☆'}</button><button onClick={()=>{updateView({scope:s.id,recent:[s.id,...view.recent.filter(id=>id!==s.id)].slice(0,8)});setScopeOpen(false);}}>{s.title}</button></div>)}</div></Modal>}
    {columnsOpen&&<BudgetColumnSettings columns={view.columns} onChange={columns=>updateView({columns})} onClose={()=>{setColumnsOpen(false);viewOptionsButton.current?.focus();}}/>}
    {catalogOpen&&<BudgetCatalogDialog organizationId={organizationId} userId={userId} readOnly={readOnly} onClose={()=>setCatalogOpen(false)}/>}
    {planOpen&&current&&<Modal isOpen title="Převzít částku do plánu VŘ" persistent={saving} onClose={()=>setPlanOpen(false)}><div className="tf-budget-controls flex flex-col gap-3"><p>Tato samostatná akce změní pouze plánovaný rozpočet vybraného VŘ. Nabídky a smlouvy zůstávají beze změny.</p><ThemedNativeSelect aria-label="VŘ pro převzetí plánu" value={categoryId} onChange={e=>setCategoryId(e.target.value)}><option value="">Vyberte VŘ</option>{categories.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</ThemedNativeSelect>{categoryId&&<><p>Původní plán: {formatBudgetNumber(String(incomingCategories.find(c=>c.id===categoryId)?.planBudget??0),true)} Kč</p><p>Nový plán: {formatBudgetNumber(sumMoney(current.allocations.filter(a=>a.categoryId===categoryId).map(a=>{const n=current.document.nodes.find(n=>n.id===a.itemId);return n?.unitPrice==null?null:allocatedMoney(n,a.quantity);})),true)} Kč · zdroj {current.title}</p><button disabled={saving} onClick={()=>void act(async()=>{const amount=await budgetApi.applyPlan(projectId,current.id,categoryId,incomingCategories.find(c=>c.id===categoryId)?.planBudget??0);setPlanOpen(false);setNotice(`Plán VŘ aktualizován na ${formatBudgetNumber(amount,true)} Kč.`);await cache.invalidateQueries();})}>Potvrdit změnu plánu VŘ</button></>}{error&&<p role="alert">{error}</p>}</div></Modal>}
    {repairOpen&&current&&!locked&&<BudgetImportDialog onCreateTender={permissions?.editTenders?createTender:undefined} categories={categories} canAllocate={permissions?.allocate??false} key={current.id} editRevision={current} projectId={projectId} source={sources.data?.find(s=>s.id===current.source_id)} onClose={()=>setRepairOpen(false)} onComplete={r=>{setRepairOpen(false);if(r){cache.setQueryData([...key,'revision',r.id],r);setUndo({revisionId:current.id,document:current.document,allocations:current.allocations,version:r.version});}void cache.invalidateQueries({queryKey:key});}}/>}
    {exportSelection&&current&&!saving&&<BudgetExportDialog nodes={nodes} allocations={current.allocations} categories={categories} canViewPrices={permissions?.prices??false} selectedIds={exportSelection} onClose={()=>setExportSelection(null)}/>}
    {templatesOpen&&!locked&&!readOnly&&permissions?.editTenders&&permissions.edit&&permissions.prices&&permissions.allocate&&<BudgetTenderTemplates projectId={projectId} onClose={()=>setTemplatesOpen(false)}/>}
    {importOpen&&!locked&&<BudgetImportDialog onCreateTender={permissions?.editTenders?createTender:undefined} categories={categories} canImportTenders={canUseTenders} canAllocate={permissions?.allocate??false} hasVersions={!!index.data?.revisions.length} projectId={projectId} source={importSource} previous={current} onClose={()=>{setImportOpen(false);void cache.invalidateQueries({queryKey:key});}} onComplete={(r?:BudgetRevision,importNotice?:string)=>{setNotice(importNotice??'Import dokončen.');setImportOpen(false);if(r){setRevisionId(r.id);updateView({scope:''});setSelected(new Set());setUndo(null);cache.setQueryData([...key,'revision',r.id],r);}void cache.invalidateQueries({queryKey:key});}}/>}
  </section>;
}

function BudgetColumnSettings({columns,onChange,onClose}:{columns:BudgetColumn[];onChange:(columns:BudgetColumn[])=>void;onClose:()=>void}) {
  const pinHelpId=React.useId();
  const ordered=[...columns].sort((a,b)=>Number(Boolean(b.pinned))-Number(Boolean(a.pinned)));
  const visibleCount=columns.filter(column=>!column.hidden).length;
  const canMove=(index:number,direction:number)=>{
    const target=ordered[index+direction];
    return !!target&&Boolean(target.pinned)===Boolean(ordered[index].pinned);
  };
  const move=(index:number,direction:number)=>{
    if(!canMove(index,direction))return;
    const next=[...ordered];[next[index],next[index+direction]]=[next[index+direction],next[index]];onChange(next);
  };
  return <Modal isOpen size="xl" title="Zobrazení sloupců" description="Změny se ukládají průběžně." onClose={onClose}
    footer={<div className="tf-budget-controls tf-budget-columns-footer"><button type="button" onClick={()=>onChange(DEFAULT_COLUMNS)}>Obnovit výchozí</button><button type="button" className="tf-budget-columns-done" onClick={onClose}>Hotovo</button></div>}>
    <div className="tf-budget-controls tf-budget-columns">
      <div className="tf-budget-columns-explanation" id={pinHelpId}><strong>Co znamená „Ponechat vlevo“?</strong><p>Sloupec zůstane na místě při posouvání tabulky do stran.</p><p>Šířku tím nezamykáte. Tu upravíte tažením okraje záhlaví.</p></div>
      <table aria-label="Sloupce rozpočtu">
        <thead><tr><th scope="col">Sloupec</th><th scope="col">Zobrazit</th><th scope="col">Ponechat vlevo</th><th scope="col">Pořadí</th></tr></thead>
        <tbody>{ordered.map((column,index)=><tr key={column.key} className={index>0&&ordered[index-1].pinned&&!column.pinned?'tf-budget-columns-divider':undefined}>
          <th scope="row">{column.label}</th>
          <td><input type="checkbox" aria-label={`Zobrazit ${column.label}`} checked={!column.hidden} disabled={!column.hidden&&visibleCount===1} onChange={event=>onChange(columns.map(c=>c.key===column.key?{...c,hidden:!event.target.checked}:c))}/></td>
          <td><input type="checkbox" aria-label={`Ponechat vlevo: ${column.label}`} aria-describedby={pinHelpId} checked={!!column.pinned} onChange={event=>onChange(columns.map(c=>c.key===column.key?{...c,pinned:event.target.checked}:c))}/></td>
          <td><div className="tf-budget-columns-order">{([-1,1] as const).map(direction=><button key={direction} type="button" aria-label={`Posunout ${column.label} ${direction===-1?'nahoru':'dolů'}`} title={direction===-1?'Posunout nahoru (vlevo v tabulce)':'Posunout dolů (vpravo v tabulce)'} disabled={!canMove(index,direction)} onClick={()=>move(index,direction)}><span aria-hidden="true">{direction===-1?'↑':'↓'}</span></button>)}</div></td>
        </tr>)}</tbody>
      </table>
      <div className="tf-budget-columns-help"><strong role="status">Zobrazeno {visibleCount} z {columns.length} sloupců</strong><p>Pořadí měníte zvlášť mezi sloupci ponechanými vlevo a ostatními.</p></div>
    </div>
  </Modal>;
}


function BudgetButtonMenu({label,caption,icon,children,closeOnAction=false}:{label:string;caption:string;icon:React.ReactNode;children:React.ReactNode;closeOnAction?:boolean}) {
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);const panel=useRef<HTMLDivElement>(null);const trigger=useRef<HTMLButtonElement>(null);const id=React.useId();
  React.useLayoutEffect(()=>{
    if(!open)return;
    const position=()=>{
      if(!root.current||!panel.current)return;
      const origin=root.current.getBoundingClientRect();const menu=panel.current.getBoundingClientRect();
      const scale=(root.current.offsetWidth?origin.width/root.current.offsetWidth:1)||1;
      const left=Math.max(8,Math.min(origin.left,window.innerWidth-menu.width-8));
      panel.current.style.left=`${(left-origin.left)/scale}px`;
    };
    position();window.addEventListener('resize',position);
    return ()=>window.removeEventListener('resize',position);
  },[open]);
  useEffect(()=>{
    if(!open)return;
    const dismiss=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false);};
    document.addEventListener('pointerdown',dismiss);
    return ()=>document.removeEventListener('pointerdown',dismiss);
  },[open]);
  return <div ref={root} className="tf-budget-button-menu" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);trigger.current?.focus();}}}>
    <button ref={trigger} type="button" className="tf-budget-command-button" aria-label={label} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}>{icon}{caption}<ChevronDown className="tf-budget-menu-chevron" aria-hidden="true"/></button>
    {open&&<div ref={panel} id={id} role="group" aria-label={label} className="tf-budget-button-menu-panel" onClick={event=>{const button=event.target instanceof Element?event.target.closest('button'):null;if(closeOnAction&&button&&!button.disabled){setOpen(false);trigger.current?.focus();}}}>{children}</div>}
  </div>;
}
