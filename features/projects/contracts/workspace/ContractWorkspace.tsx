import { ContractTenderLinks } from './sections/ContractTenderLinks';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from "@shared/ui/Button";
import type { ContractWithDetails } from '@/types';
import { StatusPill } from '../list/StatusPill';
import { HeaderSection } from './sections/HeaderSection';
import { OcrDocumentSection } from './sections/OcrDocumentSection';
import { FinancialSection } from './sections/FinancialSection';
import { AmendmentsSection } from './sections/AmendmentsSection';
import { InvoicesSection } from './sections/InvoicesSection';
import { DrawdownsSection } from './sections/DrawdownsSection';
import { RetentionSection } from './sections/RetentionSection';
import { navigate } from '@shared/routing/router';
import { buildAppUrl } from '@shared/routing/routeUtils';
import { HandoverSection } from '../documents/HandoverSection';
import { formatMoney } from '../utils/format';

interface Props {
  tenderLinks?: React.ComponentProps<typeof ContractTenderLinks>;
  sourceBid?: { categoryId: string; bidId: string; title: string } | null;
  onOpenSourceBid?: (categoryId: string, bidId?: string) => void;
  contract: ContractWithDetails;
  onEditContract: () => void;
  onRefresh: () => Promise<void> | void;
}

export const ContractWorkspace: React.FC<Props> = ({ contract, onEditContract, onRefresh, sourceBid, onOpenSourceBid, tenderLinks }) => {
  const tabs = ['Přehled', 'Dokumenty', 'Fakturace', 'Pozastávky', 'Předání a záruka'] as const;
  const [tab, setTab] = useState<string>('Přehled');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTab('Přehled');
    scrollContainerRef.current?.scrollTo?.({ top: 0 });
  }, [contract.id]);

  const documentsLink = <div className="py-4"><p className="text-sm text-slate-500 mb-3">Předávací protokoly a skutečné předání nyní najdete v Dokumenty → Subdodavatel.</p><Button size="sm" variant="outline" onClick={() => navigate(buildAppUrl('project', { projectId: contract.projectId, tab: 'documents', documentsSubTab: 'subcontractor', documentsView: 'protocols', contractId: contract.id }))}>Otevřít předávací protokoly</Button></div>;
  return (
    <section data-help-id="contract-detail-shell" className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
      <div data-help-id="contract-detail-header" className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <StatusPill status={contract.status} />
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{contract.title}</div>
          <div className="ml-auto flex gap-2">
            {sourceBid && onOpenSourceBid && <Button
              type="button" variant="outline" size="sm" className="text-xs"
              title={`Otevřít kartu dodavatele ve VŘ: ${sourceBid.title}`}
              onClick={() => onOpenSourceBid(sourceBid.categoryId, sourceBid.bidId)}
            >Zpět na kartu ve VŘ</Button>}
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
          <span className="ml-3 font-semibold">{formatMoney(contract.currentTotal, contract.currency)}</span>
        </div>
      </div>

      <div role="tablist" aria-label="Detail smlouvy" className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 px-3">
        {tabs.map((label, index) => <button key={label} role="tab" id={`contract-tab-${index}`} aria-selected={tab === label} aria-controls={`contract-panel-${index}`} tabIndex={tab === label ? 0 : -1} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
          if (next !== null) { event.preventDefault(); setTab(tabs[next]); document.getElementById(`contract-tab-${next}`)?.focus(); }
        }} onClick={() => { setTab(label); scrollContainerRef.current?.scrollTo?.({ top: 0 }); }} className={`px-3 py-3 text-xs font-semibold border-b-2 transition-colors ${tab === label ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-primary'}`}>{label}</button>)}
      </div>
      <div data-help-id="contract-detail-content" className="flex-1 min-h-0 overflow-hidden">
        <div ref={scrollContainerRef} className="h-full min-w-0 overflow-y-auto px-5 py-2">
          <div role="tabpanel" id={`contract-panel-${tabs.indexOf(tab as typeof tabs[number])}`} aria-labelledby={`contract-tab-${tabs.indexOf(tab as typeof tabs[number])}`} tabIndex={0}>
            {tab === 'Přehled' && <>{tenderLinks && <ContractTenderLinks {...tenderLinks} />}<HeaderSection contract={contract} onChanged={onRefresh} /><FinancialSection contract={contract} /><AmendmentsSection contract={contract} onRefresh={onRefresh} /></>}
            {tab === 'Dokumenty' && <>{documentsLink}<OcrDocumentSection contract={contract} onRefresh={onRefresh} /></>}
            {tab === 'Fakturace' && <><InvoicesSection contract={contract} onRefresh={onRefresh} /><DrawdownsSection contract={contract} /></>}
            {tab === 'Pozastávky' && <RetentionSection key={contract.id} contract={contract} onRefresh={onRefresh} />}
            {tab === 'Předání a záruka' && <>{documentsLink}<HandoverSection warrantyOnly key={contract.id} contract={contract} onRefresh={onRefresh} /></>}
          </div>
        </div>
      </div>
    </section>
  );
};
