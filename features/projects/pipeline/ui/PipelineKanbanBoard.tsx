import React from "react";

import { WinnerContractButton } from "@features/projects/contracts/ui/WinnerContractButton";
import type {
  Bid,
  BidStatus,
  ContractWithDetails,
  DemandCategory,
} from "@/types";

import { BidCard } from "./BidCard";
import { Column } from "./Column";

export interface PipelineKanbanBoardProps {
  category: DemandCategory;
  bids: Bid[];
  canOpenDocHub: boolean;
  contracts: ContractWithDetails[];
  contractsLoading: boolean;
  contractsError: string | null;
  onDrop: (event: React.DragEvent, status: BidStatus) => void;
  onDragStart: (event: React.DragEvent, bidId: string) => void;
  onEditBid: (bid: Bid) => void;
  onDeleteBidRequest: (bidId: string) => void;
  onDeleteBid: (bidId: string) => void;
  onGenerateInquiry: (bid: Bid) => void;
  onGenerateMaterialInquiry: (bid: Bid) => void;
  onOpenSupplierDocHub: (bid: Bid) => void;
  onToggleContracted: (bid: Bid) => void;
  onOpenContract?: (contractId: string) => void;
}

interface StandardColumnConfig {
  title: string;
  status: Exclude<BidStatus, "sod">;
  color: "slate" | "blue" | "amber" | "red";
  helpId?: string;
  showCount: boolean;
  showEmptyState: boolean;
  confirmDelete: boolean;
  inquiryActions: boolean;
}

const standardColumnsBeforeWinner: StandardColumnConfig[] = [
  {
    title: "Oslovení",
    status: "contacted",
    color: "slate",
    helpId: "kanban-col-contacted",
    showCount: true,
    showEmptyState: true,
    confirmDelete: true,
    inquiryActions: true,
  },
  {
    title: "Odesláno",
    status: "sent",
    color: "blue",
    showCount: true,
    showEmptyState: true,
    confirmDelete: true,
    inquiryActions: false,
  },
  {
    title: "Cenová nabídka",
    status: "offer",
    color: "amber",
    helpId: "kanban-col-offer",
    showCount: true,
    showEmptyState: false,
    confirmDelete: true,
    inquiryActions: false,
  },
  {
    title: "Užší výběr",
    status: "shortlist",
    color: "blue",
    showCount: true,
    showEmptyState: false,
    confirmDelete: true,
    inquiryActions: false,
  },
];

const noopOpenContract = () => undefined;

export const PipelineKanbanBoard: React.FC<PipelineKanbanBoardProps> = ({
  category,
  bids,
  canOpenDocHub,
  contracts,
  contractsLoading,
  contractsError,
  onDrop,
  onDragStart,
  onEditBid,
  onDeleteBidRequest,
  onDeleteBid,
  onGenerateInquiry,
  onGenerateMaterialInquiry,
  onOpenSupplierDocHub,
  onToggleContracted,
  onOpenContract,
}) => {
  const bidsByStatus = (status: BidStatus) =>
    bids.filter((bid) => bid.status === status);
  const docHubAction = canOpenDocHub ? onOpenSupplierDocHub : undefined;

  const renderStandardColumn = (config: StandardColumnConfig) => {
    const columnBids = bidsByStatus(config.status);

    return (
      <Column
        key={config.status}
        data-help-id={config.helpId}
        title={config.title}
        status={config.status}
        color={config.color}
        count={config.showCount ? columnBids.length : undefined}
        onDrop={onDrop}
      >
        <div data-testid={`pipeline-column-${config.status}`} className="contents">
          {columnBids.map((bid, index) => (
            <BidCard
              key={bid.id}
              bid={bid}
              data-help-id={
                config.status === "contacted" && index === 0
                  ? "kanban-bid-card"
                  : undefined
              }
              onDragStart={onDragStart}
              onDoubleClick={onEditBid}
              onEdit={onEditBid}
              onDelete={config.confirmDelete ? onDeleteBidRequest : onDeleteBid}
              onGenerateInquiry={
                config.inquiryActions ? onGenerateInquiry : undefined
              }
              onGenerateMaterialInquiry={
                config.inquiryActions ? onGenerateMaterialInquiry : undefined
              }
              onOpenDocHubFolder={docHubAction}
            />
          ))}
          {config.showEmptyState && columnBids.length === 0 ? (
            <div className="p-4 text-center text-sm italic text-slate-400">
              Žádní dodavatelé v této fázi
            </div>
          ) : null}
        </div>
      </Column>
    );
  };

  const winnerBids = bidsByStatus("sod");
  const rejectedBids = bidsByStatus("rejected");

  return (
    <div
      data-help-id="pipeline-kanban"
      aria-label={`Kanban výběrového řízení ${category.title}`}
      className="flex-1 overflow-x-auto overflow-y-hidden p-6"
    >
      <div className="flex h-full min-w-max space-x-4">
        {standardColumnsBeforeWinner.map(renderStandardColumn)}

        <Column
          data-help-id="kanban-col-sod"
          title="Jednání o SOD"
          status="sod"
          color="green"
          count={winnerBids.length}
          onDrop={onDrop}
        >
          <div data-testid="pipeline-column-sod" className="contents">
            {winnerBids.map((bid) => (
              <div key={bid.id} className="relative">
                <div className="pointer-events-none absolute -right-2 -top-2 z-10 rounded-full bg-yellow-400 p-1 text-yellow-900 shadow-sm">
                  <span
                    className="material-symbols-outlined block text-[16px]"
                    aria-hidden="true"
                  >
                    trophy
                  </span>
                </div>
                <WinnerContractButton
                  bid={bid}
                  contracts={contracts}
                  onOpenContract={onOpenContract || noopOpenContract}
                  onToggleContracted={onToggleContracted}
                  loading={contractsLoading}
                  error={contractsError}
                />
                <BidCard
                  bid={bid}
                  priceDisplayMode="detail"
                  onDragStart={onDragStart}
                  onDoubleClick={onEditBid}
                  onEdit={onEditBid}
                  onDelete={onDeleteBid}
                  onOpenDocHubFolder={docHubAction}
                />
              </div>
            ))}
          </div>
        </Column>

        <Column
          title="Zamítnuto / Odstoupili"
          status="rejected"
          color="red"
          onDrop={onDrop}
        >
          <div data-testid="pipeline-column-rejected" className="contents">
            {rejectedBids.map((bid) => (
              <BidCard
                key={bid.id}
                bid={bid}
                onDragStart={onDragStart}
                onDoubleClick={onEditBid}
                onEdit={onEditBid}
                onDelete={onDeleteBid}
                onOpenDocHubFolder={docHubAction}
              />
            ))}
          </div>
        </Column>
      </div>
    </div>
  );
};
