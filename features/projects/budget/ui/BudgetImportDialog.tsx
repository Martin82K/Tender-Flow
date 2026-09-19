import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, FileSpreadsheet, LoaderCircle, Paperclip, ShieldCheck, Upload } from 'lucide-react';
import { ThemedNativeSelect } from '@shared/ui/ThemedNativeSelect';
import { Modal } from '@shared/ui/Modal';
import { budgetApi } from '../api/budgetApi';
import { importInWorker } from '../api/importWorker';
import type { BudgetDocument, BudgetRevision, BudgetSource } from '../model/types';
import type { KrosMapping } from '../model/krosImport';
import { normalizeSearch } from '../model/budgetModel';
import { compareRevisions, proposeRevisionMapping, transferRevisionLinks } from '../model/revisions';
interface Props { projectId:string; source?:BudgetSource; previous?:BudgetRevision; hasVersions?:boolean; onClose:()=>void; onComplete:(revision?:BudgetRevision)=>void }
export function BudgetImportDialog({projectId,source:initialSource,previous,hasVersions=!!previous,onClose,onComplete}:Props) {
  const [transfer,setTransfer]=useState(false);const [links,setLinks]=useState<Record<string,string>>({});
  const [mapping,setMapping]=useState<KrosMapping>({});const [mappingSheet,setMappingSheet]=useState('');
  const [file,setFile]=useState<File|null>(null);const [mode,setMode]=useState<'attachment'|'convert'>('convert');const [source,setSource]=useState(initialSource);
  const [document,setDocument]=useState<BudgetDocument|null>(null);const [title,setTitle]=useState(hasVersions?'Nová verze rozpočtu':'Výchozí rozpočet');const [phase,setPhase]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);const controller=useRef<AbortController|null>(null);
  const [sheetSearch,setSheetSearch]=useState('');const [mappingOpen,setMappingOpen]=useState(false);
  const operationLock=useRef(false);
  const [dragging,setDragging]=useState(false);const dragDepth=useRef(0);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const selectFiles=(files:File[])=>{
    if(busy||!files.length)return;
    if(files.length!==1){setError('Vyberte pouze jeden soubor XLSX.');return;}
    const next=files[0];
    if(!/\.xlsx$/i.test(next.name)){setError('Podporován je pouze soubor XLSX.');return;}
    if(next.size>30*1024*1024){setError('Soubor překračuje limit 30 MB.');return;}
    if(!next.size){setError('Soubor je prázdný. Vyberte platný sešit XLSX.');return;}
    setFile(next);setSource(undefined);setDocument(null);setMapping({});setMappingSheet('');setPhase('');setError('');
  };
  const start=async()=>{
    if(operationLock.current)return;operationLock.current=true;
    setError('');setBusy(true);const abort=new AbortController();controller.current=abort;let registered=source;
    try{
      if(!registered){if(!file)throw new Error('Vyberte soubor.');setPhase('Ukládání originálu');registered=await budgetApi.registerSource(projectId,file);setSource(registered);}
      if(abort.signal.aborted)return;
      if(mode==='attachment'){onComplete();return;}
      await budgetApi.sourceStatus(registered,'processing');setPhase('Rozpoznání a validace');
      const blob=file??await budgetApi.download(registered);const parsed=await importInWorker(blob,abort.signal,(done,total)=>setPhase(`Rozpoznání listů ${done}/${total}`),mapping);
      setDocument({...parsed,origin:'import',importKey:crypto.randomUUID()});if(previous)setLinks(proposeRevisionMapping(previous.document,parsed));setPhase('');
    }catch(e){if(registered)await budgetApi.sourceStatus(registered,abort.signal.aborted?'cancelled':'failed').catch(()=>{});setError(e instanceof Error?e.message:'Import selhal.');}finally{operationLock.current=false;setBusy(false);}
  };
  useEffect(()=>{
    let active=true;
    if(initialSource)void Promise.resolve().then(()=>{if(active)void start();});
    return ()=>{active=false;};
  },[initialSource?.id]);
  const publish=async()=>{
    if(!source||!document||operationLock.current)return;operationLock.current=true;setBusy(true);setError('');setPhase('Ukládání rozpočtu…');
    try{
      const chosen=new Set(document.sheets.filter(s=>s.selected&&s.role==='items').map(s=>s.id));if(!chosen.size)throw new Error('Vyberte alespoň jeden soupis.');
      const chosenObjects=new Set(document.nodes.filter(n=>n.kind==='sheet'&&chosen.has(n.id)).map(n=>n.parentId));
      const filtered={...document,nodes:document.nodes.filter(n=>chosen.has(n.sheetId)||(n.kind==='object'&&chosenObjects.has(n.id))),issues:document.issues.filter(i=>i.kind==='ambiguous-figures'||document.sheets.some(s=>s.name===i.sheet&&chosen.has(s.id)))};
      const transferred=transfer&&previous?transferRevisionLinks(previous.document,filtered,previous.allocations,Object.fromEntries(Object.entries(links).filter(([,id])=>filtered.nodes.some(n=>n.id===id)))):{document:filtered,allocations:[]};
      const revision=await budgetApi.save({projectId,sourceId:source.id,title,...transferred});onComplete(revision);
    }catch(e){setError(e instanceof Error?e.message:'Uložení selhalo.');}finally{operationLock.current=false;setBusy(false);}
  };
  const itemSheets=document?.sheets.filter(s=>s.role==='items')??[];
  const selectedSheets=itemSheets.filter(s=>s.selected).length;
  const shownSheets=itemSheets.filter(s=>normalizeSearch(`${s.name} ${s.title} ${s.object}`).includes(normalizeSearch(sheetSearch)));
  const selectedNames=new Set(itemSheets.filter(s=>s.selected).map(s=>s.name));
  const issues=document?.issues.filter(i=>i.kind==='ambiguous-figures'||selectedNames.has(i.sheet))??[];
  const errorCount=issues.filter(i=>i.severity==='error').length;
  const downloadOriginal=async()=>{if(!source)return;try{const blob=await budgetApi.download(source);const url=URL.createObjectURL(blob);const a=window.document.createElement('a');a.href=url;a.download=source.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError(e instanceof Error?e.message:'Originál nelze stáhnout.');}};
  const differences=document&&previous?compareRevisions(previous.document,document):[];
  const sourcePreview=<div className="tf-budget-existing-file"><FileSpreadsheet size={24} aria-hidden="true"/><div><strong>{initialSource?.filename??file?.name}</strong><span className="tf-budget-import-muted">Uložená původní příloha</span></div></div>;
  return <Modal isOpen title={document?'Kontrola importu':initialSource?'Převod uložené přílohy':'Import rozpočtu'} description={document?'Vyberte soupisy, které chcete zařadit do rozpočtu.':initialSource?'Zpracování uloženého XLSX do položek rozpočtu.':'Vyberte XLSX a způsob importu.'} onClose={()=>{controller.current?.abort();onClose();}} persistent={busy} showCloseButton={!busy} size="lg" footer={document?<div className="tf-budget-controls tf-budget-import-footer"><span>{selectedSheets} / {itemSheets.length} soupisů</span><button className="tf-budget-import-primary" disabled={busy||!title.trim()||!selectedSheets} onClick={()=>void publish()}>{busy?'Ukládání…':hasVersions?'Vytvořit novou verzi':'Vytvořit rozpočet'}<ArrowRight size={14} aria-hidden="true"/></button></div>:!initialSource?<div className="tf-budget-controls tf-budget-import-footer"><span>{file||source?'Soubor je připravený k nahrání.':'Nejprve vyberte soubor.'}</span><button className="tf-budget-import-primary" disabled={busy||(!file&&!source)} onClick={()=>void start()}>{busy?<LoaderCircle size={16} className="tf-budget-spin" aria-hidden="true"/>:null}{busy?'Zpracovávám…':mode==='attachment'?'Uložit přílohu':'Nahrát a pokračovat'}{!busy&&<ArrowRight size={16} aria-hidden="true"/>}</button></div>:undefined}><div className="tf-budget-controls tf-budget-import flex flex-col gap-3">
    {!initialSource&&!document?<label className={`tf-budget-upload ${file?'tf-budget-upload-selected':''} ${busy?'tf-budget-upload-busy':''} ${dragging?'tf-budget-upload-dragging':''}`}
      onDragEnter={e=>{e.preventDefault();e.stopPropagation();if(!busy&&Array.from(e.dataTransfer.types).includes('Files')){dragDepth.current++;setDragging(true);}}}
      onDragOver={e=>{e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect=busy?'none':'copy';}}
      onDragLeave={e=>{e.preventDefault();e.stopPropagation();dragDepth.current=Math.max(0,dragDepth.current-1);if(!dragDepth.current)setDragging(false);}}
      onDrop={e=>{e.preventDefault();e.stopPropagation();dragDepth.current=0;setDragging(false);selectFiles(Array.from(e.dataTransfer.files));}}>
      <input className="tf-budget-file-input" aria-label="Soubor XLSX" type="file" accept=".xlsx" disabled={busy} onChange={e=>{selectFiles(Array.from(e.target.files??[]));e.target.value='';}}/>
      <span className="tf-budget-upload-icon">{file?<FileSpreadsheet size={26} aria-hidden="true"/>:<Upload size={26} aria-hidden="true"/>}</span>
      <strong>{dragging?'Pusťte soubor sem':file?file.name:'Přetáhněte sem rozpočet XLSX'}</strong>
      <span className="tf-budget-import-muted">{file?`${(file.size/1024/1024).toLocaleString('cs-CZ',{maximumFractionDigits:2})} MB · XLSX`:'Excelový sešit .xlsx · maximálně 30 MB'}</span>
      <span className="tf-budget-file-action">{file?'Změnit soubor':'Vybrat soubor'}<ArrowRight size={14} aria-hidden="true"/></span>
    </label>:!document?sourcePreview:null}
    {!document&&!initialSource&&<fieldset className="tf-budget-import-modes" disabled={busy}><legend>Jak chcete soubor použít?</legend>
      <label className={`tf-budget-import-option ${mode==='convert'?'is-selected':''}`}><input type="radio" name="budget-import-mode" checked={mode==='convert'} onChange={()=>setMode('convert')}/><FileSpreadsheet size={20} className="tf-budget-mode-icon" aria-hidden="true"/><span><strong>{hasVersions?'Nová verze rozpočtu':'Rozpočet do položek'}</strong><small>Položky převedete do rozpočtu. Před uložením zkontrolujete listy a jejich rozpoznání.</small></span><span className="tf-budget-radio-mark">{mode==='convert'&&<Check size={12} aria-hidden="true"/>}</span></label>
      <label className={`tf-budget-import-option ${mode==='attachment'?'is-selected':''}`}><input type="radio" name="budget-import-mode" checked={mode==='attachment'} onChange={()=>setMode('attachment')}/><Paperclip size={20} className="tf-budget-mode-icon" aria-hidden="true"/><span><strong>Pouze příloha</strong><small>Uložíte originál ke stavbě. Na rozpočet jej můžete převést později.</small></span><span className="tf-budget-radio-mark">{mode==='attachment'&&<Check size={12} aria-hidden="true"/>}</span></label>
    </fieldset>}
    {!document&&!initialSource&&<p className="tf-budget-import-assurance"><ShieldCheck size={16} aria-hidden="true"/><span>Původní soubor zůstane beze změny. Existující verze se nepřepíší.</span></p>}
    {phase&&<p role="status" className="tf-budget-import-progress">{busy&&<LoaderCircle size={16} className="tf-budget-spin" aria-hidden="true"/>}{phase}</p>}{busy&&!document&&<button onClick={()=>controller.current?.abort()}>Zrušit zpracování</button>}{error&&<p role="alert" className="tf-budget-error">{error}</p>}
    {initialSource&&!document&&!busy&&error&&<button onClick={()=>void start()}>Zkusit převod znovu</button>}
    {document&&<div className="tf-budget-import-review">
      <section className="tf-budget-import-selection" aria-label="Výběr soupisů">
      {sourcePreview}
      <label className="tf-budget-import-name">{hasVersions?'Název verze':'Název rozpočtu'}<input value={title} onChange={e=>setTitle(e.target.value)}/></label>
      <div className="tf-budget-import-stats"><span><strong>{itemSheets.length}</strong> soupisů</span><span><strong>{document.nodes.filter(n=>n.kind==='K'||n.kind==='M').length.toLocaleString('cs-CZ')}</strong> položek</span><span>{document.issues.filter(i=>i.severity==='error').length?`${document.issues.filter(i=>i.severity==='error').length} chyb`:'Bez blokujících chyb'}</span></div>
      <div className="tf-budget-sheet-picker"><div className="tf-budget-sheet-tools"><input aria-label="Hledat soupis při importu" placeholder="Hledat soupis nebo objekt…" value={sheetSearch} onChange={e=>setSheetSearch(e.target.value)}/><button disabled={busy} onClick={()=>setDocument({...document,sheets:document.sheets.map(s=>s.role==='items'?{...s,selected:true}:s)})}>Vše</button><button disabled={busy} onClick={()=>setDocument({...document,sheets:document.sheets.map(s=>({...s,selected:false}))})}>Žádný</button></div>
      <div className="tf-budget-sheet-list">{shownSheets.map(s=><label key={s.id} className={`tf-budget-sheet-row ${s.selected?'is-selected':''}`}><input type="checkbox" aria-label={`Zařadit ${s.name}`} disabled={busy} checked={s.selected} onChange={e=>setDocument({...document,sheets:document.sheets.map(other=>other.id===s.id?{...other,selected:e.target.checked}:other)})}/><span><strong title={s.title}>{s.title}</strong><small title={s.object}>{s.object}</small></span></label>)}{!shownSheets.length&&<p className="p-3 tf-budget-import-muted">Žádný soupis neodpovídá hledání.</p>}</div></div>
      {!!(document.sheets.length-itemSheets.length)&&<p className="tf-budget-import-muted">{document.sheets.length-itemSheets.length} pomocných listů zůstane v originální příloze.</p>}
      </section>
      <aside className="tf-budget-import-inspection" aria-label="Mapování a kontrola importu">
      {document.sheets.some(s=>s.role==='unknown')&&<div className="tf-budget-validation has-errors"><strong>Některé listy nebyly rozpoznány</strong><p>Úplnost rozpočtu zatím nelze ověřit. Tyto listy se do položek nezařadí. Zkontrolujte je v originálu nebo nastavte jejich mapování.</p>{document.sheets.filter(s=>s.role==='unknown').map(s=><button key={s.id} onClick={()=>{setMappingSheet(s.name);setMappingOpen(true);}}>Zkontrolovat {s.name}</button>)}</div>}
      <details className="tf-budget-import-details" open={mappingOpen} onToggle={e=>setMappingOpen(e.currentTarget.open)}><summary>Pokročilé mapování sloupců</summary><ThemedNativeSelect aria-label="Mapování listu" value={mappingSheet} onChange={e=>setMappingSheet(e.target.value)}><option value="">Vyberte list</option>{document.sheets.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</ThemedNativeSelect>{mappingSheet&&(()=>{const s=document.sheets.find(s=>s.name===mappingSheet)!;const m=mapping[mappingSheet]||{};const change=(update:typeof m)=>setMapping({...mapping,[mappingSheet]:{...m,...update}});return <div className="flex flex-col gap-2"><label>Role listu<ThemedNativeSelect value={m.role??s.role} onChange={e=>change({role:e.target.value as typeof s.role})}>{(['items','summary','figures','instructions','unknown'] as const).map(role=><option key={role} value={role}>{{items:'Položky rozpočtu',summary:'Rekapitulace',figures:'Seznam figur',instructions:'Pokyny',unknown:'Nerozpoznaný list'}[role]}</option>)}</ThemedNativeSelect></label><label>Řádek hlavičky<input type="number" min={1} value={m.headerRow??s.headerRow} onChange={e=>change({headerRow:Number(e.target.value)})}/></label><label>Objekt<input value={m.object??s.object} onChange={e=>change({object:e.target.value})}/></label><label>Název soupisu<input value={m.title??s.title} onChange={e=>change({title:e.target.value})}/></label>{['kind','code','description','unit','quantity','unitPrice','total'].map((key,i)=><label key={key}>{['Typ','Kód','Popis','MJ','Množství','J. cena','Celkem'][i]} · číslo sloupce (A = 1)<input type="number" min={1} max={512} value={(m.columns?.[key]??s.columns?.[key]??0)+1} onChange={e=>change({columns:{...s.columns,...m.columns,[key]:Number(e.target.value)-1}})}/></label>)}</div>;})()}<button disabled={busy} onClick={()=>void start()}>Znovu rozpoznat s tímto mapováním</button></details>
      <div className={`tf-budget-validation ${errorCount?'has-errors':''}`}>
        <strong>{!selectedSheets?'Vyberte alespoň jeden soupis':errorCount?'Lze uložit pracovní rozpočet, potvrzení je blokované':'Import lze dokončit'}</strong>
        <p>{selectedSheets===itemSheets.length&&selectedSheets?'Všechny rozpoznané soupisy jsou vybrané.':`Vybráno ${selectedSheets} z ${itemSheets.length} soupisů. Ostatní se do této verze nezařadí.`} {errorCount?`${errorCount} chyb vyžaduje opravu před potvrzením.`:'Ve vybraných soupisech nejsou blokující chyby.'}</p>
        {!!issues.length&&<details className="tf-budget-import-details"><summary>Co zkontrolovat <span>{errorCount} chyb · {issues.filter(i=>i.severity==='warning').length} upozornění</span></summary><div className="tf-budget-issue-list">{issues.map((i,index)=><div key={index} className="tf-budget-issue"><strong>{i.kind==='ambiguous-figures'?'Více hodnot pro stejnou figuru':i.severity==='error'?'Chyba v položce':'Upozornění'}</strong><small>{i.sheet}, řádek {i.row}</small><p>{i.message}</p>{i.kind==='ambiguous-figures'?<><p><strong>Import ani potvrzení to neblokuje.</strong> Před přepočtem výkazu výměr porovnejte uvedené figury v originálním XLSX. Aplikace žádnou z hodnot sama nevybere.</p>{i.figures&&<details><summary>Zobrazit figury ke kontrole ({i.figures.length})</summary><ul>{i.figures.map(f=><li key={f.code}><strong>{f.code}</strong>: {f.values.join(' / ')}</li>)}</ul></details>}</>:i.severity==='error'?<><p>Prověřte hodnoty na uvedeném řádku nebo upravte mapování sloupců. Do opravy zůstane rozpočet pracovní.</p><button onClick={()=>{setMappingSheet(i.sheet);setMappingOpen(true);}}>Zkontrolovat mapování listu</button></>:null}</div>)}</div><button disabled={!source||busy} onClick={()=>void downloadOriginal()}>Stáhnout originál ke kontrole</button></details>}
      </div>
      {previous&&<details><summary>Porovnání s {previous.title}: {differences.length} rozdílů</summary><p>Nová verze zachovává historii předchozí. Štítky a alokace se nepřenášejí bez ověření identity.</p><div className="max-h-40 overflow-auto">{differences.map((d,i)=><p key={i}>{d.status}: {(d.after??d.before)?.code} · {(d.after??d.before)?.description}</p>)}</div></details>}
      {previous&&<details><summary>Přenos štítků a alokací z předchozí verze</summary><label><input type="checkbox" checked={transfer} onChange={e=>setTransfer(e.target.checked)}/>Přenést ověřené vazby</label><p>Historické vazby předchozí verze zůstanou zachované. Nepřiřazené vazby se do nové verze nepřenesou. Změna jednotky nebo přealokace přenos zablokuje.</p>{transfer&&<div className="max-h-64 overflow-auto">{previous.document.nodes.filter(n=>n.tags.length||previous.allocations.some(a=>a.itemId===n.id)).map(n=><label key={n.id} className="block">{n.code} · {n.description}<ThemedNativeSelect value={links[n.id]||''} onChange={e=>{const updated={...links};if(e.target.value)updated[n.id]=e.target.value;else delete updated[n.id];setLinks(updated);}}><option value="">Nepřenášet (ponechat jen v historii)</option>{document.nodes.filter(item=>(item.kind==='K'||item.kind==='M')&&item.unit===n.unit).map(item=><option key={item.id} value={item.id}>{item.source.sheet}:{item.source.row} · {item.code} · {item.description}</option>)}</ThemedNativeSelect></label>)}</div>}</details>}

      </aside>
    </div>}
  </div></Modal>;
}
