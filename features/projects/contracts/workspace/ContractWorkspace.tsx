import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { WorkspaceNav, type WorkspaceSection, type WorkspaceSectionId } from './WorkspaceNav';

interface Props {
  contract: ContractWithDetails;
  onEditContract: () => void;
  onRefresh: () => Promise<void> | void;
}

export const ContractWorkspace: React.FC<Props> = ({ contract, onEditContract, onRefresh }) => {
  const [activeSection, setActiveSection] = useState<WorkspaceSectionId>('hlavicka');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const sections = useMemo<WorkspaceSection[]>(
    () => [
      { id: 'hlavicka', label: '✦ Hlavička' },
      { id: 'ocr', label: '📄 OCR dokument' },
      { id: 'finance', label: '₡ Finance' },
      { id: 'dodatky', label: '⊕ Dodatky', badge: contract.amendments.length },
      { id: 'faktury', label: '🧾 Fakturace', badge: contract.invoices.length },
      { id: 'cerpani', label: '▤ Čerpání' },
      { id: 'poz', label: '◈ Pozastávky' },
      { id: 'zaruka', label: '🛡 Záruka' },
    ],
    [contract.amendments.length, contract.invoices.length],
  );

  const scrollToSection = (id: WorkspaceSectionId) => {
    const container = scrollContainerRef.current;
    const el = container?.querySelector<HTMLElement>(`#sec-${id}`);
    if (container && el) {
      container.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' });
    }
    setActiveSection(id);
  };

  useEffect(() => {
    setActiveSection('hlavicka');
    scrollContainerRef.current?.scrollTo({ top: 0 });
  }, [contract.id]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handle = () => {
      const ids: WorkspaceSectionId[] = [
        'hlavicka',
        'ocr',
        'finance',
        'dodatky',
        'faktury',
        'cerpani',
        'poz',
        'zaruka',
      ];
      let current: WorkspaceSectionId = ids[0];
      for (const id of ids) {
        const el = container.querySelector<HTMLElement>(`#sec-${id}`);
        if (el && el.offsetTop - 30 <= container.scrollTop) current = id;
      }
      setActiveSection(current);
    };
    container.addEventListener('scroll', handle, { passive: true });
    return () => container.removeEventListener('scroll', handle);
  }, [contract.id]);

  return (
    <section className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <StatusPill status={contract.status} />
          <div className="text-lg font-bold text-slate-100">{contract.title}</div>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onEditContract}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800"
            >
              ✎ Upravit
            </button>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          {contract.contractNumber ? `${contract.contractNumber} · ` : ''}
          {contract.vendorName}
          {contract.vendorIco ? ` · IČ ${contract.vendorIco}` : ''}
        </div>
      </div>

      <div className="flex-1 overflow-hidden grid grid-cols-[160px_1fr]">
        <WorkspaceNav
          sections={sections}
          active={activeSection}
          onNavigate={scrollToSection}
        />
        <div ref={scrollContainerRef} className="overflow-y-auto px-6 py-2">
          <HeaderSection contract={contract} />
          <OcrDocumentSection contract={contract} />
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
