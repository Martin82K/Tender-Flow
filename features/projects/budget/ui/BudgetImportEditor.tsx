import React, { useMemo, useState } from 'react';
import { BudgetTable, DEFAULT_COLUMNS } from './BudgetTable';
import type { BudgetColumn } from './BudgetTable';
import { BudgetSelectionTenders } from './BudgetRowTenders';
import type { BudgetRowTenderProps } from './BudgetRowTenders';
import { applyBudgetItemEdit, syncWholeItemQuantity, validateRevisionAllocations } from '../model/revisions';
import { ThemedNativeSelect } from '@shared/ui/ThemedNativeSelect';
import { aggregateBudget } from '../model/budgetTree';
import type { BudgetFilters } from '../model/budgetModel';
import { formatBudgetNumber, normalizeSearch, sumMoney } from '../model/budgetModel';
import { applyImportRepair, importNodePath, importRepairParents, previewImportRepair, sourceColumnName } from '../model/importRepair';
import type { ImportRepair } from '../model/importRepair';
import type { KrosMapping } from '../model/krosImport';
import type { BudgetAllocation, BudgetDocument, BudgetNode, BudgetSheet } from '../model/types';

interface Props extends BudgetRowTenderProps {

  allocations?: readonly BudgetAllocation[];
  document: BudgetDocument; onChange: (document: BudgetDocument) => void;
  mapping: KrosMapping; onMapping: (mapping: KrosMapping) => void;
  onRemap: (sheet: string) => Promise<boolean>; onBack: () => void;
  onLoadPreview?: () => Promise<void>;
  initialSheet?: string; initialRow?: number; busy: boolean; savedRevision?: boolean;
}
const fields = [['kind','Typ řádku'],['code','Kód'],['description','Popis'],['unit','Měrná jednotka'],['quantity','Množství'],['unitPrice','Jednotková cena'],['total','Cena celkem'],['depth','Úroveň hierarchie']] as const;
const kinds: Record<ImportRepair['kind'],string> = {section:'Oddíl / pododdíl',K:'Položka práce',M:'Materiál',VV:'Výkaz výměr',note:'Poznámka / hlavička',subtotal:'Mezisoučet'};
const PAGE_SIZE = 100;

