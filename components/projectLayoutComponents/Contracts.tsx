import React, { useState, useEffect } from 'react';
import { ProjectDetails, ContractWithDetails } from '../../types';
import { contractService } from '../../services/contractService';
import { ContractsOverview } from './contractsComponents/ContractsOverview';
import { ContractsList } from './contractsComponents/ContractsList';
import { AmendmentsList } from './contractsComponents/AmendmentsList';
import { DrawdownsList } from './contractsComponents/DrawdownsList';

export interface ContractsProps {
  projectId: string;
  projectDetails?: ProjectDetails;
}

type ContractsSubTab = 'overview' | 'contracts' | 'amendments' | 'drawdowns';

export const Contracts: React.FC<ContractsProps> = ({ projectId, projectDetails }) => {
  const [activeSubTab, setActiveSubTab] = useState<ContractsSubTab>('overview');
  const [contracts, setContracts] = useState<ContractWithDetails[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load contracts
  useEffect(() => {
    const loadContracts = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await contractService.getContractsByProject(projectId);
        setContracts(data);

        // Auto-select first contract if none selected
        if (data.length > 0 && !selectedContractId) {
          setSelectedContractId(data[0].id);
        }
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
    } catch (err) {
      console.error('Error refreshing contracts:', err);
    }
  };

  const selectedContract = contracts.find(c => c.id === selectedContractId);

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
      <div className="flex items-center gap-1 mb-6 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-fit">
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
          <ContractsList
            projectId={projectId}
            contracts={contracts}
            onContractCreated={refreshContracts}
            onContractUpdated={refreshContracts}
            onContractDeleted={refreshContracts}
            onSelectContract={(id) => {
              setSelectedContractId(id);
              // Optionally switch to amendments or drawdowns tab
            }}
          />
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
          <DrawdownsList
            contracts={contracts}
            selectedContractId={selectedContractId}
            onSelectContract={setSelectedContractId}
            onDrawdownCreated={refreshContracts}
            onDrawdownUpdated={refreshContracts}
            onDrawdownDeleted={refreshContracts}
          />
        )}
      </div>
    </div>
  );
};
