import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BidCard } from "../components/pipelineComponents/BidCard";
import type { Bid } from "../types";

const baseBid: Bid = {
  id: "bid-1",
  subcontractorId: "sub-1",
  companyName: "BAU-STAV a.s.",
  contactPerson: "Kumíček",
  email: "kumik@baustav.cz",
  phone: "+420123456789",
  status: "contacted",
};

describe("BidCard", () => {
  it("renders inquiry and material inquiry buttons and triggers callbacks", () => {
    const onGenerateInquiry = vi.fn();
    const onGenerateMaterialInquiry = vi.fn();

    render(
      <BidCard
        bid={baseBid}
        onDragStart={vi.fn()}
        onEdit={vi.fn()}
        onGenerateInquiry={onGenerateInquiry}
        onGenerateMaterialInquiry={onGenerateMaterialInquiry}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Generovat poptávku/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Materiálová poptávka/i }),
    );

    expect(onGenerateInquiry).toHaveBeenCalledWith(baseBid);
    expect(onGenerateMaterialInquiry).toHaveBeenCalledWith(baseBid);
  });

  it("zobrazuje soutěžní cenu z vybraného kola i když aktuální price je otazník", () => {
    render(
      <BidCard
        bid={{
          ...baseBid,
          price: "?",
          selectionRound: 0,
          priceHistory: { 0: "1 250 000 Kč" },
        }}
        onDragStart={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getAllByText("1 250 000 Kč")).toHaveLength(2);
    expect(screen.getByText("Soutěž:")).toBeInTheDocument();
  });

  it("otevre editaci pri dvojkliku na kartu", () => {
    const onDoubleClick = vi.fn();

    const { container } = render(
      <BidCard
        bid={baseBid}
        onDragStart={vi.fn()}
        onEdit={vi.fn()}
        onDoubleClick={onDoubleClick}
      />,
    );

    fireEvent.doubleClick(container.firstChild as HTMLElement);

    expect(onDoubleClick).toHaveBeenCalledWith(baseBid);
  });
});