export function BudgetImportEditor({allocations,document,onChange,mapping,onMapping,onRemap,onBack,onLoadPreview,initialSheet,initialRow,busy,savedRevision=false,...tenderProps}:Props) {
  const [step,setStep] = useState<'items'|'columns'|'structure'|'review'>(initialRow?'structure':'columns');
  const [tableFilters,setTableFilters]=useState<BudgetFilters>({});
  const [tableColumns,setTableColumns]=useState<BudgetColumn[]>(DEFAULT_COLUMNS);
  const [selection,setSelection]=useState(new Set<string>());
  const [sheetId,setSheetId] = useState(document.sheets.find(s=>s.name===initialSheet)?.id??document.sheets.find(s=>s.selected&&s.role==='items')?.id??document.sheets[0]?.id??'');
  const [selectedId,setSelectedId] = useState(document.nodes.find(n=>n.source.sheet===initialSheet&&n.source.row===initialRow)?.id??'');
  const [draft,setDraft] = useState<ImportRepair|null>(null);
  const [undo,setUndo] = useState<BudgetDocument|null>(null); const [message,setMessage] = useState('');
  const [search,setSearch] = useState(''); const [onlyIssues,setOnlyIssues] = useState(false); const [page,setPage] = useState(0);
  const [replaceRepairs,setReplaceRepairs] = useState(false);
  const sheet = document.sheets.find(s=>s.id===sheetId);
  const byId = useMemo(()=>new Map(document.nodes.map(n=>[n.id,n])),[document.nodes]);
  const selected = byId.get(selectedId);
  const issues = document.issues.filter(i=>i.sheet===sheet?.name);
  const problemRows = useMemo(()=>new Set(issues.map(i=>i.row)),[document.issues,sheet?.name]);
  const rows = useMemo(()=>document.nodes.filter(n=>n.sheetId===sheetId&&n.source.row>0&&(!onlyIssues||problemRows.has(n.source.row))&&normalizeSearch(`${n.code} ${n.description} ${n.source.row}`).includes(normalizeSearch(search))),[document.nodes,sheetId,onlyIssues,problemRows,search]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length/PAGE_SIZE)-1));
  const currentRows = rows.slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE);
  const edit = draft ?? (selected&&selected.kind!=='sheet'&&selected.kind!=='object'?{nodeId:selected.id,parentId:selected.parentId??sheetId,kind:selected.kind,scope:'subtree' as const}:null);
  const preview = useMemo(()=>{
    if(!edit)return null;
    try{
      const result=previewImportRepair(document,edit,allocations);
      const affected=new Set(edit.scope==='subtree'?result.descendants.map(n=>n.id):[edit.nodeId]);
      const after=applyImportRepair(document,edit,allocations).nodes.filter(n=>affected.has(n.id)&&(n.kind==='K'||n.kind==='M'));
      return {result:{...result,totalAfter:sumMoney(after.map(n=>n.total)),incompleteAfter:after.some(n=>n.total===null)},error:''};
    }catch(e){return {result:null,error:e instanceof Error?e.message:'Neplatná oprava.'};}
  },[document,allocations,edit?.nodeId,edit?.parentId,edit?.kind,edit?.scope]);
  const parents = useMemo(()=>edit?importRepairParents(document,edit.nodeId,edit.kind):[],[document,edit?.nodeId,edit?.kind]);
  const totals = useMemo(()=>aggregateBudget(document.nodes),[document.nodes]);
  const m = sheet && Object.hasOwn(mapping,sheet.name)?mapping[sheet.name]:{};
  const hasRepairs = document.importRepairs?.some(r=>byId.get(r.nodeId)?.sheetId===sheetId)??false;
  const mustReplace = hasRepairs || savedRevision;
  const changeMapping = (update:typeof m)=>sheet&&onMapping({...mapping,[sheet.name]:{...m,format:m.format??sheet.format,...update}});
  const choose = (node:BudgetNode)=>{setSelectedId(node.id);setDraft(null);setMessage('');};
  const chooseSheet = (id:string)=>{setSheetId(id);setSelectedId('');setDraft(null);setPage(0);setReplaceRepairs(false);setMessage('');};
  const update = (value:Partial<ImportRepair>)=>edit&&setDraft({...edit,...value});
  const openIssue = (name:string,row:number)=>{const target=document.sheets.find(s=>s.name===name);if(target)chooseSheet(target.id);const node=document.nodes.find(n=>n.source.sheet===name&&n.source.row===row);setSelectedId(node?.id??'');setStep(node?'structure':'columns');setOnlyIssues(true);};
  const columns = Array.from({length:sheet?.sourcePreview?.columnCount??Math.max(8,...Object.values(sheet?.columns??{}).map(v=>v+1))},(_,i)=>i);
  const header = sheet?.sourcePreview?.rows.find(r=>r.row===(m.headerRow??sheet?.headerRow));
  const selectLabel = (column:number)=>`${sourceColumnName(column)}${header?.cells[column]?.value?` · ${header.cells[column].value}`:''}`;
  const selectedIssues = document.issues.filter(issue=>document.sheets.some(s=>s.name===issue.sheet&&s.selected&&s.role==='items'));

  return <section className="tf-budget-import-editor" aria-label="Editor importu">
    <div className="tf-budget-editor-toolbar"><button disabled={busy} onClick={onBack}>Zpět na listy</button><ThemedNativeSelect aria-label="List v editoru" value={sheetId} disabled={busy} onChange={e=>chooseSheet(e.target.value)}>{document.sheets.map(s=><option key={s.id} value={s.id}>{s.name} · {s.title}</option>)}</ThemedNativeSelect><span className="tf-budget-import-muted">Originální soubor zůstává beze změny.</span></div>
    <nav className="tf-budget-editor-steps" aria-label="Kroky opravy importu">{([['items','Položky a VŘ'],['columns','1 · Sloupce'],['structure','2 · Struktura'],['review','3 · Kontrola']] as const).map(([id,label])=><button key={id} aria-current={step===id?'step':undefined} disabled={busy} onClick={()=>setStep(id)}>{label}</button>)}</nav>
    {step==='items'&&<div className="tf-budget tf-budget-editor-items">{!!selection.size&&tenderProps.onAllocateSelection&&<BudgetSelectionTenders itemIds={[...selection]} categories={tenderProps.categories} disabled={busy||!tenderProps.canAllocate} onCreateTender={tenderProps.onCreateTender} onAssign={id=>tenderProps.onAllocateSelection!([...selection],id)} onRemove={allocations?.some(a=>selection.has(a.itemId))&&tenderProps.onRemoveSelection?()=>tenderProps.onRemoveSelection!([...selection]):undefined} onClose={()=>setSelection(new Set())}/>}<BudgetTable {...tenderProps} allocations={allocations} nodes={document.nodes.map(n=>({...n,tenders:[...new Set((allocations??[]).filter(a=>a.itemId===n.id).map(a=>tenderProps.categories?.find(c=>c.id===a.categoryId)?.title??'Nedostupné VŘ'))]}))} scope={sheetId} filters={tableFilters} onFilters={setTableFilters} selected={selection} onSelected={setSelection} showVV={false} wrap={false} density={44} columns={tableColumns} onColumns={setTableColumns} canPrices editable={!busy} onNotice={setMessage} onEdit={async(edited,fields)=>{
      const original=document.nodes.find(n=>n.id===edited.id);
      if(original?.unit!==edited.unit&&allocations?.some(a=>a.itemId===edited.id))throw new Error('Měrnou jednotku přiřazené položky nelze změnit. Nejdříve zrušte její přiřazení do VŘ.');
      const next=applyBudgetItemEdit(document,edited,fields);validateRevisionAllocations(next,syncWholeItemQuantity(document,next,allocations??[],!!tenderProps.canAllocate));setUndo(document);onChange(next);
    }}/>{message&&<p role="status">{message}</p>}</div>}
    {step==='columns'&&sheet&&<div className="tf-budget-editor-layout">
      <section className="tf-budget-editor-source" aria-label="Původní buňky"><h3>Náhled zdrojového listu</h3><p className="tf-budget-import-muted">{sheet.sourcePreview?.rowCount??'—'} řádků · písmena označují skutečné sloupce XLSX. Zobrazeno nejvýše 60 řádků okolo hlavičky.</p>
        {sheet.sourcePreview?.truncated&&<p role="status">Dlouhé texty náhledu jsou zkrácené kvůli velikosti sešitu. Původní hodnoty zůstávají zachované.</p>}
        <div className="tf-budget-editor-scroll"><table><thead><tr><th>Řádek</th>{columns.map(c=><th key={c}>{sourceColumnName(c)}</th>)}</tr></thead><tbody>{sheet.sourcePreview?.rows.map(row=><tr key={row.row} className={row.row===(m.headerRow??sheet.headerRow)?'is-selected':''}><th>{row.row}</th>{columns.map(c=><td key={c} title={row.cells[c]?.formula?`Vzorec: ${row.cells[c].formula} (nespouští se)`:undefined}>{String(row.cells[c]?.value??'')}</td>)}</tr>)}</tbody></table></div>
        {!sheet.sourcePreview&&<><p>Náhled buněk se načítá z chráněného originálu. Uložené opravy zůstanou zachované.</p>{onLoadPreview&&<button disabled={busy} onClick={()=>void onLoadPreview()}>Načíst náhled originálu</button>}</>}
      </section>
      <aside className="tf-budget-editor-detail" aria-label="Mapování sloupců"><h3>Mapování sloupců</h3><p className="tf-budget-import-muted">Změna platí pro vybraný list.</p>
        <label className="tf-budget-mapping-row"><span>Formát listu</span><ThemedNativeSelect className="w-full" aria-label="Formát listu v editoru" value={m.format??sheet.format??'auto'} disabled={busy} onChange={e=>changeMapping({format:e.target.value as typeof m.format})}><option value="auto">Automaticky</option><option value="kros">KROS</option><option value="globus">Globus</option></ThemedNativeSelect></label>
        <label className="tf-budget-mapping-row"><span>Role listu</span><ThemedNativeSelect className="w-full" aria-label="Role listu v editoru" value={m.role??sheet.role} disabled={busy} onChange={e=>changeMapping({role:e.target.value as BudgetSheet['role']})}>{Object.entries({items:'Položky rozpočtu',summary:'Rekapitulace',figures:'Figury',instructions:'Pokyny',unknown:'Nerozpoznaný'}).map(([id,label])=><option key={id} value={id}>{label}</option>)}</ThemedNativeSelect></label>
        <label className="tf-budget-mapping-row"><span>Řádek hlavičky</span><input aria-label="Řádek hlavičky v editoru" disabled={busy} type="number" min={1} max={sheet.sourcePreview?.rowCount??250000} value={m.headerRow??sheet.headerRow} onChange={e=>changeMapping({headerRow:Number(e.target.value)})}/></label>
        {fields.map(([key,label])=><label className="tf-budget-mapping-row" key={key}><span>{label}</span><ThemedNativeSelect className="w-full" aria-label={label} disabled={busy} value={m.columns?.[key]??sheet.columns?.[key]??(key==='depth'?-2:-1)} onChange={e=>{const values={...sheet.columns,...m.columns};if(Number(e.target.value)===-2)delete values[key];else values[key]=Number(e.target.value);changeMapping({columns:values});}}><option value={-1}>{key==='depth'?'Bez úrovně — ruční kontrola':['unitPrice','total'].includes(key)?'Bez cenového sloupce':'Zvolit sloupec'}</option>{key==='depth'&&<option value={-2}>Podle profilu (KROS: AU)</option>}{columns.map(c=><option key={c} value={c}>{selectLabel(c)}</option>)}</ThemedNativeSelect></label>)}
        <p className="tf-budget-import-muted">Úrovně začínají 0. Chybějící nebo přeskočené úrovně ověříte v kroku Struktura.</p>
        {mustReplace&&<label><input type="checkbox" disabled={busy} checked={replaceRepairs} onChange={e=>setReplaceRepairs(e.target.checked)}/>Znovu rozpoznat tento list a nahradit jeho ruční úpravy</label>}
        {savedRevision&&<p className="tf-budget-import-muted">Nové rozpoznání načte hodnoty z originálu a nahradí také pozdější úpravy cen a množství tohoto listu.</p>}
        <button disabled={busy||(mustReplace&&!replaceRepairs)} onClick={async()=>{if(await onRemap(sheet.name)){setUndo(null);setReplaceRepairs(false);setSelectedId('');setDraft(null);}}}>Použít mapování</button>
      </aside>
    </div>}
    {step==='structure'&&sheet&&<div className="tf-budget-editor-layout">
      <section className="tf-budget-editor-source" aria-label="Struktura rozpočtu"><div className="tf-budget-editor-toolbar"><input aria-label="Hledat řádek" placeholder="Kód, popis nebo číslo řádku…" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/><label><input type="checkbox" checked={onlyIssues} onChange={e=>{setOnlyIssues(e.target.checked);setPage(0);}}/>Jen k ověření</label></div>
        <div className="tf-budget-editor-scroll"><table><thead><tr><th>Řádek</th><th>Typ</th><th>Kód a popis</th><th>Nadřazený oddíl</th><th>Celkem</th></tr></thead><tbody>{currentRows.map(node=><tr key={node.id} className={node.id===selectedId?'is-selected':''}><td>{node.source.row}{problemRows.has(node.source.row)&&<span title="Vyžaduje kontrolu"> ⚠</span>}</td><td>{node.sourceType||'?'}</td><td><button aria-label={`Upravit řádek ${node.source.row}`} onClick={()=>choose(node)}>{node.code} · {node.description||'Bez popisu'}</button></td><td title={importNodePath(node.parentId,byId)}>{byId.get(node.parentId??'')?.description??'—'}</td><td>{node.total===null?'—':formatBudgetNumber(node.total,true)}</td></tr>)}</tbody></table></div>
        {!rows.length&&<p>Žádné řádky. U nerozpoznaného listu nejprve nastavte sloupce.</p>}
        <div className="tf-budget-editor-toolbar"><button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Předchozí řádky</button><span>{rows.length?currentPage*PAGE_SIZE+1:0}–{Math.min((currentPage+1)*PAGE_SIZE,rows.length)} z {rows.length}</span><button disabled={(currentPage+1)*PAGE_SIZE>=rows.length} onClick={()=>setPage(currentPage+1)}>Další řádky</button></div>
      </section>
      <aside className="tf-budget-editor-detail" aria-label="Oprava struktury"><h3>{selected?`Řádek ${selected.source.row} · ${selected.code}`:'Vyberte řádek k opravě'}</h3>{selected&&edit&&<>
        <p>{selected.description}</p>{issues.filter(i=>i.row===selected.source.row).map((i,index)=><p className="tf-budget-error" key={index}>{i.message}</p>)}
        <label className="tf-budget-mapping-row"><span>Typ řádku</span><ThemedNativeSelect className="w-full" aria-label="Nový typ řádku" value={edit.kind} disabled={busy} onChange={e=>{const kind=e.target.value as ImportRepair['kind'];const candidates=importRepairParents(document,edit.nodeId,kind);update({kind,parentId:candidates.some(n=>n.id===edit.parentId)?edit.parentId:sheetId});}}>{Object.entries(kinds).map(([id,label])=><option key={id} value={id}>{label}</option>)}</ThemedNativeSelect></label>
        <label><span>Nadřazený uzel</span><ThemedNativeSelect className="w-full" aria-label="Nadřazený uzel" value={edit.parentId} disabled={busy} onChange={e=>update({parentId:e.target.value})}>{parents.map(parent=><option key={parent.id} value={parent.id}>{importNodePath(parent.id,byId)}{parent.source.row?` (ř. ${parent.source.row})`:''}</option>)}</ThemedNativeSelect></label>
        <label className="tf-budget-mapping-row"><span>Rozsah opravy</span><ThemedNativeSelect className="w-full" aria-label="Rozsah opravy" value={edit.scope} disabled={busy} onChange={e=>update({scope:e.target.value as ImportRepair['scope']})}><option value="subtree">Řádek a jeho podstrom</option><option value="row">Pouze tento řádek</option></ThemedNativeSelect></label>
        <div className="tf-budget-repair-preview"><strong>Náhled změny</strong><p>Před: {importNodePath(selected.parentId,byId)}</p><p>Po: {importNodePath(edit.parentId,byId)}</p>{preview?.result&&<><p>Řádky: {preview.result.rows.slice(0,20).join(', ')}{preview.result.count>20?'…':''} · {preview.result.count} řádků, {preview.result.items} položek.</p><p>Součet před opravou: {formatBudgetNumber(preview.result.total,true)} Kč{preview.result.incomplete?' (neúplné ocenění)':''}.</p><p>Po opravě: {formatBudgetNumber(preview.result.totalAfter,true)} Kč{preview.result.incompleteAfter?' (neúplné ocenění)':''}.</p></>}{edit.scope==='row'&&<p>Přímé děti zůstanou pod původním nadřazeným uzlem.</p>}{edit.kind!==selected.kind&&<p>Změna typu může změnit započtení do ceny. Částky se načtou z původních buněk.</p>}</div>
        {preview?.error&&<p role="alert" className="tf-budget-error">{preview.error}</p>}
        <button className="tf-budget-import-primary" disabled={busy||!!preview?.error} onClick={()=>{try{const next=applyImportRepair(document,edit,allocations);setUndo(document);onChange(next);setDraft(null);setMessage('Oprava použita. Uložte pracovní rozpočet.');}catch(e){setMessage(e instanceof Error?e.message:'Oprava selhala.');}}}>Použít opravu</button>
        <details><summary>Původní buňky řádku</summary><dl className="tf-budget-source-cells">{Object.entries(selected.source.cells).map(([address,cell])=><React.Fragment key={address}><dt>{address}</dt><dd>{String(cell.value??'')}{cell.formula&&<small>Vzorec: {cell.formula} (nespouští se)</small>}</dd></React.Fragment>)}</dl></details>
      </>}<button disabled={busy||!undo} onClick={()=>{if(undo){try{onChange(undo);setUndo(null);setDraft(null);setMessage('Poslední oprava vrácena.');}catch(e){setMessage(e instanceof Error?e.message:'Opravu nelze vrátit.');}}}}>Vrátit poslední opravu</button>{message&&<p role="status">{message}</p>}</aside>
    </div>}
    {step==='review'&&<section className="tf-budget-editor-detail" aria-label="Kontrola oprav"><h3>{selectedIssues.some(i=>i.severity==='error')?'Uložení pracovní verze je možné; potvrzení vyžaduje opravy':'Kontrola vybraných soupisů'}</h3><p>{document.sheets.filter(s=>s.selected&&s.role==='items').length} vybraných soupisů · {document.importRepairs?.length??0} ručních oprav.</p><p>Součet všech načtených položek: {formatBudgetNumber(totals.total,true)} Kč{totals.incomplete?' · ocenění není úplné':''}. Oddíly a mezisoučty se znovu nepřičítají.</p><p>Shoda částek sama nepotvrzuje správnou hierarchii.</p><div className="tf-budget-editor-issues">{selectedIssues.slice(0,100).map((issue,index)=><div key={index}><strong>{issue.sheet} · řádek {issue.row}</strong><p>{issue.message}</p><button onClick={()=>openIssue(issue.sheet,issue.row)}>Přejít na opravu</button></div>)}{selectedIssues.length>100&&<p>Další problémy zobrazíte filtrem Jen k ověření na příslušném listu.</p>}</div></section>}
  </section>;
}
