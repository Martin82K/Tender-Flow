import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { BidCard } from "@features/projects/pipeline/ui/BidCard";
import { ProjectDocuments } from "@features/projects/documents/ui/ProjectDocuments";
import type { Bid, ProjectDetails } from "@/types";
import "@/index.css";
import "./fixture.css";

const bids: Bid[] = [
  { id: "short", subcontractorId: "short", companyName: "Schindler", price: "2 011 000,00 Kč", status: "offer", contactPerson: "Testovací kontakt" },
  { id: "long", subcontractorId: "long", companyName: "VÝTAHY SCHMITT+SOHN sro", price: "1 670 000,00 Kč", status: "offer", contactPerson: "Testovací kontakt" },
  { id: "unbroken", subcontractorId: "unbroken", companyName: "DodavatelskaSpolecnostBezMezerABCDEFGHIJKLMNOPQRSTUVWXYZ", price: "123\u00a0456\u00a0789\u00a0000,00\u00a0Kč", status: "offer", contactPerson: "Testovací kontakt" },
];
const project = { id: "ui-fixture", name: "UI fixture", demandCategories: [], documentLinks: [] } as unknown as ProjectDetails;

function Fixture() {
  const [action, setAction] = useState("");
  return <div className="tf-app-main">
    <output id="fixture-action">{action}</output>
    <div className="tf-pipeline-view fixture-cards">
      {bids.map(bid => <div key={bid.id} className="tf-kanban-column fixture-column">
        <BidCard bid={bid} onDragStart={() => setAction("drag")}
          onEdit={() => setAction("edit")} onDelete={() => setAction("delete")}
          onOpenDocHubFolder={() => setAction("folder")} />
      </div>)}
    </div>
    <ProjectDocuments project={project} onUpdate={() => {}}
      canDocHub={true} canTemplates={true} autoShortenProjectDocs={false} />
  </div>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
