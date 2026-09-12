import React, { useState } from 'react';
import type { Bid, ContractWithDetails } from '@/types';
import { Button } from '@shared/ui/Button';
import { ThemedNativeSelect } from '@shared/ui/ThemedNativeSelect';

interface Props {
  projectId: string;
  bid: Bid;
  contracts: ContractWithDetails[];
  onOpenContract: (contractId: string) => void;
  onLinkContract?: (contractId: string, bidId: string) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export const BidContractLinks: React.FC<Props> = ({ projectId, bid, contracts, onOpenContract, onLinkContract, loading, error }) => {
  const [choosing, setChoosing] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [existingId, setExistingId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const scoped = contracts.filter(contract => contract.projectId === projectId);
  const linked = scoped.filter(contract => contract.sourceBidId === bid.id);
  const available = scoped.filter(contract => !contract.sourceBidId);
  const existing = available.find(contract => contract.id === existingId);
  const selected = linked.length === 1 ? linked[0] : linked.find(contract => contract.id === selectedId);

  const confirmLink = async () => {
    if (linked.length > 0 || saving || !onLinkContract || !available.some(contract => contract.id === existingId)) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onLinkContract(existingId, bid.id);
      setChoosing(false);
      setExistingId('');
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Propojení se nepodařilo uložit. Zkuste to znovu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 flex flex-col gap-1 text-xs" onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onDragStart={event => event.stopPropagation()}>
      {loading || error ? <span role={error ? 'alert' : 'status'}>{error ? 'Smlouvy se nepodařilo načíst.' : 'Načítám smlouvy…'}</span> : <>
        {linked.length > 1 && (
          <ThemedNativeSelect searchable wrapOptions menuMinWidth={480} aria-label="Propojená smlouva" value={selected?.id || ''} onChange={event => setSelectedId(event.target.value)} className="text-xs">
            <option value="">Vyberte smlouvu ({linked.length})</option>
            {linked.map(contract => <option key={contract.id} value={contract.id}>{contract.title} · {contract.vendorName}{contract.contractNumber ? ` · ${contract.contractNumber}` : ''}</option>)}
          </ThemedNativeSelect>
        )}
        {linked.length > 0 ? <Button type="button" variant="outline" size="sm" className="text-xs" disabled={!selected} onClick={() => selected && onOpenContract(selected.id)}>Otevřít ve Smlouvách</Button> : <span>Smlouva není propojena</span>}
        {linked.length === 0 && onLinkContract && !choosing && <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setChoosing(true)}>Propojit existující smlouvu</Button>}
        {linked.length === 0 && onLinkContract && choosing && <>
          <ThemedNativeSelect searchable wrapOptions menuMinWidth={480} aria-label="Existující smlouva" disabled={saving} value={existingId} onChange={event => { setExistingId(event.target.value); setSaveError(null); }} className="text-xs">
            <option value="">Vyberte smlouvu této stavby</option>
            {available.map(contract => <option key={contract.id} value={contract.id}>{contract.title} · {contract.vendorName}{contract.contractNumber ? ` · ${contract.contractNumber}` : ''}</option>)}
          </ThemedNativeSelect>
          {existing && <div role="region" aria-label="Vybraná smlouva" className="min-w-0 whitespace-normal [overflow-wrap:anywhere] text-xs">
            <div className="font-medium">{existing.title}</div>
            <div>{existing.vendorName}{existing.contractNumber ? ` · ${existing.contractNumber}` : ''}</div>
          </div>}
          {available.length === 0 && <span>Žádná nepropojená smlouva není k dispozici.</span>}
          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="outline" size="sm" className="text-xs" disabled={saving || !available.some(contract => contract.id === existingId)} onClick={() => void confirmLink()}>{saving ? 'Propojuji…' : 'Potvrdit propojení'}</Button>
            <Button type="button" variant="ghost" size="sm" className="text-xs" disabled={saving} onClick={() => { setChoosing(false); setSaveError(null); }}>Zrušit</Button>
          </div>
          {saveError && <span role="alert">{saveError}</span>}
        </>}
      </>}
    </div>
  );
};
