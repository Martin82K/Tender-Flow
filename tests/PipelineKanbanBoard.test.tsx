import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PipelineKanbanBoard } from "@features/projects/pipeline/ui/PipelineKanbanBoard";
import type { Bid, DemandCategory } from "@/types";

const category: DemandCategory = {
  id: "category-1",
  title: "Elektroinstalace",
  budget: "0 Kč",
  sodBudget: 0,
  planBudget: 0,
  status: "open",
  subcontractorCount: 2,
  description: "",
};

const createBid = (id: string, status: Bid["status"]): Bid => ({
  id,
  subcontractorId: `supplier-${id}`,
  companyName: `Dodavatel ${id}`,
  contactPerson: `Kontakt ${id}`,
  email: `${id}@example.com`,
  status,
});

describe("PipelineKanbanBoard", () => {
  const renderBoard = (bids: Bid[] = []) => {
    const callbacks = {
      onDrop: vi.fn(),
      onDragStart: vi.fn(),
      onEditBid: vi.fn(),
      onDeleteBidRequest: vi.fn(),
      onDeleteBid: vi.fn(),
      onGenerateInquiry: vi.fn(),
      onGenerateMaterialInquiry: vi.fn(),
      onOpenSupplierDocHub: vi.fn(),
      onToggleContracted: vi.fn(),
      onOpenContract: vi.fn(),
    };

    render(
      <PipelineKanbanBoard
        category={category}
        bids={bids}
        canOpenDocHub
        contracts={[]}
        contractsLoading={false}
        contractsError={null}
        {...callbacks}
      />,
    );

    return callbacks;
  };

  it("rozdělí nabídky do šesti stavových sloupců a zachová počty", () => {
    renderBoard([
      createBid("contacted", "contacted"),
      createBid("sent", "sent"),
      createBid("offer", "offer"),
      createBid("shortlist", "shortlist"),
      createBid("sod", "sod"),
      createBid("rejected", "rejected"),
    ]);

    for (const title of [
      "Oslovení",
      "Odesláno",
      "Cenová nabídka",
      "Užší výběr",
      "Jednání o SOD",
      "Zamítnuto / Odstoupili",
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }

    const contactedColumn = screen.getByTestId("pipeline-column-contacted");
    expect(within(contactedColumn).getByText("Dodavatel contacted")).toBeInTheDocument();
    const contactedColumnRoot = screen
      .getByRole("heading", { name: "Oslovení" })
      .parentElement?.parentElement;
    expect(contactedColumnRoot).not.toBeNull();
    expect(within(contactedColumnRoot!).getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Dodavatel sod")).toBeInTheDocument();
  });

  it("zobrazí prázdný stav pouze ve sloupcích, kde jej legacy UI nabízelo", () => {
    renderBoard();

    expect(screen.getAllByText("Žádní dodavatelé v této fázi")).toHaveLength(2);
  });

  it("předá editaci karty a vítěznou smluvní akci", () => {
    const contactedBid = createBid("contacted", "contacted");
    const winnerBid = { ...createBid("winner", "sod"), contracted: false };
    const callbacks = renderBoard([contactedBid, winnerBid]);

    fireEvent.doubleClick(screen.getByText("Dodavatel contacted"));
    fireEvent.click(screen.getByRole("button", { name: "Označit jako zasmluvněno" }));

    expect(callbacks.onEditBid).toHaveBeenCalledWith(contactedBid);
    expect(callbacks.onToggleContracted).toHaveBeenCalledWith(winnerBid);
  });

  it("zachová potvrzení smazání v aktivních sloupcích a přímé smazání v rejected", () => {
    const contactedBid = createBid("contacted", "contacted");
    const rejectedBid = createBid("rejected", "rejected");
    const callbacks = renderBoard([contactedBid, rejectedBid]);

    const removeButtons = screen.getAllByTitle("Odebrat z výběrového řízení");
    fireEvent.click(removeButtons[0]);
    fireEvent.click(removeButtons[1]);

    expect(callbacks.onDeleteBidRequest).toHaveBeenCalledWith(contactedBid.id);
    expect(callbacks.onDeleteBid).toHaveBeenCalledWith(rejectedBid.id);
  });

  it("předá drop cílovému statusu sloupce", () => {
    const callbacks = renderBoard();
    const sentColumn = screen
      .getByRole("heading", { name: "Odesláno" })
      .parentElement?.parentElement;
    expect(sentColumn).not.toBeNull();

    fireEvent.dragOver(sentColumn!);
    fireEvent.drop(sentColumn!);

    expect(callbacks.onDrop).toHaveBeenCalledWith(expect.any(Object), "sent");
  });
});
