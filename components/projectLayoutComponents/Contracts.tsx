import React, { useState, useEffect, useMemo } from 'react';
import { ProjectDetails, ContractWithDetails } from '../../types';
import { contractService } from '../../services/contractService';
import { ContractsOverview } from './contractsComponents/ContractsOverview';
import { ContractsList } from './contractsComponents/ContractsList';
import { AmendmentsList } from './contractsComponents/AmendmentsList';
import { DrawdownsList } from './contractsComponents/DrawdownsList';
import { ContractsSummaryView } from '@/shared/ui/projects/ContractsSummaryView';
import { buildContractSummaryList } from '@/shared/contracts/contractSummary';

export interface ContractsProps {
  projectId: string;
  projectDetails?: ProjectDetails;
}

type ContractsSubTab = 'overview' | 'contracts' | 'amendments' | 'drawdowns';
type ContractsListViewMode = 'table' | 'summary';
type DrawdownsViewMode = 'drawdowns' | 'summary';

const normalizeContractSortKey = (value: string | null | undefined): string =>
  (value || "").trim().toLocaleLowerCase("cs");

const sortContractsByVendor = (
  a: ContractWithDetails,
  b: ContractWithDetails,
): number =>
  normalizeContractSortKey(a.vendorName).localeCompare(
    normalizeContractSortKey(b.vendorName),
    "cs",
    { sensitivity: "base" },
  ) ||
  normalizeContractSortKey(a.title).localeCompare(
    normalizeContractSortKey(b.title),
    "cs",
    { sensitivity: "base" },
  ) ||
  (a.contractNumber || "").localeCompare(b.contractNumber || "", "cs", {
    sensitivity: "base",
  });

const getPreferredContractSelection = (
  data: ContractWithDetails[],
): string | null => {
  if (data.length === 0) return null;
  return [...data].sort(sortContractsByVendor)[0]?.id || null;
};

export const Contracts: React.FC<ContractsProps> = ({ projectId, projectDetails }) => {
  const [activeSubTab, setActiveSubTab] = useState<ContractsSubTab>('overview');
  const [contractsViewMode, setContractsViewMode] = useState<ContractsListViewMode>('table');
  const [drawdownsViewMode, setDrawdownsViewMode] = useState<DrawdownsViewMode>('drawdowns');
  const [contracts, setContracts] = useState<ContractWithDetails[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contractSummaries = useMemo(
    () => buildContractSummaryList(contracts),
    [contracts],
  );

  // Load contracts
  useEffect(() => {
    const loadContracts = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await contractService.getContractsByProject(projectId);
        setContracts(data);
        setSelectedContractId((currentId) => {
          if (currentId && data.some((contract) => contract.id === currentId)) {
            return currentId;
          }
          return getPreferredContractSelection(data);
        });
      } catch (err) {
        console.error('Error loading contracts:', err);
        setError(err instanceof Error ? err.message : 'Nepodařilo se načíst smlouvy');
      } finally {
        setLoading(false);
      }
    };

    loadContracts();
  }, [projectId]);

  const refreshContracts = async () => {
    try {
      const data = await contractService.getContractsByProject(projectId);
      setContracts(data);
      setSelectedContractId((currentId) => {
        if (currentId && data.some((contract) => contract.id === currentId)) {
          return currentId;
        }
        return getPreferredContractSelection(data);
      });
    } catch (err) {
      console.error('Error refreshing contracts:', err);
    }
  };

  const subTabs = [
    { id: 'overview' as const, label: 'Přehled', icon: 'analytics' },
    { id: 'contracts' as const, label: 'Smlouvy', icon: 'description' },
    { id: 'amendments' as const, label: 'Dodatky', icon: 'post_add' },
    { id: 'drawdowns' as const, label: 'Čerpání', icon: 'account_balance' },
  ];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl text-red-400 mb-2">error</span>
          <p className="text-red-500">{error}</p>
          <button
            onClick={refreshContracts}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Zkusit znovu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 lg:p-6">
      {/* Sub-tabs */}
      <div data-help-id="contracts-subtabs" className="flex items-center gap-1 mb-6 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-fit">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === tab.id
                ? 'bg-white dark:bg-slate-800 text-primary shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {activeSubTab === 'overview' && (
          <ContractsOverview
            contracts={contracts}
            projectDetails={projectDetails}
          />
        )}

        {activeSubTab === 'contracts' && (
          <div className="space-y-4">
            <div className="flex w-fit items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setContractsViewMode('table')}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  contractsViewMode === 'table'
                    ? 'bg-white text-primary shadow-sm dark:bg-slate-800'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Tabulka
              </button>
              <button
                type="button"
                onClick={() => setContractsViewMode('summary')}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  contractsViewMode === 'summary'
                    ? 'bg-white text-primary shadow-sm dark:bg-slate-800'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Přehled smluv
              </button>
            </div>

            {contractsViewMode === 'table' ? (
              <ContractsList
                projectId={projectId}
                projectDetails={projectDetails}
                contracts={contracts}
                onContractCreated={refreshContracts}
                onContractUpdated={refreshContracts}
                onContractDeleted={refreshContracts}
                onSelectContract={(id) => {
                  setSelectedContractId(id);
                }}
              />
            ) : (
              <ContractsSummaryView
                contracts={contractSummaries}
                projectDetails={projectDetails}
                emptyTitle="Žádné smlouvy k přehledu"
                emptyDescription="Jakmile přidáte smlouvy, objeví se zde jejich souhrn pro rychlou orientaci i export."
              />
            )}
          </div>
        )}

        {activeSubTab === 'amendments' && (
          <AmendmentsList
            contracts={contracts}
            selectedContractId={selectedContractId}
            onSelectContract={setSelectedContractId}
            onAmendmentCreated={refreshContracts}
            onAmendmentDeleted={refreshContracts}
          />
        )}

        {activeSubTab === 'drawdowns' && (
          <div className="space-y-4">
            <div className="flex w-fit items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setDrawdownsViewMode('drawdowns')}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  drawdownsViewMode === 'drawdowns'
                    ? 'bg-white text-primary shadow-sm dark:bg-slate-800'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Čerpání
              </button>
              <button
                type="button"
                onClick={() => setDrawdownsViewMode('summary')}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  drawdownsViewMode === 'summary'
                    ? 'bg-white text-primary shadow-sm dark:bg-slate-800'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Smlouvy
              </button>
            </div>

            {drawdownsViewMode === 'drawdowns' ? (
              <DrawdownsList
                contracts={contracts}
                selectedContractId={selectedContractId}
                onSelectContract={setSelectedContractId}
                onDrawdownCreated={refreshContracts}
                onDrawdownUpdated={refreshContracts}
                onDrawdownDeleted={refreshContracts}
              />
            ) : (
              <ContractsSummaryView
                contracts={contractSummaries}
                projectDetails={projectDetails}
                emptyTitle="Žádné smlouvy pro čerpání"
                emptyDescription="V tomto pohledu uvidíte smluvní rámec ještě před tím, než nad smlouvami vznikne průvodka nebo další čerpání."
                onContractSelect={(contractId) => {
                  setSelectedContractId(contractId);
                  setDrawdownsViewMode('drawdowns');
                }}
                rowActionLabel="Otevřít čerpání"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
