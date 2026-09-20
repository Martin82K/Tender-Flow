import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemedNativeSelect } from '@shared/ui/ThemedNativeSelect';
import { budgetApi } from '../api/budgetApi';
import { columnLetter, detectTenderColumns, matchTenderRows, planTenderAllocations, readTenderRows, tenderKey, tenderNameKey } from '../model/tenderImport';
import { isPriced } from '../model/types';
import type { TenderAssignment, TenderColumns, ProjectTender } from '../model/tenderImport';
import type { BudgetAllocation, BudgetDocument, BudgetRevision } from '../model/types';

interface Props {
  projectId: string; sourceId: string; document: BudgetDocument; previous?: BudgetRevision;
  mode: 'assignments' | 'revision'; title: string; allocations: BudgetAllocation[];
  onBack: () => void; onComplete: (revision: BudgetRevision) => void; onBusyChange: (busy:boolean) => void;
}
export function BudgetTenderImport({projectId,sourceId,document,previous,mode,title,allocations,onBack,onComplete,onBusyChange}: Props) {
  const cache=useQueryClient();
  const catalog=useQuery({queryKey:['budget-project-tenders',projectId],queryFn:()=>budgetApi.projectTenders(projectId),refetchOnWindowFocus:false});
  const [mapping,setMapping]=useState<Record<string,TenderColumns>>(()=>Object.fromEntries(document.sheets.map(s=>[s.id,detectTenderColumns(s)])));
  const [confirmed,setConfirmed]=useState(false); const [acknowledged,setAcknowledged]=useState(false);
  const [choices,setChoices]=useState<Record<string,string>>({}); const [targets,setTargets]=useState<Record<string,string>>({});
  const [actions,setActions]=useState<Record<string,TenderAssignment['action']>>({});
  const [page,setPage]=useState(0); const [query,setQuery]=useState('');
  const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const lock=useRef(false);
  const [targetQuery,setTargetQuery]=useState('');
  useEffect(()=>{onBusyChange(busy);return ()=>onBusyChange(false);},[busy,onBusyChange]);
  const operation=useRef<{signature:string;id:string}|null>(null);
  const targetDocument=mode==='assignments'?previous!.document:document;
  const existing=mode==='assignments'?previous!.allocations:allocations;
  const rows=useMemo(()=>readTenderRows(document,mapping),[document,mapping]);
  const named=useMemo(()=>rows.filter(r=>r.name),[rows]);
  const matches=useMemo(()=>mode==='assignments'?matchTenderRows(named,targetDocument.nodes):named.map(row=>({row,targetId:row.node.id,candidates:[row.node.id]})),[named,targetDocument,mode]);
  const targetNodes=useMemo(()=>targetDocument.nodes.filter(isPriced),[targetDocument]);
  const nodeIndex=useMemo(()=>new Map(targetNodes.map(n=>[n.id,n])),[targetNodes]);
  const existingByItem=useMemo(()=>{const index=new Map<string,BudgetAllocation[]>();for(const a of existing)index.set(a.itemId,[...(index.get(a.itemId)??[]),a]);return index;},[existing]);
  const groups=useMemo(()=>[...new Map(named.map(row=>[tenderKey(row.externalCode,row.name),{key:tenderKey(row.externalCode,row.name),title:row.name,externalCode:row.externalCode}])).values()],[named]);
  const newIds=useRef(new Map<string,string>());
  const getNewId=(key:string)=>{if(!newIds.current.has(key))newIds.current.set(key,crypto.randomUUID());return newIds.current.get(key)!;};
  const groupChoice=(group:typeof groups[number])=>{
    if(Object.hasOwn(choices,group.key))return choices[group.key];
    const names=catalog.data?.filter(c=>tenderNameKey(c.title)===tenderNameKey(group.title))??[];
    const codes=group.externalCode?catalog.data?.filter(c=>c.externalCode===group.externalCode)??[]:[];
    if(names.length===1&&(!group.externalCode||!names[0].externalCode||names[0].externalCode===group.externalCode)&&codes.every(c=>c.id===names[0].id))return names[0].id;
    return names.length||codes.length?'':'new';
  };
  const categories=new Map(groups.map(g=>[g.key,groupChoice(g)]));
  const targetOf=(m:typeof matches[number])=>Object.hasOwn(targets,m.row.node.id)?targets[m.row.node.id]:m.targetId??'';
  const selectedIds=new Map<string,number>();for(const m of matches){if(categories.get(tenderKey(m.row.externalCode,m.row.name))==='skip')continue;const id=targetOf(m);if(id&&id!=='skip')selectedIds.set(id,(selectedIds.get(id)??0)+1);}
  let unresolved=0; const proposed:TenderAssignment[]=[]; const usedGroups=new Set<string>();
  for(const match of matches){
    const key=tenderKey(match.row.externalCode,match.row.name);const choice=categories.get(key);const target=targetOf(match);
    if(choice==='skip'||target==='skip')continue;
    if(!choice||!target||(selectedIds.get(target)??0)>1){unresolved++;continue;}
    const categoryId=choice==='new'?getNewId(key):choice;
    const prior=existingByItem.get(target)??[];
    const same=prior.length>0&&prior.every(a=>a.categoryId===categoryId);
    const action=actions[match.row.node.id]??(prior.length?(same?'keep':'unresolved'):'remaining');
    if(action==='unresolved'){unresolved++;continue;}
    usedGroups.add(key);proposed.push({itemId:target,categoryId,action});
  }
  const newCategories:ProjectTender[]=groups.filter(g=>usedGroups.has(g.key)&&categories.get(g.key)==='new').map(g=>({id:getNewId(g.key),title:g.title,externalCode:g.externalCode}));
  const duplicateDefinitions=newCategories.some((c,i)=>newCategories.slice(0,i).some(p=>tenderNameKey(p.title)===tenderNameKey(c.title)||!!c.externalCode&&p.externalCode===c.externalCode));
  let validation='';let planned=existing;
  try{planned=planTenderAllocations(targetDocument.nodes,existing,proposed);}catch(e){validation=e instanceof Error?e.message:'Neplatné přiřazení.';}
  const visible=matches.filter(m=>`${m.row.node.code} ${m.row.node.description} ${m.row.name}`.toLocaleLowerCase('cs').includes(query.toLocaleLowerCase('cs')));
  const pages=Math.max(1,Math.ceil(visible.length/30));const currentPage=Math.min(page,pages-1);
  const save=async()=>{
    if(lock.current||!confirmed||!acknowledged||unresolved||validation||duplicateDefinitions||!proposed.length||!catalog.data)return;
    lock.current=true;setBusy(true);setError('');
    try{
      const request={mode,sourceId,expectedCatalog:catalog.data,newCategories,assignments:proposed,
        ...(previous?{revisionId:previous.id,version:previous.version}:{}),
        ...(mode==='revision'?{document,allocations,title}:{})};
      const signature=JSON.stringify(request);
      if(operation.current?.signature!==signature)operation.current={signature,id:crypto.randomUUID()};
      const result=await budgetApi.importTenders(projectId,{...request,operationId:operation.current.id});
      if(!result.revision)throw new Error('Server nevrátil uloženou revizi.');
      await cache.invalidateQueries();onComplete(result.revision);
    }catch(e){setError(e instanceof Error?e.message:'Import se nepodařilo uložit.');}finally{lock.current=false;setBusy(false);}
  };
  return <div className="tf-budget-tender-import tf-budget-controls">
    <h3>{mode==='assignments'?'Převzít přiřazení do VŘ':'VŘ v nové verzi rozpočtu'}</h3>
    <p>{mode==='assignments'?`Cíl: ${previous!.title}. Ceny, množství a struktura pocházejí z této revize.`:'Přiřazení se uloží společně s novou verzí rozpočtu.'}</p>
    {mode==='assignments'&&previous!.status==='confirmed'&&<p>Potvrzená revize zůstane zachovaná. Vznikne její pracovní kopie s přiřazením.</p>}
    {!confirmed?<>
      <p>Zkontrolujte navržené sloupce podle skutečných buněk. Každý list může mít jiné rozložení.</p>
      {document.sheets.filter(s=>s.selected&&s.role==='items').map(sheet=><fieldset key={sheet.id}><legend>{sheet.name}</legend>
        {(['name','code','part','sourceRef'] as const).map((field,index)=><label key={field}>{['Název VŘ','Číslo VŘ (volitelné)','Část / objekt (volitelné)','Zdrojový list a řádek (volitelné)'][index]}
          <ThemedNativeSelect aria-label={`${sheet.name}: ${field}`} value={mapping[sheet.id]?.[field]??''} onChange={e=>{setMapping({...mapping,[sheet.id]:{...mapping[sheet.id],[field]:e.target.value===''?undefined:Number(e.target.value)}});setTargets({});setActions({});setChoices({});setAcknowledged(false);}}>
            <option value="">{field==='name'?'Bez přiřazení z tohoto listu':'Nepoužít'}</option>
            {Array.from({length:sheet.sourcePreview?.columnCount??0},(_,col)=>{const header=sheet.sourcePreview?.rows.find(r=>r.row===sheet.headerRow)?.cells[col]?.value;const sample=sheet.sourcePreview?.rows.filter(r=>r.row>sheet.headerRow&&r.cells[col]?.value!==null&&r.cells[col]?.value!==undefined).slice(0,3).map(r=>String(r.cells[col].value).slice(0,55)).join(' · ');return <option key={col} value={col}>{columnLetter(col)} · {String(header??'bez hlavičky')} · {sample}</option>;})}
          </ThemedNativeSelect></label>)}
        <div className="tf-budget-tender-preview"><table><thead><tr><th>Řádek</th><th>Kód položky</th><th>Číslo VŘ</th><th>Název VŘ</th></tr></thead><tbody>{rows.filter(r=>r.node.sheetId===sheet.id).slice(0,5).map(r=><tr key={r.node.id}><td>{r.node.source.row}</td><td>{r.node.code}</td><td>{r.externalCode||'—'}</td><td>{r.name||'—'}</td></tr>)}</tbody></table></div>
      </fieldset>)}
      <button onClick={()=>setConfirmed(true)} disabled={!named.length}>Potvrdit sloupce a zkontrolovat shody</button>
    </>:<>
      <button disabled={busy} onClick={()=>{setConfirmed(false);setAcknowledged(false);}}>Upravit sloupce</button>
      <h4>Projektová výběrová řízení</h4>
      <div className="tf-budget-tender-groups">{catalog.isPending?<p role="status">Načítání VŘ…</p>:catalog.error?<p role="alert">{catalog.error.message} <button onClick={()=>void catalog.refetch()}>Zkusit znovu</button></p>:groups.map(group=><label key={group.key}>{group.externalCode} · {group.title}
        <ThemedNativeSelect aria-label={`VŘ: ${group.title}`} disabled={busy} value={groupChoice(group)} onChange={e=>{setChoices({...choices,[group.key]:e.target.value});setActions({});setAcknowledged(false);}}>
          <option value="">Vyřešit shodu názvu / čísla</option><option value="new">Vytvořit nové VŘ v tomto projektu</option><option value="skip">Vynechat tuto skupinu</option>
          {catalog.data?.map(c=><option key={c.id} value={c.id}>{c.externalCode} · {c.title}</option>)}
        </ThemedNativeSelect></label>)}</div>
      {duplicateDefinitions&&<p role="alert">Nové skupiny mají duplicitní název nebo číslo. Namapujte je na existující VŘ nebo jednu skupinu vynechte.</p>}
      <h4>Párování položek a existující vazby</h4>
      <label>Hledat položku<input value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label>
      <label>Hledat další cílové položky (kód nebo popis)<input value={targetQuery} onChange={e=>setTargetQuery(e.target.value)}/></label>
      <div className="tf-budget-tender-preview"><table><thead><tr><th>Zdroj</th><th>Cílová položka</th><th>Existující přiřazení</th></tr></thead><tbody>{visible.slice(currentPage*30,(currentPage+1)*30).map(match=>{
        const target=targetOf(match);const prior=existingByItem.get(target)??[];const group=categories.get(tenderKey(match.row.externalCode,match.row.name));const categoryId=group==='new'?getNewId(tenderKey(match.row.externalCode,match.row.name)):group;
        const same=prior.length>0&&prior.every(a=>a.categoryId===categoryId);
        const suggestions=match.candidates.length?match.candidates.map(id=>nodeIndex.get(id)!).filter(Boolean):targetNodes.filter(n=>n.unit===match.row.node.unit&&n.code===match.row.node.code).slice(0,100);
        const searched=targetQuery.trim()?targetNodes.filter(n=>n.unit===match.row.node.unit&&`${n.code} ${n.description}`.toLocaleLowerCase('cs').includes(targetQuery.toLocaleLowerCase('cs'))).slice(0,100):[];
        const selected=nodeIndex.get(target);
        const candidates=[...new Map([...suggestions,...searched,...(selected?[selected]:[])].map(n=>[n.id,n])).values()];
        return <tr key={match.row.node.id}><td>{match.row.node.source.sheet}:{match.row.node.source.row}<br/>{match.row.part}<br/>{match.row.node.code} · {match.row.node.description}<br/><small>{match.row.name}</small></td><td>
          <ThemedNativeSelect aria-label={`Položka ${match.row.node.id}`} disabled={busy} value={target} onChange={e=>{setTargets({...targets,[match.row.node.id]:e.target.value});setActions({...actions,[match.row.node.id]:'unresolved'});setAcknowledged(false);}}>
            <option value="">Rozhodnout shodu</option><option value="skip">Vynechat položku</option>
            {candidates.map(n=><option key={n.id} value={n.id}>{n.source.sheet}:{n.source.row} · {n.code} · {n.description} · {n.quantity} {n.unit}</option>)}
          </ThemedNativeSelect>
          {(selectedIds.get(target)??0)>1&&<span role="alert">Stejný cíl je vybraný vícekrát.</span>}
          {!candidates.length&&<small>Vyhledejte cílovou položku výše nebo položku výslovně vynechte. Jednotky se musí shodovat.</small>}
        </td><td>{prior.map(a=><div key={a.categoryId}>{catalog.data?.find(c=>c.id===a.categoryId)?.title??a.categoryId}: {a.quantity}</div>)}
          <ThemedNativeSelect aria-label={`Vazby ${match.row.node.id}`} disabled={busy||!target||target==='skip'} value={actions[match.row.node.id]??(prior.length?(same?'keep':'unresolved'):'remaining')} onChange={e=>{setActions({...actions,[match.row.node.id]:e.target.value as TenderAssignment['action']});setAcknowledged(false);}}>
            <option value="unresolved">Rozhodnout o vazbách</option><option value="keep">Zachovat beze změny</option><option value="remaining">Přiřadit jen zbývající množství</option><option value="replace">Nahradit vazby této položky</option>
          </ThemedNativeSelect>
        </td></tr>;
      })}</tbody></table></div>
      <div><button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Předchozí</button> {currentPage+1} / {pages} <button disabled={currentPage+1>=pages} onClick={()=>setPage(currentPage+1)}>Další</button></div>
      <p role="status">{rows.length} položek · {rows.length-named.length} bez názvu VŘ (beze změny) · {unresolved} nevyřešených · {newCategories.length} nových VŘ · {proposed.filter(a=>a.action==='replace').length} nahrazení vazeb · {planned.length} výsledných alokací.</p>
      <label><input type="checkbox" checked={acknowledged} disabled={busy} onChange={e=>setAcknowledged(e.target.checked)}/>Zkontroloval jsem dopady včetně vynechaných položek a nahrazení vazeb. Plány VŘ, nabídky a smlouvy se nemění.</label>
      {validation&&<p role="alert">{validation}</p>}
      <button className="tf-budget-import-primary" disabled={busy||!acknowledged||!!unresolved||!!validation||duplicateDefinitions||!proposed.length||!catalog.data} onClick={()=>void save()}>{busy?'Ukládání…':'Potvrdit import přiřazení'}</button>
    </>}
    {error&&<p role="alert">{error} Při změně rozpočtu nebo seznamu VŘ zavřete import a otevřete nový náhled.</p>}
    <button disabled={busy} onClick={onBack}>Zpět ke kontrole rozpočtu</button>
  </div>;
}
