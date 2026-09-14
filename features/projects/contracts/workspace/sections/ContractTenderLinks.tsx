import React, { useState } from 'react';
import type { ContractWithDetails, ProjectDetails } from '@/types';
import { Button } from '@shared/ui/Button';
import { ThemedNativeSelect } from '@shared/ui/ThemedNativeSelect';
import { contractMutationsApi } from '../../api/contractMutationsApi';
import { findContractLinkedBids } from '../../model/contractSourceBid';

interface Props {
  contract: ContractWithDetails;
  contracts: ContractWithDetails[];
  project?: ProjectDetails;
  onRefresh: () => Promise<void> | void;
  onOpenBid?: (categoryId: string, bidId?: string) => void;
}

export const ContractTenderLinks: React.FC<Props> = ({ contract, contracts, project, onRefresh, onOpenBid }) => {
  const [selected, setSelected] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const links = findContractLinkedBids(contract, project);
  const occupied = new Set(contracts.flatMap(item => findContractLinkedBids(item, project).map(link => link.categoryId)));
  const available = project?.id === contract.projectId ? (project.categories || []).flatMap(category =>
    occupied.has(category.id) ? [] : (project.bids?.[category.id] || []).map(bid => ({
      id: bid.id, label: `${category.title} · ${bid.companyName}`,
    }))) : [];
  const save = async (bidId: string, unlink: boolean) => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      if (unlink) await contractMutationsApi.unlinkContractFromBid(contract.projectId, contract.id, bidId);
      else await contractMutationsApi.linkContractToBid(contract.projectId, contract.id, bidId);
      setSelected(''); setRemoving(null);
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Vazbu se nepodařilo uložit.');
    } finally { setBusy(false); }
  };
  return <section aria-label="Propojená výběrová řízení" className="py-4 border-b border-dashed border-slate-200 dark:border-slate-800 text-xs">
    <h3 className="font-semibold mb-2">Výběrová řízení ({links.length})</h3>
    {links.map(link => <div key={link.bidId} className="flex flex-wrap items-center gap-2 py-1">
      <Button type="button" variant="ghost" size="sm" disabled={!onOpenBid || busy} onClick={() => onOpenBid?.(link.categoryId, link.bidId)}>{link.title}</Button>
      <Button type="button" variant="ghost" size="sm" disabled={busy} aria-label={`Odpojit ${link.title}`} onClick={() => setRemoving(link.bidId)}>Odpojit</Button>
      {removing === link.bidId && <div className="flex flex-wrap items-center gap-2">
        <span>Odpojit pouze toto VŘ? Smlouva i ostatní vazby zůstanou.</span>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void save(link.bidId, true)}>Potvrdit odpojení</Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setRemoving(null)}>Zrušit</Button>
      </div>}
    </div>)}
    {links.length === 0 && <p className="mb-2">Smlouva nemá propojené VŘ.</p>}
    <div className="flex flex-wrap items-center gap-2 mt-2">
      <ThemedNativeSelect searchable wrapOptions aria-label="Přidat výběrové řízení" value={selected} disabled={busy} onChange={event => setSelected(event.target.value)}>
        <option value="">Vyberte VŘ a nabídku dodavatele</option>
        {available.map(bid => <option key={bid.id} value={bid.id}>{bid.label}</option>)}
      </ThemedNativeSelect>
      <Button type="button" variant="outline" size="sm" disabled={busy || !available.some(bid => bid.id === selected)} onClick={() => void save(selected, false)}>Propojit VŘ</Button>
    </div>
    {error && <p role="alert" className="mt-2">{error}</p>}
  </section>;
};
