import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChartNoAxesColumnIncreasing, ChevronDown, Import, Layers, Library, List, MoreHorizontal, Network, Settings } from 'lucide-react';
import { ThemedNativeSelect } from '@shared/ui/ThemedNativeSelect';
import { Modal } from '@shared/ui/Modal';
import type { DemandCategory } from '@/types';
import { budgetApi } from '../api/budgetApi';
import { exportBudget } from '../api/budgetExport';
import { BudgetTable, DEFAULT_COLUMNS } from './BudgetTable';
import type { BudgetColumn } from './BudgetTable';
import { BudgetVersions } from './BudgetVersions';
import { BudgetCatalogDialog } from './BudgetCatalogDialog';
import { BudgetRecap } from './BudgetRecap';
import { BudgetImportDialog } from './BudgetImportDialog';
import { decimal, formatBudgetNumber, multiplyMoney, normalizeSearch, sumMoney } from '../model/budgetModel';
import type { BudgetFilters } from '../model/budgetModel';
import { isPriced } from '../model/types';
import type { BudgetAllocation, BudgetDocument, BudgetNode, BudgetRevision, BudgetSource } from '../model/types';
import { applyBudgetItemEdit, createRemainingAllocations, validateRevisionAllocations } from '../model/revisions';
import './budget.css';
interface Props { projectId:string; organizationId?:string; userId?:string; categories:DemandCategory[]; readOnly?:boolean; searchQuery?:string; onSearchChange?:(value:string)=>void }
interface ViewSettings { scope:string; showVV:boolean; panel:boolean; wrap:boolean; grid:boolean; density:number; columns:BudgetColumn[]; recent:string[]; pinned:string[] }
const defaults:ViewSettings={scope:'',showVV:false,panel:true,wrap:false,grid:false,density:44,columns:DEFAULT_COLUMNS,recent:[],pinned:[]};
export function ConstructionBudget({projectId,organizationId,userId,categories,readOnly=false,searchQuery='',onSearchChange}:Props) {
  const cache=useQueryClient();const key=['construction-budget',projectId,userId];const viewKey=`tf-budget-view:${userId??'guest'}:${projectId}`;
  const [view,setView]=useState<ViewSettings>(()=>{try{return {...defaults,...JSON.parse(localStorage.getItem(viewKey)||'{}')};}catch{return defaults;}});
  const [revisionId,setRevisionId]=useState('');const [tab,setTab]=useState<'items'|'recap'|'versions'>('items');const [filters,setFilters]=useState<BudgetFilters>({});
  const [expandedVV,setExpandedVV]=useState(new Set<string>());
  const [selected,setSelected]=useState(new Set<string>());const [notice,setNotice]=useState('');const [error,setError]=useState('');const [saving,setSaving]=useState(false);
  const [importOpen,setImportOpen]=useState(false);const [importSource,setImportSource]=useState<BudgetSource|undefined>();const [scopeOpen,setScopeOpen]=useState(false);const [scopeSearch,setScopeSearch]=useState('');
  const [jumpId,setJumpId]=useState('');const [jumpRequest,setJumpRequest]=useState(0);const [columnsOpen,setColumnsOpen]=useState(false);const [catalogOpen,setCatalogOpen]=useState(false);
  const [viewOptionsOpen,setViewOptionsOpen]=useState(false);
  const viewOptions=useRef<HTMLDivElement>(null);const viewOptionsButton=useRef<HTMLButtonElement>(null);const viewOptionsId=React.useId();
  const [planOpen,setPlanOpen]=useState(false);
  const [allocationOpen,setAllocationOpen]=useState(false);const [categoryId,setCategoryId]=useState('');const [allocationQuantity,setAllocationQuantity]=useState('');const [tagId,setTagId]=useState('');
  const actionLock=useRef(false);const saveLock=useRef(false);
  const [undo,setUndo]=useState<{revisionId:string;document:BudgetDocument;allocations:BudgetAllocation[];version:number}|null>(null);
  const index=useQuery({queryKey:[...key,'index'],queryFn:()=>budgetApi.index(projectId),refetchOnMount:'always'});
  const sources=useQuery({queryKey:[...key,'sources'],queryFn:()=>budgetApi.sources(projectId),enabled:!!index.data});
  const activeVersions=index.data?.revisions.filter(r=>!r.deleted_at&&!r.purge_job_id)??[];
  const mainId=activeVersions.find(r=>r.id===index.data?.mainRevisionId)?.id||(index.data?.mainRevisionId===undefined?activeVersions[0]?.id:undefined)||[...activeVersions].sort((a,b)=>(a.created_at||'').localeCompare(b.created_at||'')||a.id.localeCompare(b.id))[0]?.id||'';
  const activeId=revisionId||mainId;
  const previousActiveId=useRef(activeId);
  useEffect(()=>{
    setExpandedVV(new Set());
    if(previousActiveId.current&&previousActiveId.current!==activeId){
      setSelected(new Set());setUndo(null);setFilters({});setJumpId('');setView(old=>({...old,scope:''}));
      setAllocationOpen(false);setCategoryId('');setAllocationQuantity('');setTagId('');setScopeOpen(false);setScopeSearch('');setPlanOpen(false);
    }
    previousActiveId.current=activeId;
  },[activeId]);
  const revision=useQuery({queryKey:[...key,'revision',activeId],queryFn:()=>budgetApi.revision(projectId,activeId),enabled:!!activeId&&!!index.data});
  const catalog=useQuery({queryKey:['budget-catalog',organizationId,userId],queryFn:()=>budgetApi.catalog(organizationId!),enabled:!!organizationId&&!!index.data});
  const history=useQuery({queryKey:[...key,'history',activeId,revision.data?.version],queryFn:()=>budgetApi.history(projectId,activeId),enabled:!!activeId&&tab==='versions'&&!!index.data?.permissions.prices});
  const openVersion=(id:string)=>{setRevisionId(id);setSelected(new Set());setUndo(null);setFilters({});setJumpId('');updateView({scope:''});};
  const permissions=index.data?.permissions;const current=revision.data;const editable=!!permissions?.edit&&!!permissions.prices&&!readOnly&&current?.status==='draft'&&!current.deleted_at&&!saving;
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
    const tagNames=new Map(catalog.data?.map(t=>[t.id,t.name])||[]);
    const assigned=new Map<string,string[]>();
    for(const a of current.allocations){const values=assigned.get(a.itemId)||[];values.push(categoryNames.get(a.categoryId)||'Nedostupné VŘ');assigned.set(a.itemId,values);}
    return current.document.nodes.map(n=>({...n,tenders:[...new Set(assigned.get(n.id)||[])],tags:n.tags.map(id=>tagNames.get(id)||id)}));
  },[current,categories,catalog.data]);
  const save=async(document:BudgetDocument,allocations=current?.allocations??[],confirm=false)=>{
    if(!current)throw new Error('Vyberte verzi rozpočtu.');if(saveLock.current)throw new Error('Počkejte na dokončení ukládání.');validateRevisionAllocations(document,allocations);if(confirm&&(document.issues.some(i=>i.severity==='error')||document.nodes.some(n=>isPriced(n)&&(n.quantity===null||n.unitPrice===null||n.total===null))))throw new Error('Rozpočet nelze potvrdit. Doplňte chybějící množství a ceny v detailu položek; chyby mapování opravte novým převodem přílohy.');saveLock.current=true;setSaving(true);setError('');
    try{const saved=await budgetApi.save({projectId,sourceId:current.source_id,revision:current,title:current.title,document,allocations,confirm});setUndo({revisionId:current.id,document:current.document,allocations:current.allocations,version:saved.version});cache.setQueryData([...key,'revision',saved.id],saved);await cache.invalidateQueries({queryKey:[...key,'index']});setNotice('Uloženo na serveru.');return saved;}finally{saveLock.current=false;setSaving(false);}
  };
  const act=async(action:()=>Promise<unknown>)=>{if(actionLock.current)return;actionLock.current=true;setSaving(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Operace selhala.');}finally{actionLock.current=false;setSaving(false);}};
  const jump=(n:BudgetNode)=>{if(view.scope&&n.sheetId!==view.scope){updateView({scope:''});setNotice('Rozsah změněn na celý rozpočet kvůli vybranému oddílu. Sloupcové filtry zůstaly zachované.');}setTab('items');setJumpId(n.id);setJumpRequest(request=>request+1);};
  const effectiveFilters:BudgetFilters=searchQuery?{...filters,$all:{search:searchQuery}}:filters;
  const activeFilters=Object.entries(effectiveFilters).filter(([,f])=>f.search||f.selected!==undefined||f.min||f.max);
  if(index.isPending)return <div className="p-6" role="status">Načítání oprávnění rozpočtu…</div>;
  if(index.error&&!index.data)return <div className="p-6" role="alert">Rozpočet nelze načíst: {index.error.message}<button onClick={()=>void index.refetch()}>Zkusit znovu</button></div>;
  const sheets=current?.document.sheets.filter(s=>s.role==='items'&&s.selected)||[];
  return <section className={`tf-budget${view.grid?' tf-budget-show-grid':''}`} aria-label="Rozpočet stavby">
    <div className="tf-budget-toolbar"><h2>Rozpočet stavby</h2><span>{current?.title||'Bez rozpočtu'} {current?.deleted_at?'· V koši':''} · CZK bez DPH</span><span role="status">{saving?'Ukládání…':current?`Uložení ${current.version} · ${current.status==='confirmed'?'Potvrzená':'Pracovní'}`:''}</span>
      <button disabled={!nodes.length} onClick={()=>exportBudget(nodes.filter(isPriced),'rozpocet.xlsx')}>Exportovat</button>
      {permissions?.edit&&permissions.prices&&!readOnly&&<button onClick={()=>{setImportSource(undefined);setImportOpen(true);}}>Importovat</button>}
    </div>
    <div className="tf-budget-toolbar tf-budget-commandbar" role="group" aria-label="Ovládání rozpočtu">
      <nav className="tf-budget-toolbar" aria-label="Sekce rozpočtu">{(['recap','items','versions'] as const).map(t=><button key={t} className="tf-budget-command-button" aria-current={tab===t?'page':undefined} onClick={()=>setTab(t)}>{t==='items'?<List aria-hidden="true"/>:t==='recap'?<ChartNoAxesColumnIncreasing aria-hidden="true"/>:<Import aria-hidden="true"/>}{t==='items'?'Položky':t==='recap'?'Rekapitulace':'Importy a verze'}</button>)}</nav>
      {!!activeVersions.length&&<BudgetButtonMenu label="Verze rozpočtu" caption="Verze" icon={<Layers aria-hidden="true"/>}>
        <strong>Verze rozpočtu</strong>
        <div className="tf-budget-version-options">
          {activeVersions.map(r=><button key={r.id} type="button" aria-pressed={r.id===activeId} disabled={saving} onClick={()=>openVersion(r.id)}>{r.title} · {r.status==='confirmed'?'Potvrzená':'Pracovní'}{r.id===mainId?' · Hlavní':''}</button>)}
        </div>
      {activeId===mainId?<span className="tf-budget-main-label">Hlavní verze</span>:current&&!current.deleted_at&&permissions?.edit&&permissions.prices&&!readOnly&&<button disabled={saving||revision.isPending||index.data?.mainRevisionId===undefined} title={index.data?.mainRevisionId===undefined?'Nastavení hlavní verze zatím není dostupné':undefined} onClick={()=>void act(async()=>{await budgetApi.setPrimary(projectId,activeId,index.data?.mainRevisionId??null);await cache.invalidateQueries({queryKey:key});setNotice('Hlavní verze rozpočtu byla změněna.');})}>Nastavit jako hlavní</button>}
      </BudgetButtonMenu>}
      {current&&tab!=='versions'&&<>
        {tab==='items'&&<><button className="tf-budget-command-button" onClick={()=>updateView({panel:!view.panel})}><Network aria-hidden="true"/>{view.panel?'Skrýt':'Zobrazit'} strom</button>{view.scope&&<button className="tf-budget-command-button" onClick={()=>updateView({scope:''})}>Rozsah: {sheets.find(s=>s.id===view.scope)?.title||view.scope} ×</button>}</>}
        <BudgetButtonMenu label="Akce rozpočtu" caption="Akce" icon={<MoreHorizontal aria-hidden="true"/>} closeOnAction>
        {editable&&undo&&undo.revisionId===activeId&&<button onClick={()=>void act(async()=>{if(current.id!==undo.revisionId||current.version!==undo.version)throw new Error('Undo má konflikt s novější verzí.');await save(undo.document,undo.allocations);setUndo(null);})}>Zpět</button>}
        {editable&&permissions?.confirm&&<button onClick={()=>void act(async()=>{await save(current.document,current.allocations,true);})}>Potvrdit rozpočet</button>}
        {!current.deleted_at&&current.status==='confirmed'&&permissions?.edit&&permissions.prices&&!readOnly&&<button disabled={saving||(!permissions.allocate&&current.allocations.length>0)} title={!permissions.allocate&&current.allocations.length>0?'Kopírování přiřazení vyžaduje oprávnění k alokacím.':undefined} onClick={()=>void act(async()=>{const copy=await budgetApi.save({projectId,sourceId:current.source_id,title:`${current.title} · pracovní kopie`,document:{...current.document,origin:'copy',importKey:crypto.randomUUID()},allocations:current.allocations});openVersion(copy.id);await cache.invalidateQueries({queryKey:key});})}>Vytvořit pracovní kopii</button>}
          <button disabled title="Připravujeme">Převzít do plánu VŘ</button>
        </BudgetButtonMenu>
      </>}
        <button className="tf-budget-catalog-trigger tf-budget-command-button" onClick={()=>setCatalogOpen(true)}><Library aria-hidden="true"/>Firemní číselníky</button>
        <div ref={viewOptions} className="tf-budget-view-settings" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setViewOptionsOpen(false);}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setViewOptionsOpen(false);viewOptionsButton.current?.focus();}}}>
          <button ref={viewOptionsButton} type="button" className="tf-budget-view-settings-trigger tf-budget-command-button" aria-label="Nastavení zobrazení" title="Nastavení zobrazení" aria-expanded={viewOptionsOpen} aria-controls={viewOptionsId} onClick={()=>setViewOptionsOpen(open=>!open)}><Settings aria-hidden="true"/></button>
          {viewOptionsOpen&&<div id={viewOptionsId} role="group" aria-label="Nastavení zobrazení rozpočtu" className="tf-budget-view-settings-panel">
            <strong>Nastavení zobrazení</strong>
            {current&&tab==='items'&&<button onClick={()=>{setViewOptionsOpen(false);setScopeOpen(true);}}>Rozsah: {sheets.find(s=>s.id===view.scope)?.title||'Celý rozpočet'} ▾</button>}
            <label className="tf-budget-view-settings-wrap">Zalamovat text popisu<input type="checkbox" checked={view.wrap} onChange={e=>updateView({wrap:e.target.checked})}/></label>
            <label className="tf-budget-view-settings-wrap">Zobrazit mřížku<input type="checkbox" checked={view.grid} onChange={e=>updateView({grid:e.target.checked})}/></label>
            <fieldset className="tf-budget-density"><legend>Hustota zobrazení</legend><div><button type="button" aria-pressed={view.density===44} onClick={()=>updateView({density:44})}>Kompaktní</button><button type="button" aria-pressed={view.density===60} onClick={()=>updateView({density:60})}>Pohodlná</button></div><p className="tf-budget-density-help">Mění výšku řádků tabulky.</p></fieldset>
            <button type="button" onClick={()=>{setViewOptionsOpen(false);setColumnsOpen(true);}}>Zobrazení sloupců <span aria-hidden="true">→</span></button>
          </div>}
        </div>
    </div>
    {(error||index.error||revision.error||sources.error||catalog.error)&&<p role="alert" className="tf-budget-error">{error||index.error?.message||revision.error?.message||sources.error?.message||catalog.error?.message}<button onClick={()=>{setError('');void cache.invalidateQueries({queryKey:key});}}>Obnovit</button></p>}
    {notice&&<p role="status" className="tf-budget-notice">{notice}<button aria-label="Zavřít oznámení" onClick={()=>setNotice('')}>×</button></p>}
    {tab==='versions'?<div className="overflow-auto p-4"><BudgetVersions revisions={index.data?.revisions??[]} sources={sources.data??[]} permissions={permissions!} purgeJobs={index.data?.purgeJobs} onPurge={async(jobId,selection)=>{try{await budgetApi.purge(projectId,jobId,selection);setRevisionId('');setSelected(new Set());setUndo(null);setNotice('Trvalé mazání dokončeno.');}finally{await cache.invalidateQueries({queryKey:key});}}} readOnly={readOnly} categoryNames={new Map(categories.map(c=>[c.id,c.title]))}
      onOpen={id=>{openVersion(id);setTab(index.data?.revisions.find(r=>r.id===id)?.deleted_at?'versions':'items');}}
      onDownload={s=>void act(async()=>{const blob=await budgetApi.download(s);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=s.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);})}
      onConvert={s=>{setImportSource(s);setImportOpen(true);}}
      onChange={async(id,kind,restore,version)=>{await budgetApi.trash(projectId,id,kind,restore,version);setRevisionId('');setSelected(new Set());setUndo(null);await cache.invalidateQueries({queryKey:key});setNotice(restore?'Obnoveno z koše.':'Přesunuto do koše. Částky v plánu VŘ se nezměnily.');}}/>
      <h3>Historie otevřené verze</h3>{history.data?.map(h=><p key={h.id}>{new Date(h.created_at).toLocaleString('cs-CZ')} · {({set_primary:'Nastavení hlavní verze',trash:'Přesunuto do koše',restore:'Obnoveno z koše',create:'Vytvoření',save:'Úprava',confirm:'Potvrzení',apply_tender_plan:'Převzetí do plánu VŘ'} as Record<string,string>)[h.event]||h.event} · verze {h.previous_version??'-'} → {h.new_version}</p>)}
    </div>:revision.isPending&&activeId?<p role="status">Načítání rozpočtu…</p>:!current?<div className="p-10"><h3>Rozpočet zatím neobsahuje žádné položky</h3><p>Nahrajte XLSX jako přílohu nebo jej převeďte na pracovní rozpočet.</p></div>:<>
      {!!activeFilters.length&&<div className="tf-budget-toolbar">{activeFilters.map(([c,f])=><button key={c} onClick={()=>{if(c==='$all'){onSearchChange?.('');return;}const next={...filters};delete next[c];setFilters(next);}}>{c==='$all'?'Hledání':DEFAULT_COLUMNS.find(col=>col.key===c)?.label}: {f.search||''} {f.selected!==undefined?`${f.selected.length} hodnot`:''} {f.min?`od ${f.min}`:''} {f.max?`do ${f.max}`:''} ×</button>)}<button onClick={()=>{setFilters({});onSearchChange?.('');}}>Vymazat všechny filtry</button></div>}
      <div className={`tf-budget-workspace ${tab==='recap'?'tf-budget-workspace-recap':''}`}>{(view.panel||tab==='recap')&&<BudgetRecap key={activeId} activeId={jumpId} nodes={nodes} onJump={jump} prices={!!permissions?.prices}/>}{tab==='items'&&<BudgetTable key={`table-${activeId}`} figures={current.document.figures} nodes={nodes} scope={view.scope} filters={effectiveFilters} onFilters={next=>{const {$all,...columns}=next;setFilters(columns);}} selected={selected} onSelected={setSelected} showVV={false} expandedVV={expandedVV} onExpandedVV={setExpandedVV} wrap={view.wrap} density={view.density} columns={view.columns} onColumns={columns=>updateView({columns})} canPrices={!!permissions?.prices} editable={editable} jumpId={jumpId} jumpRequest={jumpRequest} onNotice={setNotice} onEdit={async edited=>{const document=applyBudgetItemEdit(current.document,edited);await save(document);}}/>}</div>
      {!!selected.size&&<div className="tf-budget-toolbar tf-budget-selection"><strong>{selected.size} vybraných položek napříč rozsahy</strong><button disabled={!editable||!permissions?.allocate} onClick={()=>{setCategoryId('');setAllocationQuantity('');setAllocationOpen(true);}}>Přiřadit / rozdělit do VŘ</button><ThemedNativeSelect aria-label="Štítek výběru" value={tagId} onChange={e=>setTagId(e.target.value)}><option value="">Vyberte štítek</option>{catalog.data?.filter(t=>t.kind==='tag'&&!t.archived).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</ThemedNativeSelect><button disabled={!editable||!tagId} onClick={()=>void act(()=>save({...current.document,nodes:current.document.nodes.map(n=>selected.has(n.id)?{...n,tags:[...new Set([...n.tags,tagId])]}:n)}))}>Přiřadit štítek</button><button onClick={()=>exportBudget(nodes.filter(n=>selected.has(n.id)),'vyber-rozpoctu.xlsx')}>Exportovat výběr</button><button onClick={()=>setSelected(new Set())}>Zrušit výběr</button></div>}
    </>}
    {scopeOpen&&<Modal isOpen title="Rozsah rozpočtu" onClose={()=>setScopeOpen(false)}><div className="tf-budget-controls"><label className="tf-budget-field">Hledat soupis<input autoFocus aria-label="Hledat soupis" value={scopeSearch} onChange={e=>setScopeSearch(e.target.value)} placeholder="Kód nebo název soupisu…"/></label><button onClick={()=>{updateView({scope:''});setScopeOpen(false);}}>Celý rozpočet</button><p>Připnuté a nedávné soupisy jsou první. Výběr položek zůstává zachován.</p>{!sheets.some(s=>normalizeSearch(`${s.name} ${s.title}`).includes(normalizeSearch(scopeSearch)))&&<p role="status">Žádný soupis neodpovídá hledání.</p>}{sheets.filter(s=>normalizeSearch(`${s.name} ${s.title}`).includes(normalizeSearch(scopeSearch))).sort((a,b)=>(view.pinned.includes(b.id)?100:0)+(view.recent.includes(b.id)?10:0)-(view.pinned.includes(a.id)?100:0)-(view.recent.includes(a.id)?10:0)).map(s=><div className="flex gap-2 py-1" key={s.id}><button aria-label={`Připnout ${s.title}`} onClick={()=>updateView({pinned:view.pinned.includes(s.id)?view.pinned.filter(id=>id!==s.id):[...view.pinned,s.id]})}>{view.pinned.includes(s.id)?'★':'☆'}</button><button onClick={()=>{updateView({scope:s.id,recent:[s.id,...view.recent.filter(id=>id!==s.id)].slice(0,8)});setScopeOpen(false);}}>{s.title}</button></div>)}</div></Modal>}
    {columnsOpen&&<BudgetColumnSettings columns={view.columns} onChange={columns=>updateView({columns})} onClose={()=>{setColumnsOpen(false);viewOptionsButton.current?.focus();}}/>}
    {catalogOpen&&<BudgetCatalogDialog organizationId={organizationId} userId={userId} readOnly={readOnly} onClose={()=>setCatalogOpen(false)}/>}
    {allocationOpen&&current&&<Modal isOpen title="Přiřazení množství do VŘ" persistent={saving} onClose={()=>setAllocationOpen(false)}><div className="tf-budget-controls flex flex-col gap-3"><p>{selected.size} položek. Existující alokace zůstanou zachované. Plán VŘ, nabídky ani smlouvy se nemění.</p><ThemedNativeSelect aria-label="Cílové VŘ" value={categoryId} onChange={e=>setCategoryId(e.target.value)}><option value="">Vyberte VŘ</option>{categories.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</ThemedNativeSelect>{selected.size===1&&<label>Množství (prázdné = zbývající množství)<input value={allocationQuantity} onChange={e=>setAllocationQuantity(e.target.value)}/></label>}<div className="max-h-48 overflow-auto">{current.document.nodes.filter(n=>selected.has(n.id)).map(n=><p key={n.id}>{n.code}: {n.quantity} {n.unit} · {current.allocations.filter(a=>a.itemId===n.id).map(a=>`${categories.find(c=>c.id===a.categoryId)?.title}: ${a.quantity}`).join(', ')||'Bez alokace'}</p>)}</div><button disabled={!categoryId||saving} onClick={()=>void act(async()=>{const additions=createRemainingAllocations(current.document.nodes,current.allocations,selected,categoryId,allocationQuantity);if(!additions.length)throw new Error('Vybrané položky nemají zbývající množství k přiřazení.');await save(current.document,[...current.allocations,...additions]);setAllocationOpen(false);})}>Potvrdit přiřazení</button>{error&&<p role="alert">{error}</p>}</div></Modal>}
    {planOpen&&current&&<Modal isOpen title="Převzít částku do plánu VŘ" persistent={saving} onClose={()=>setPlanOpen(false)}><div className="tf-budget-controls flex flex-col gap-3"><p>Tato samostatná akce změní pouze plánovaný rozpočet vybraného VŘ. Nabídky a smlouvy zůstávají beze změny.</p><ThemedNativeSelect aria-label="VŘ pro převzetí plánu" value={categoryId} onChange={e=>setCategoryId(e.target.value)}><option value="">Vyberte VŘ</option>{categories.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</ThemedNativeSelect>{categoryId&&<><p>Původní plán: {formatBudgetNumber(String(categories.find(c=>c.id===categoryId)?.planBudget??0),true)} Kč</p><p>Nový plán: {formatBudgetNumber(sumMoney(current.allocations.filter(a=>a.categoryId===categoryId).map(a=>{const n=current.document.nodes.find(n=>n.id===a.itemId);return n?.unitPrice===null||!n?null:multiplyMoney(a.quantity,n.unitPrice);})),true)} Kč · zdroj {current.title}</p><button disabled={saving} onClick={()=>void act(async()=>{const amount=await budgetApi.applyPlan(projectId,current.id,categoryId,categories.find(c=>c.id===categoryId)?.planBudget??0);setPlanOpen(false);setNotice(`Plán VŘ aktualizován na ${formatBudgetNumber(amount,true)} Kč.`);await cache.invalidateQueries();})}>Potvrdit změnu plánu VŘ</button></>}{error&&<p role="alert">{error}</p>}</div></Modal>}
    {importOpen&&<BudgetImportDialog canAllocate={!!index.data?.permissions.allocate} hasVersions={!!index.data?.revisions.length} projectId={projectId} source={importSource} previous={current} onClose={()=>{setImportOpen(false);void cache.invalidateQueries({queryKey:key});}} onComplete={(r?:BudgetRevision)=>{setImportOpen(false);if(r){setRevisionId(r.id);updateView({scope:''});setSelected(new Set());setUndo(null);cache.setQueryData([...key,'revision',r.id],r);}void cache.invalidateQueries({queryKey:key});}}/>}
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
