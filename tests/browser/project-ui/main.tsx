import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { BidCard } from "@features/projects/pipeline/ui/BidCard";
import { ProjectDocuments } from "@features/projects/documents/ui/ProjectDocuments";
import { ContractsTable } from "@features/projects/contracts/list/ContractsTable";
import { BidContractLinks } from "@features/projects/contracts/ui/BidContractLinks";
import type { Bid, ProjectDetails, ContractWithDetails } from "@/types";
import "@/index.css";
import "./fixture.css";

const bids: Bid[] = [
  { id: "short", subcontractorId: "short", companyName: "Schindler", price: "2 011 000,00 Kč", status: "offer", contactPerson: "Testovací kontakt" },
  { id: "long", subcontractorId: "long", companyName: "VÝTAHY SCHMITT+SOHN sro", price: "1 670 000,00 Kč", status: "offer", contactPerson: "Testovací kontakt" },
  { id: "unbroken", subcontractorId: "unbroken", companyName: "DodavatelskaSpolecnostBezMezerABCDEFGHIJKLMNOPQRSTUVWXYZ", price: "123\u00a0456\u00a0789\u00a0000,00\u00a0Kč", status: "offer", contactPerson: "Testovací kontakt" },
];
const project = { id: "ui-fixture", name: "UI fixture", demandCategories: [], documentLinks: [], categories: [{ id: "category", title: "Montážní práce" }], bids: { category: bids } } as unknown as ProjectDetails;

function Fixture() {
  const [contracts, setContracts] = useState<ContractWithDetails[]>([
    { id: 'linked-contract', projectId: 'ui-fixture', title: 'Propojená smlouva', vendorName: 'Testovací dodavatel', sourceBidId: 'short' } as ContractWithDetails,
    { id: 'existing-contract', projectId: 'ui-fixture', title: 'Objednávka na opravu mostního objektu a navazující stavební práce včetně povrchových úprav a dokončení', vendorName: 'Testovací dodavatel stavebních prací', contractNumber: 'JR/01/26026/2026' } as ContractWithDetails,
  ]);
  const [action, setAction] = useState("");
  return <div className="tf-app-main">
    <output id="fixture-action">{action}</output>
    <div className="tf-pipeline-view fixture-cards">
      {bids.map(bid => <div key={bid.id} className="tf-kanban-column fixture-column">
        <BidCard bid={bid} onDragStart={() => setAction("drag")}
          onEdit={() => setAction("edit")} onDelete={() => setAction("delete")}
          onOpenDocHubFolder={() => setAction("folder")}
          contractLinks={<BidContractLinks projectId="ui-fixture" bid={bid} contracts={contracts}
            onOpenContract={id => setAction(`contract:${id}`)}
            onLinkContract={async (contractId, bidId) => {
              setContracts(current => current.map(contract => contract.id === contractId ? { ...contract, sourceBidId: bidId } : contract));
              setAction(`linked:${contractId}:${bidId}`);
            }} />} />
      </div>)}
    </div>
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

createRoot(document.getElementById("root")!).render(<Fixture />);
