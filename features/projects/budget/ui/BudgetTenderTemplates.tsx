import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@shared/ui/Modal';
import { budgetApi } from '../api/budgetApi';
import { parseTenderTemplate, tenderNameKey } from '../model/tenderImport';
import type { ProjectTender } from '../model/tenderImport';

export function BudgetTenderTemplates({projectId,onClose}:{projectId:string;onClose:()=>void}) {
  const cache=useQueryClient();
  const catalog=useQuery({queryKey:['budget-project-tenders',projectId],queryFn:()=>budgetApi.projectTenders(projectId),refetchOnWindowFocus:false});
  const [definitions,setDefinitions]=useState<ProjectTender[]>([]);const [selected,setSelected]=useState<Set<string>>(new Set());
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const lock=useRef(false);const operation=useRef<{signature:string;id:string}|null>(null);
  const duplicate=(entry:ProjectTender)=>catalog.data?.some(c=>tenderNameKey(c.title)===tenderNameKey(entry.title)||!!entry.externalCode.trim()&&entry.externalCode.trim()===c.externalCode);
  const saveTemplate=()=>{
    if(!catalog.data)return;
    const content={format:'tender-flow-tenders',version:1,categories:catalog.data.map(c=>({title:c.title,externalCode:c.externalCode}))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='muj-vzor-vr.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const load=async(file?:File)=>{
    if(!file)return;setError('');setNotice('');
    try{
      if(file.size>1024*1024)throw new Error('Vzor smí mít nejvýše 1 MB.');
      const entries=parseTenderTemplate(await file.text()).map(c=>({...c,id:crypto.randomUUID()}));
      setDefinitions(entries);setSelected(new Set(entries.filter(c=>!duplicate(c)).map(c=>c.id)));
    }catch(e){setError(e instanceof Error?e.message:'Vzor nelze načíst.');}
  };
  const chosen=definitions.filter(c=>selected.has(c.id)).map(c=>({...c,title:c.title.trim(),externalCode:c.externalCode.trim()}));
  const conflict=chosen.some((c,i)=>duplicate(c)||chosen.slice(0,i).some(p=>tenderNameKey(p.title)===tenderNameKey(c.title)||!!c.externalCode&&p.externalCode===c.externalCode));
  const apply=async()=>{
    if(lock.current||!catalog.data||conflict||!chosen.length)return;lock.current=true;setBusy(true);setError('');
    try{
      const request={mode:'template' as const,expectedCatalog:catalog.data,newCategories:chosen,assignments:[]};
      const signature=JSON.stringify(request);if(operation.current?.signature!==signature)operation.current={signature,id:crypto.randomUUID()};
      const result=await budgetApi.importTenders(projectId,{...request,operationId:operation.current.id});
      setNotice(`V projektu bylo vytvořeno ${chosen.length} samostatných VŘ. Názvy lze upravit v přehledu VŘ. ${result.docHubWarning??''}`);setDefinitions([]);setSelected(new Set());await cache.invalidateQueries();
    }catch(e){setError(e instanceof Error?e.message:'Vzor se nepodařilo použít.');}finally{lock.current=false;setBusy(false);}
  };
  return <Modal isOpen title="Vlastní vzory VŘ" persistent={busy} onClose={onClose}><div className="tf-budget-tender-import tf-budget-controls">
    <p>Uložte si názvy a čísla VŘ do vlastního souboru. Stejný vzor můžete opakovaně použít v dalších projektech. Každá projektová kopie je nezávislá a upravitelná.</p>
    <button disabled={busy||!catalog.data?.length} onClick={saveTemplate}>Uložit projektová VŘ jako vlastní vzor</button>
    <label>Použít uložený vzor<input type="file" accept=".json,application/json" disabled={busy||!catalog.data} onChange={e=>{void load(e.target.files?.[0]);e.target.value='';}}/></label>
    {!!definitions.length&&<><p>Vyberte definice, které chcete vytvořit. Existující VŘ se nepřepisují. Vzor neobsahuje alokace, nabídky, dodavatele, dokumenty ani stav řízení.</p>
      {definitions.map((c,i)=><div key={c.id}><label><input type="checkbox" checked={selected.has(c.id)} disabled={busy||!!duplicate(c)&&!selected.has(c.id)} onChange={e=>{const next=new Set(selected);if(e.target.checked)next.add(c.id);else next.delete(c.id);setSelected(next);}}/>{duplicate(c)?selected.has(c.id)?'Již existuje – zrušte výběr':'Již existuje – vynecháno':'Vytvořit'}</label>
        <label>Číslo VŘ<input value={c.externalCode} maxLength={100} disabled={busy} onChange={e=>setDefinitions(definitions.map((v,j)=>j===i?{...v,externalCode:e.target.value}:v))}/></label>
        <label>Název VŘ<input value={c.title} maxLength={255} disabled={busy} onChange={e=>setDefinitions(definitions.map((v,j)=>j===i?{...v,title:e.target.value}:v))}/></label>
      </div>)}
      {conflict&&<p role="alert">Vyřešte duplicitní názvy nebo čísla ve výběru.</p>}
      <button disabled={busy||conflict||!chosen.length||chosen.some(c=>!c.title.trim())} onClick={()=>void apply()}>Vytvořit {chosen.length} VŘ v tomto projektu</button></>}
    {catalog.error&&<p role="alert">{catalog.error.message}</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </div></Modal>;
}
