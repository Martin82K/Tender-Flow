import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KPICard } from "@/shared/ui/overview/KPICard";

describe("KPICard", () => {
  it("renders KPI content with localized trend value", () => {
    render(
      <KPICard
        title="Zakázky"
        value="42"
        subtitle="Aktivní"
        icon={<span aria-hidden="true">I</span>}
        trend={{ value: -12.34, label: "proti plánu" }}
        color="blue"
      />,
    );

    expect(screen.getByText("Zakázky")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Aktivní")).toBeInTheDocument();
    expect(screen.getByText(/12,3\s*%/)).toBeInTheDocument();
    expect(screen.getByText("proti plánu")).toBeInTheDocument();
  });
});
