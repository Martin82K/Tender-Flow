import React, { useEffect, useMemo, useState } from 'react';
import type { ContractWithDetails } from '@/types';
import { ContractsHeadline } from './ContractsHeadline';
import { ContractListPanel } from './ContractListPanel';
import { ContractsTable } from './ContractsTable';
import { ContractWorkspace } from '../workspace/ContractWorkspace';
import { ContractEditDialog } from '../forms/ContractEditDialog';

type ViewMode = 'split' | 'table';

interface Props {
  projectId: string;
  contracts: ContractWithDetails[];
  refresh: () => Promise<void> | void;
}

export const ContractsListPage: React.FC<Props> = ({ projectId, contracts, refresh }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editContract, setEditContract] = useState<ContractWithDetails | null>(null);

  useEffect(() => {
    if (!selectedId && contracts.length > 0) {
      setSelectedId(contracts[0].id);
    } else if (selectedId && !contracts.some((c) => c.id === selectedId)) {
      setSelectedId(contracts[0]?.id || null);
    }
  }, [contracts, selectedId]);

  const selected = useMemo(
    () => contracts.find((c) => c.id === selectedId) || null,
    [contracts, selectedId],
  );

  const openCreate = () => {
    setEditContract(null);
    setEditOpen(true);
  };

  const openEdit = () => {
    if (selected) {
      setEditContract(selected);
      setEditOpen(true);
    }
  };

  const handleTableSelect = (id: string) => {
    setSelectedId(id);
    setViewMode('split');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ContractsHeadline contracts={contracts} />

      <div className="flex items-center gap-3 px-5 py-3">
        <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900/60 p-1">
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`px-3 py-1.5 text-xs rounded-md font-semibold transition ${
              viewMode === 'split'
                ? 'bg-primary/15 text-primary'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            ◫ Split
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 text-xs rounded-md font-semibold transition ${
              viewMode === 'table'
                ? 'bg-primary/15 text-primary'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            ▦ Tabulka
          </button>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={openCreate}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-primary/40 text-primary hover:bg-primary/10 hover:border-primary transition"
        >
          + Nová smlouva
        </button>
      </div>

      <div className="flex-1 min-h-0 px-5 pb-5">
        {contracts.length === 0 ? (
          <div className="h-full rounded-xl border border-dashed border-slate-800 grid place-items-center text-sm text-slate-500">
            Zatím nemáte žádné smlouvy. Klikněte na „+ Nová smlouva“ pro založení první.
          </div>
        ) : viewMode === 'split' ? (
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-3 h-full min-h-[560px]">
            <ContractListPanel
              contracts={contracts}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            {selected ? (
              <ContractWorkspace
                contract={selected}
                onEditContract={openEdit}
                onRefresh={refresh}
              />
            ) : (
              <div className="rounded-xl border border-slate-800 grid place-items-center text-sm text-slate-500">
                Vyberte smlouvu v levém panelu.
              </div>
            )}
          </div>
        ) : (
          <ContractsTable contracts={contracts} onSelect={handleTableSelect} />
        )}
      </div>

      {editOpen && (
        <ContractEditDialog
          projectId={projectId}
          contract={editContract}
          onClose={() => setEditOpen(false)}
          onSaved={async () => {
            setEditOpen(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
};
