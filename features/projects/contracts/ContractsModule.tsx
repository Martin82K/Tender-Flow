import React, { useState } from 'react';
import { useContractsWithDetails } from './hooks/useContractsWithDetails';
import { ContractsDashboard } from './dashboard/ContractsDashboard';
import { ContractsListPage } from './list/ContractsListPage';

type SubView = 'dashboard' | 'smlouvy';

interface Props {
  projectId: string;
}

export const ContractsModule: React.FC<Props> = ({ projectId }) => {
  const [subView, setSubView] = useState<SubView>('smlouvy');
  const { contracts, loading, error, refresh } = useContractsWithDetails(projectId);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="material-symbols-outlined text-3xl text-red-400 mb-2">error</div>
          <div className="text-sm text-red-500 mb-3">{error}</div>
          <button
            type="button"
            onClick={() => refresh()}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-primary/40 text-primary hover:bg-primary/10 hover:border-primary transition"
          >
            Zkusit znovu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950/40">
      <div className="px-5 pt-4 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setSubView('dashboard')}
          className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-2 font-semibold ${
            subView === 'dashboard'
              ? 'bg-primary/15 border border-primary text-primary'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 border border-transparent'
          }`}
        >
          ▤ Dashboard
        </button>
        <button
          type="button"
          onClick={() => setSubView('smlouvy')}
          className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-2 font-semibold ${
            subView === 'smlouvy'
              ? 'bg-primary/15 border border-primary text-primary'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 border border-transparent'
          }`}
        >
          📄 Smlouvy
        </button>
      </div>

      {subView === 'dashboard' ? (
        <ContractsDashboard contracts={contracts} />
      ) : (
        <ContractsListPage
          projectId={projectId}
          contracts={contracts}
          refresh={refresh}
        />
      )}
    </div>
  );
};
