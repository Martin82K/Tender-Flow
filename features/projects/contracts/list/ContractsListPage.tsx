import React, { useEffect, useMemo, useState } from 'react';
import type { ContractWithDetails, ProjectDetails } from '@/types';
import { APP_VERSION } from '@/config/version';
import { useAuth } from '@/context/AuthContext';
import { exportContractTableToXlsx } from '@/services/exportService';
import { ContractsHeadline } from './ContractsHeadline';
import { ContractListPanel } from './ContractListPanel';
import { ContractFilters, type ContractFilterKey } from './ContractFilters';
import { ContractsTable } from './ContractsTable';
import { ContractWorkspace } from '../workspace/ContractWorkspace';
import { ContractEditDialog } from '../forms/ContractEditDialog';
import { contractQueriesApi } from '../api';
import { attachContractDocument } from '../utils/attachContractDocument';

export type ContractsViewMode = 'split' | 'table';

interface Props {
  projectId: string;
  projectDetails?: ProjectDetails;
  contracts: ContractWithDetails[];
  refresh: () => Promise<void> | void;
  viewMode: ContractsViewMode;
  onViewModeChange: (mode: ContractsViewMode) => void;
  initialSelectedId?: string;
}

export const ContractsListPage: React.FC<Props> = ({
  projectId,
  projectDetails,
  contracts,
  refresh,
  viewMode,
  onViewModeChange,
  initialSelectedId,
}) => {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editContract, setEditContract] = useState<ContractWithDetails | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [attachingDocumentId, setAttachingDocumentId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [filter, setFilter] = useState<ContractFilterKey>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (initialSelectedId && contracts.some((contract) => contract.id === initialSelectedId)) {
      setSelectedId(initialSelectedId);
      onViewModeChange('split');
    } else if (!selectedId && contracts.length > 0) {
      setSelectedId(contracts[0].id);
    } else if (selectedId && !contracts.some((c) => c.id === selectedId)) {
      setSelectedId(contracts[0]?.id || null);
    }
  }, [contracts, initialSelectedId, onViewModeChange, selectedId]);

  useEffect(() => {
    if (viewMode !== 'table') return;
    setFilter('all');
    setQuery('');
  }, [viewMode]);

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
    onViewModeChange('split');
  };

  const openDocument = async (contract: ContractWithDetails) => {
    setDocumentError(null);
    try {
      await contractQueriesApi.openContractDocument(contract);
    } catch (error) {
      setDocumentError(
        error instanceof Error ? error.message : 'Dokument smlouvy se nepodařilo otevřít.',
      );
    }
  };

  const handleAttachDocument = async (contract: ContractWithDetails, file: File) => {
    setDocumentError(null);
    if (contract.documentStoragePath || contract.documentUrl) {
      setDocumentError('Smlouva už dokument obsahuje. Stávající dokument nebyl nahrazen.');
      return;
    }
    setAttachingDocumentId(contract.id);
    try {
      await attachContractDocument({ contractId: contract.id, projectId, file });
      await refresh();
    } catch (error) {
      setDocumentError(
        error instanceof Error ? error.message : 'Dokument smlouvy se nepodařilo připojit.',
      );
    } finally {
      setAttachingDocumentId(null);
    }
  };

  const handleExport = async () => {
    setDocumentError(null);
    setExporting(true);
    try {
      const userLabel = user?.name?.trim() || 'Uživatel';
      await exportContractTableToXlsx(contracts, {
        organizationName: user?.organizationName || 'Organizace',
        projectName: projectDetails?.title || 'Projekt',
        exportedBy: userLabel,
        appVersion: APP_VERSION,
      });
    } catch (error) {
      setDocumentError(
        error instanceof Error ? error.message : 'Export smluv do Excelu se nepodařilo vytvořit.',
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="tf-contracts-list-page flex-1 flex flex-col min-h-0">
      <div className="flex flex-wrap items-center gap-3 px-5 py-3">
        <button
          type="button"
          onClick={openCreate}
          data-help-id="contracts-create"
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary-dark transition"
        >
          + Nová smlouva
        </button>
        <div data-help-id="contracts-view-toggle" className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-1">
          <button
            type="button"
            onClick={() => onViewModeChange('split')}
            data-active={viewMode === 'split' ? 'true' : 'false'}
            className={`px-3 py-1.5 text-xs rounded-md font-semibold transition ${
              viewMode === 'split'
                ? 'bg-primary/15 text-primary'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            ◫ Split
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('table')}
            data-active={viewMode === 'table' ? 'true' : 'false'}
            className={`px-3 py-1.5 text-xs rounded-md font-semibold transition ${
              viewMode === 'table'
                ? 'bg-primary/15 text-primary'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            ▦ Tabulka
          </button>
        </div>
        {viewMode === 'table' ? (
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting || contracts.length === 0}
            data-help-id="contracts-export-xlsx"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              table_view
            </span>
            {exporting ? 'Exportuji…' : 'Export do Excelu'}
          </button>
        ) : null}
        {viewMode === 'split' ? (
          <div
            data-help-id="contracts-list-toolbar"
            className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2"
          >
            <label
              data-help-id="contracts-list-search"
              className="flex w-72 max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/60"
            >
              <span className="material-symbols-outlined text-base text-slate-400 dark:text-slate-500" aria-hidden="true">
                search
              </span>
              <span className="sr-only">Hledat smlouvu nebo dodavatele</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Hledat smlouvu / dodavatele…"
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder-slate-500 dark:text-slate-200 dark:placeholder-slate-600"
              />
            </label>
            <ContractFilters
              active={filter}
              onChange={setFilter}
              counts={{ all: contracts.length }}
            />
          </div>
        ) : null}
      </div>

      <ContractsHeadline contracts={contracts} />

      {documentError ? (
        <div className="mx-5 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {documentError}
        </div>
      ) : null}

      <div className="flex-1 min-h-0 px-5 pb-5">
        {contracts.length === 0 ? (
          <div className="h-full rounded-xl border border-dashed border-slate-300 dark:border-slate-800 grid place-items-center text-sm text-slate-600 dark:text-slate-500">
            Zatím nemáte žádné smlouvy. Klikněte na „+ Nová smlouva“ pro založení první.
          </div>
        ) : viewMode === 'split' ? (
          <div data-help-id="contracts-split-layout" className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-3 h-full min-h-[560px]">
            <ContractListPanel
              contracts={contracts}
              selectedId={selectedId}
              onSelect={setSelectedId}
              filter={filter}
              query={query}
            />
            {selected ? (
              <ContractWorkspace
                contract={selected}
                onEditContract={openEdit}
                onRefresh={refresh}
              />
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 grid place-items-center text-sm text-slate-600 dark:text-slate-500">
                Vyberte smlouvu v levém panelu.
              </div>
            )}
          </div>
        ) : (
          <ContractsTable
            contracts={contracts}
            onSelect={handleTableSelect}
            onOpenDocument={openDocument}
            onAttachDocument={handleAttachDocument}
            attachingDocumentId={attachingDocumentId}
            onDataChanged={refresh}
          />
        )}
      </div>

      {editOpen && (
        <ContractEditDialog
          projectId={projectId}
          contract={editContract}
          onClose={() => setEditOpen(false)}
          onSaved={async (warning) => {
            setEditOpen(false);
            setDocumentError(warning ?? null);
            await refresh();
          }}
          onDeleted={async (warning) => {
            setEditOpen(false);
            setEditContract(null);
            setSelectedId(null);
            setDocumentError(warning ?? null);
            await refresh();
          }}
        />
      )}
    </div>
  );
};
