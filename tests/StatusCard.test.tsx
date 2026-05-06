import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusCard } from "@/shared/ui/overview/StatusCard";

describe("StatusCard", () => {
  it("renders status metrics with localized success rate", () => {
    render(
      <StatusCard
        type="tender"
        awardedValue={1250000}
        sodCount={2}
        offerCount={4}
        formatMoney={(value) => `${value.toLocaleString("cs-CZ")} Kč`}
      />,
    );

    expect(screen.getByText("Soutěž")).toBeInTheDocument();
    expect(screen.getByText("1 250 000 Kč")).toBeInTheDocument();
    expect(screen.getByText("SOD")).toBeInTheDocument();
    expect(screen.getByText("Nabídky")).toBeInTheDocument();
    expect(screen.getByText(/50,0\s*%/)).toBeInTheDocument();
  });
});
