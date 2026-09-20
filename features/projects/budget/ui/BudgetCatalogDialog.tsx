import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Plus, RotateCcw, Tags } from 'lucide-react';
import { Modal } from '@shared/ui/Modal';
import { ThemedNativeSelect } from '@shared/ui/ThemedNativeSelect';
import { budgetApi } from '../api/budgetApi';
import type { BudgetCatalogEntry } from '../model/types';

const kinds = {
  tag: { label: 'Štítky', field: 'Název štítku', example: 'Např. K prověření', add: 'Přidat štítek', empty: 'Zatím žádné štítky', help: 'Štítky přiřadíte vybraným položkám rozpočtu.' },
  profession: { label: 'Profese', field: 'Název profese', example: 'Např. Elektroinstalace', add: 'Přidat profesi', empty: 'Zatím žádné profese', help: 'Společný seznam profesí pro vaši organizaci.' },
  unit: { label: 'Jednotky', field: 'Název jednotky', example: 'Např. m² nebo ks', add: 'Přidat jednotku', empty: 'Zatím žádné jednotky', help: 'Přidání jednotky nemění údaje z importovaných souborů.' },
  type: { label: 'Typy položek', field: 'Název typu', example: 'Např. Montážní práce', add: 'Přidat typ', empty: 'Zatím žádné typy položek', help: 'Vlastní názvy typů. Původní typy KROS zůstávají zachované.' },
} as const;
interface Props { organizationId?: string; userId?: string; readOnly?: boolean; onClose: () => void }
export function BudgetCatalogDialog({ organizationId, userId, readOnly = false, onClose }: Props) {
  const cache = useQueryClient();
  const queryKey = ['budget-catalog', organizationId, userId];
  const catalog = useQuery({ queryKey, queryFn: () => budgetApi.catalog(organizationId!), enabled: !!organizationId });
  const access = useQuery({ queryKey: ['budget-catalog-access', organizationId, userId], queryFn: () => budgetApi.canManageCatalog(organizationId!), enabled: !!organizationId });
  const [kind, setKind] = useState<BudgetCatalogEntry['kind']>('tag');
  const [name, setName] = useState('');
  const [archived, setArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canManage = access.data === true && !readOnly;
  const meta = kinds[kind];
  const entries = (catalog.data ?? []).filter(entry => entry.kind === kind);
  const visible = entries.filter(entry => entry.archived === archived);
  const duplicate = entries.some(entry => entry.name.trim().toLocaleLowerCase('cs') === name.trim().toLocaleLowerCase('cs'));
  const mutate = async (entry: Omit<BudgetCatalogEntry, 'id'> & { id?: string }) => {
    if (lock.current || !canManage) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await budgetApi.saveCatalog(entry);
      if (!entry.id) setName('');
      await cache.invalidateQueries({ queryKey });
      setNotice(entry.id ? (entry.archived ? 'Záznam archivován. Již přiřazené hodnoty zůstávají zachované.' : 'Záznam obnoven.') : 'Záznam přidán.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Změnu se nepodařilo uložit. Zkuste to znovu.');
    } finally { lock.current = false; setBusy(false); }
  };
  return <Modal isOpen title="Firemní číselníky" description="Společné hodnoty pro rozpočty vaší organizace." size="lg" persistent={busy} onClose={onClose}>
    <div className="tf-budget-controls tf-budget-catalog">
      {!organizationId ? <p role="status">Číselníky jsou dostupné pro stavby přiřazené organizaci.</p> : <>
        <label className="tf-budget-field">Číselník<ThemedNativeSelect value={kind} disabled={busy} onChange={e => { setKind(e.target.value as BudgetCatalogEntry['kind']); setName(''); setError(''); setNotice(''); setArchived(false); }}>
          {Object.entries(kinds).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
        </ThemedNativeSelect></label>
        <p className="tf-budget-muted">{meta.help}</p>
        {(catalog.isPending || access.isPending) && <p role="status">Načítání číselníku a oprávnění…</p>}
        {(catalog.error || access.error) && <div role="alert" className="tf-budget-error">Číselník se nepodařilo načíst. <button onClick={() => { void catalog.refetch(); void access.refetch(); }}>Zkusit znovu</button></div>}
        {canManage && <form className="tf-budget-catalog-form" onSubmit={e => { e.preventDefault(); if (name.trim() && !duplicate) void mutate({ organization_id: organizationId, kind, name: name.trim(), color: '#64748b', archived: false }); }}>
          <label className="tf-budget-field">{meta.field}<input value={name} maxLength={100} placeholder={meta.example} disabled={busy} onChange={e => setName(e.target.value)} /></label>
          <button type="submit" className="tf-budget-import-primary" disabled={busy || !name.trim() || duplicate}><Plus size={14} />{busy ? 'Ukládání…' : meta.add}</button>
          {duplicate && <p className="tf-budget-muted">Tento název již existuje{entries.find(entry => entry.name.trim().toLocaleLowerCase('cs') === name.trim().toLocaleLowerCase('cs'))?.archived ? ' v archivu. Můžete jej obnovit' : ''}.</p>}
        </form>}
        {access.isSuccess && !canManage && <p className="tf-budget-muted">Číselník můžete prohlížet. Změny provádí vlastník nebo administrátor organizace.</p>}
        {error && <p role="alert" className="tf-budget-error">{error}</p>}
        {notice && <p role="status" className="tf-budget-notice">{notice}</p>}
        <div className="tf-budget-catalog-tabs" role="group" aria-label="Stav záznamů">
          <button aria-pressed={!archived} onClick={() => setArchived(false)}>Aktivní · {entries.filter(entry => !entry.archived).length}</button>
          <button aria-pressed={archived} onClick={() => setArchived(true)}>Archiv · {entries.filter(entry => entry.archived).length}</button>
        </div>
        {catalog.isSuccess && <ul className="tf-budget-catalog-list" aria-label={archived ? 'Archivované záznamy' : 'Aktivní záznamy'}>
          {visible.map(entry => <li key={entry.id}><span>{entry.name}</span>{canManage && <button disabled={busy} aria-label={`${entry.archived ? 'Obnovit' : 'Archivovat'} ${entry.name}`} onClick={() => void mutate({ ...entry, archived: !entry.archived })}>{entry.archived ? <RotateCcw size={14} /> : <Archive size={14} />}{entry.archived ? 'Obnovit' : 'Archivovat'}</button>}</li>)}
          {!visible.length && <li className="tf-budget-empty"><Tags size={24} /><strong>{archived ? 'Archiv je prázdný' : meta.empty}</strong><span>{archived ? 'Archivace zachová hodnoty přiřazené položkám.' : canManage ? 'První záznam přidejte pomocí pole výše.' : 'Záznamy zde zobrazíme po jejich přidání správcem.'}</span></li>}
        </ul>}
      </>}
    </div>
  </Modal>;
}
