import React from 'react';
import { useLocation } from '@shared/routing/router';
import type { UseContractsWithDetailsResult } from '@features/projects/contracts/hooks/useContractsWithDetails';
import { financialsWithConfirmedClientName } from '@features/projects/client/clientCardModel';
import { ProjectClientCard } from '@features/projects/client/ui/ProjectClientCard';
import { ProjectDocuments } from './ProjectDocuments';
import { SubcontractorDocuments, DevelopmentPlaceholder } from './SubcontractorDocuments';

export function ProjectDocumentsWorkspace({ projectId, contractsState, contractsEnabled, readOnly, project, onUpdate, ...props }: React.ComponentProps<typeof ProjectDocuments> & {projectId: string; contractsState: UseContractsWithDetailsResult; contractsEnabled: boolean; readOnly: boolean}) {
  const { search } = useLocation();
  const section = new URLSearchParams(search).get('documentsSubTab') || 'subcontractor';
  if (['pd','templates','dochub','ceniky'].includes(section)) return <div inert={readOnly}><ProjectDocuments {...props} project={project} onUpdate={onUpdate} section="documents" /></div>;
  const content = section === 'investor' ? (
    <ProjectClientCard
      projectId={projectId}
      projectTitle={project.title}
      projectCode={project.id || projectId}
      organizationId={project.organizationId}
      readOnly={readOnly}
      financialCustomerName={project.investorFinancials?.customerName}
      onCopyCustomerName={async (companyName) => {
        await onUpdate({
          investorFinancials: financialsWithConfirmedClientName(project.investorFinancials, companyName),
        });
      }}
    />
  ) : section === 'association' ? <DevelopmentPlaceholder title="Sdružení" /> : section === 'claims' ? <DevelopmentPlaceholder title="Evidence reklamací" /> : !contractsEnabled ? <p className="text-sm text-slate-500">Dokumenty subdodavatelů vyžadují přístup k modulu Smlouvy.</p> : <SubcontractorDocuments key={projectId} projectId={projectId} contractsState={contractsState} readOnly={readOnly} />;
  return <div className="tf-documents-view flex-1 min-w-0 bg-slate-50 p-4 dark:bg-slate-950 md:p-6 lg:p-8">{content}</div>;

}
