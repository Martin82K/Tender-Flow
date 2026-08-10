import React, { useEffect, useRef } from 'react';
import type { ContractWithDetails } from '@/types';
import { StatusPill } from '../list/StatusPill';
import { HeaderSection } from './sections/HeaderSection';
import { OcrDocumentSection } from './sections/OcrDocumentSection';
import { FinancialSection } from './sections/FinancialSection';
import { AmendmentsSection } from './sections/AmendmentsSection';
import { InvoicesSection } from './sections/InvoicesSection';
import { DrawdownsSection } from './sections/DrawdownsSection';
import { RetentionSection } from './sections/RetentionSection';
import { WarrantySection } from './sections/WarrantySection';

interface Props {
  contract: ContractWithDetails;
  onEditContract: () => void;
  onRefresh: () => Promise<void> | void;
}

export const ContractWorkspace: React.FC<Props> = ({ contract, onEditContract, onRefresh }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 });
  }, [contract.id]);

  return (
    <section data-help-id="contract-detail-shell" className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
      <div data-help-id="contract-detail-header" className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <StatusPill status={contract.status} />
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{contract.title}</div>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onEditContract}
              className="rounded-lg border border-primary bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              ✎ Upravit záznam
            </button>
          </div>
        </div>
        <div className="text-xs text-slate-600 dark:text-slate-500">
          {contract.contractNumber ? `${contract.contractNumber} · ` : ''}
          {contract.vendorName}
          {contract.vendorIco ? ` · IČ ${contract.vendorIco}` : ''}
        </div>
      </div>

      <div data-help-id="contract-detail-content" className="flex-1 overflow-hidden">
        <div ref={scrollContainerRef} className="h-full min-w-0 overflow-y-auto px-6 py-2">
          <HeaderSection contract={contract} onChanged={onRefresh} />
          <OcrDocumentSection contract={contract} onRefresh={onRefresh} />
          <FinancialSection contract={contract} />
          <AmendmentsSection contract={contract} onRefresh={onRefresh} />
          <InvoicesSection contract={contract} onRefresh={onRefresh} />
          <DrawdownsSection contract={contract} />
          <RetentionSection contract={contract} onRefresh={onRefresh} />
          <WarrantySection contract={contract} />
        </div>
      </div>
    </section>
  );
};
