import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePipelineRecipientSelection } from "@features/projects/model/usePipelineRecipientSelection";
import { projectDemoDataApi } from "@features/projects/api/projectDemoDataApi";
import type { Subcontractor } from "@/types";
import { createRoot } from "react-dom/client";
import { BidCard } from "@features/projects/pipeline/ui/BidCard";
import { ProjectDocuments } from "@features/projects/documents/ui/ProjectDocuments";
import { ContractsTable } from "@features/projects/contracts/list/ContractsTable";
import { ContractTenderLinks } from "@features/projects/contracts/workspace/sections/ContractTenderLinks";
import { BidContractLinks } from "@features/projects/contracts/ui/BidContractLinks";
import type { Bid, ProjectDetails, ContractWithDetails } from "@/types";
import "@/index.css";
import "./fixture.css";

const bids: Bid[] = [
  { id: "short", subcontractorId: "short", companyName: "Schindler", price: "2 011 000,00 Kč", status: "contacted", contactPerson: "Jan Novák", email: "jan@example.com", phone: "111" },
  { id: "long", subcontractorId: "long", companyName: "VÝTAHY SCHMITT+SOHN sro", price: "1 670 000,00 Kč", status: "offer", contactPerson: "Testovací kontakt" },
  { id: "unbroken", subcontractorId: "unbroken", companyName: "DodavatelskaSpolecnostBezMezerABCDEFGHIJKLMNOPQRSTUVWXYZ", price: "123\u00a0456\u00a0789\u00a0000,00\u00a0Kč", status: "offer", contactPerson: "Testovací kontakt" },
];
const project = { id: "ui-fixture", name: "UI fixture", demandCategories: [], documentLinks: [], categories: [{ id: "category", title: "Montážní práce" }, { id: "second", title: "Elektro" }, { id: "third", title: "ZTI" }], bids: { category: [bids[0]], second: [bids[1]], third: [bids[2]] } } as unknown as ProjectDetails;

const recipientSupplier: Subcontractor = { id: "short", company: "Schindler", specialization: [], status: "available", contacts: [
  { id: "jan", name: "Jan Novák", email: "jan@example.com", phone: "111", position: "Jednatel" },
  { id: "eva", name: "Eva Rozpočtářová", email: "eva.rozpocty@example.com", phone: "222", position: "Rozpočtářka a příprava staveb" },
  { id: "no-email", name: "Kontakt bez e-mailu", email: "-", phone: "333" },
] };
const stored = projectDemoDataApi.getDemoData();
if (!stored?.projectDetails[project.id]) projectDemoDataApi.saveDemoData({ projects: [], projectDetails: { [project.id]: project }, contacts: [recipientSupplier], statuses: [] });
const queryClient = new QueryClient();

function Fixture() {
  const [currentBids, setCurrentBids] = useState<Record<string, Bid[]>>(() => projectDemoDataApi.getDemoData()?.projectDetails[project.id].bids || { category: bids });
  const { selectRecipient, inquiryBids } = usePipelineRecipientSelection({ projectId: project.id, categoryId: "category", bids: currentBids, contacts: [recipientSupplier], userRole: "demo" });
  const [contracts, setContracts] = useState<ContractWithDetails[]>([
    { id: 'linked-contract', projectId: 'ui-fixture', title: 'Propojená smlouva', vendorName: 'Testovací dodavatel', sourceBidId: 'short' } as ContractWithDetails,
    { id: 'existing-contract', sourceBidId: 'unbroken', linkedBidIds: ['unbroken'], projectId: 'ui-fixture', title: 'Objednávka na opravu mostního objektu a navazující stavební práce včetně povrchových úprav a dokončení', vendorName: 'Testovací dodavatel stavebních prací', contractNumber: 'JR/01/26026/2026' } as ContractWithDetails,
  ]);
  const [action, setAction] = useState("");
  (window as unknown as { fixtureUnlink: (projectId: string, contractId: string, bidId: string) => Promise<void> }).fixtureUnlink = async (_, contractId, bidId) => {
    setContracts(current => current.map(contract => contract.id === contractId ? { ...contract, linkedBidIds: contract.linkedBidIds?.filter(id => id !== bidId) } : contract));
    setAction(`unlinked:${contractId}:${bidId}`);
  };
  return <div className="tf-app-main">
    <output id="fixture-action">{action}</output>
    <div className="tf-pipeline-view fixture-cards">
      {Object.values(inquiryBids).flat().map(bid => <div key={bid.id} className="tf-kanban-column fixture-column">
        <BidCard bid={bid}
          contacts={bid.id === "short" ? recipientSupplier.contacts : undefined}
          onSelectRecipient={bid.id === "short" ? selectRecipient : undefined}
          onGenerateInquiry={selected => setAction(`inquiry:${selected.email}`)}
          onDragStart={() => setAction("drag")}
          onEdit={() => setAction("edit")} onDelete={() => setAction("delete")}
          onOpenDocHubFolder={() => setAction("folder")}
          contractLinks={<BidContractLinks projectId="ui-fixture" bid={bid} contracts={contracts}
            onOpenContract={id => setAction(`contract:${id}`)}
            onLinkContract={async (contractId, bidId) => {
              setContracts(current => current.map(contract => contract.id === contractId ? { ...contract, linkedBidIds: [...(contract.linkedBidIds ?? (contract.sourceBidId ? [contract.sourceBidId] : [])), bidId] } : contract));
              setAction(`linked:${contractId}:${bidId}`);
            }} />} />
      </div>)}
    </div>
    <div id="fixture-tender-links"><ContractTenderLinks contract={contracts[1]} contracts={contracts} project={project} onRefresh={() => {}} onOpenBid={(categoryId, bidId) => setAction(`source:${categoryId}:${bidId}`)} /></div>
    <ProjectDocuments project={project} onUpdate={() => {}}
      canDocHub={true} canTemplates={true} autoShortenProjectDocs={false} />
    <div className="tf-contracts-module" id="fixture-contracts-table">
      <ContractsTable contracts={contracts.map(contract => ({
        ...contract, contractNumber: contract.contractNumber || 'SOD-2026-001',
        amendments: [], invoices: [], drawdowns: [], status: 'active', currency: 'CZK',
        basePrice: 100, currentTotal: 100, approvedSum: 0, remaining: 100,
        invoicedSum: 0, paidSum: 0, overdueSum: 0, source: 'manual',
      }))} projectDetails={project} onSelect={id => setAction(`table-detail:${id}`)}
        onOpenSourceBid={(categoryId, bidId) => setAction(`source:${categoryId}:${bidId}`)} />
    </div>
  </div>;
}

createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider>);
