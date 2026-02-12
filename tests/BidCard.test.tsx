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
});
