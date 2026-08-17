import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BudgetDeviationGauge } from "@/shared/ui/overview/BudgetDeviationGauge";
import { StatusDistributionChart } from "@/shared/ui/overview/StatusDistributionChart";
import { SupplierBarChart } from "@/shared/ui/overview/SupplierBarChart";
import { SupplierTable } from "@/shared/ui/overview/SupplierTable";

vi.mock("recharts", async () => {
  const React = await import("react");

  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "responsive-container" }, children),
    PieChart: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "pie-chart" }, children),
    Pie: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "pie" }, children),
    Cell: () => React.createElement("div", { "data-testid": "cell" }),
    Tooltip: () => React.createElement("div", { "data-testid": "tooltip" }),
  };
});

describe("overview shared components", () => {
  it("renders supplier table and propagates row clicks", () => {
    const onSupplierClick = vi.fn();

    render(
      <SupplierTable
        suppliers={[
          {
            id: "supplier-1",
            name: "Alfa Stavby",
            rating: 4.5,
            ratingCount: 3,
            offerCount: 4,
            sodCount: 2,
            lastAwardedLabel: "Fasáda",
          },
        ]}
        onSupplierClick={onSupplierClick}
      />,
    );

    fireEvent.click(screen.getByText("Alfa Stavby"));

    expect(screen.getByText("4,5")).toBeInTheDocument();
    expect(screen.getByText(/50\s*%/)).toBeInTheDocument();
    expect(screen.getByText("Fasáda")).toBeInTheDocument();
    expect(onSupplierClick).toHaveBeenCalledWith(expect.objectContaining({ id: "supplier-1" }));
  });

  it("renders supplier bar chart values", () => {
    render(
      <SupplierBarChart
        title="Top dodavatelé"
        items={[{ label: "Beta Beton", value: 12, helper: "12 nabídek" }]}
        valueFormatter={(value) => `${value} ks`}
      />,
    );

    expect(screen.getByText("Top dodavatelé")).toBeInTheDocument();
    expect(screen.getByText("Beta Beton")).toBeInTheDocument();
    expect(screen.getByText("12 ks")).toBeInTheDocument();
    expect(screen.getByText("12 nabídek")).toBeInTheDocument();
  });

  it("reserves a non-wrapping column for long chart values", () => {
    render(
      <SupplierBarChart
        title="Objem oceněných zakázek"
        items={[{ label: "2026", value: 78_968_913.51, helper: "65 SOD" }]}
        valueFormatter={() => "78 968 913,51 Kč"}
      />,
    );

    expect(screen.getByText("78 968 913,51 Kč").parentElement).toHaveAttribute(
      "data-slot",
      "supplier-bar-value",
    );
    expect(screen.getByText("78 968 913,51 Kč").parentElement).toHaveClass(
      "whitespace-nowrap",
      "w-max",
    );
    expect(screen.getByText("78 968 913,51 Kč").closest('[data-slot="supplier-bar-row"]')).toHaveClass(
      "grid",
    );
  });

  it("renders suppliers with duplicate display names without React key warnings", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <SupplierBarChart
        title="Top dodavatelé"
        items={[
          { label: "Neznámý dodavatel", value: 12 },
          { label: "Neznámý dodavatel", value: 8 },
        ]}
      />,
    );

    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining("Encountered two children with the same key"),
      expect.anything(),
    );
    consoleError.mockRestore();
  });

  it("renders status distribution legend", () => {
    const { queryByTestId } = render(
      <StatusDistributionChart
        sodCount={2}
        shortlistCount={1}
        offerCount={3}
        rejectedCount={0}
        contactedCount={0}
        sentCount={0}
      />,
    );

    expect(screen.getByText("Rozdělení nabídek podle statusu")).toBeInTheDocument();
    expect(screen.getByText("SOD")).toBeInTheDocument();
    expect(screen.getByText("Užší výběr")).toBeInTheDocument();
    expect(screen.getByText("Nabídka")).toBeInTheDocument();
    expect(screen.getByText("Celkem 6 nabídek")).toBeInTheDocument();
    expect(queryByTestId("responsive-container")).not.toBeInTheDocument();
  });

  it("renders budget deviation gauge value", () => {
    render(<BudgetDeviationGauge avgDeviationPercent={7.25} />);

    expect(screen.getByText("Průměrná nabídková cena proti smluvní ceně s investorem")).toBeInTheDocument();
    expect(screen.getByText(/\+7,3\s*%/)).toBeInTheDocument();
    expect(screen.getByText("7,3 % nad smluvní cenou")).toBeInTheDocument();
    expect(screen.getByText("Cílové pásmo ±5 %")).toBeInTheDocument();
  });
});
