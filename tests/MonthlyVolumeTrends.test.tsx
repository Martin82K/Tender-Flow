import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MonthlyVolumeTrends } from "@/shared/ui/overview/MonthlyVolumeTrends";

const trends = Array.from({ length: 7 }, (_, index) => ({
  year: 2020 + index,
  tender: Array.from({ length: 12 }, (__, month) => (index + 1) * (month + 1) * 1000),
  realization: Array.from({ length: 12 }, (__, month) => (index + 1) * (month + 1) * 500),
  tenderCount: Array.from({ length: 12 }, (__, month) => month === 0 ? index + 1 : 0),
  realizationCount: Array.from({ length: 12 }, (__, month) => month === 0 ? index : 0),
  tenderActiveCount: Array.from({ length: 12 }, (__, month) => month <= index % 4 ? index + 1 : 0),
  realizationActiveCount: Array.from({ length: 12 }, (__, month) => month <= index % 3 ? index : 0),
  tenderMissingValueCount: Array.from({ length: 12 }, (__, month) => month === 0 && index === 6 ? 2 : 0),
  realizationMissingValueCount: Array.from({ length: 12 }, () => 0),
}));

describe("MonthlyVolumeTrends", () => {
  it("shows the last five years by default in both overlaid charts", () => {
    render(<MonthlyVolumeTrends trends={trends} />);

    expect(screen.getAllByRole("img", { name: /Počet aktivních staveb v soutěži za rok \d{4} podle měsíců/ })).toHaveLength(5);
    expect(screen.getByRole("img", { name: "Stavby v realizaci podle měsíců" })).toBeInTheDocument();
    expect(document.querySelectorAll('[data-chart="tender"] [data-series-year]')).toHaveLength(5);
    expect(document.querySelectorAll('[data-chart="realization"] [data-series-year]')).toHaveLength(5);
    expect(document.querySelector('[data-chart="tender"]')).toHaveAttribute("data-chart-variant", "column");
    expect(document.querySelectorAll('[data-chart="tender"] [data-slot="sparkline-column"]')).toHaveLength(60);
    expect(screen.getByText("Počet aktivních staveb podle měsíců realizace")).toBeInTheDocument();
    expect(screen.queryByText("2021")).not.toBeInTheDocument();
    expect(screen.getAllByText("2026")).toHaveLength(2);
    expect(document.querySelectorAll("[data-series-fill]")).toHaveLength(5);
    expect(screen.queryByText("Soutěž → realizace")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Rok srovnání staveb" })).not.toBeInTheDocument();
  });

  it("lets the user display all years or choose an inclusive custom range", () => {
    render(<MonthlyVolumeTrends trends={trends} />);

    fireEvent.click(screen.getByRole("button", { name: "Všechny roky" }));
    expect(document.querySelectorAll('[data-chart="tender"] [data-series-year]')).toHaveLength(7);

    fireEvent.click(screen.getByRole("button", { name: "Vlastní rozsah" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Počáteční rok trendu" }));
    fireEvent.click(screen.getByRole("option", { name: "2023" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Koncový rok trendu" }));
    fireEvent.click(screen.getByRole("option", { name: "2025" }));

    expect(document.querySelectorAll('[data-chart="tender"] [data-series-year]')).toHaveLength(3);
    expect(document.querySelectorAll('[data-chart="realization"] [data-series-year]')).toHaveLength(3);
    expect(screen.queryByText("2022")).not.toBeInTheDocument();
    expect(screen.queryByText("2026")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Rok srovnání staveb" })).not.toBeInTheDocument();
  });

  it("clamps a custom range when the available years change", () => {
    const { rerender } = render(<MonthlyVolumeTrends trends={trends} />);

    fireEvent.click(screen.getByRole("button", { name: "Vlastní rozsah" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Počáteční rok trendu" }));
    fireEvent.click(screen.getByRole("option", { name: "2023" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Koncový rok trendu" }));
    fireEvent.click(screen.getByRole("option", { name: "2025" }));

    rerender(<MonthlyVolumeTrends trends={trends.slice(0, 3)} />);

    expect(screen.getByRole("combobox", { name: "Počáteční rok trendu" })).toHaveTextContent("2020");
    expect(screen.getByRole("combobox", { name: "Koncový rok trendu" })).toHaveTextContent("2022");
    expect(document.querySelectorAll('[data-chart="tender"] [data-series-year]')).toHaveLength(3);
    expect(document.querySelectorAll('[data-chart="realization"] [data-series-year]')).toHaveLength(3);
  });

  it("renders an explicit empty state when no dated constructions are available", () => {
    render(<MonthlyVolumeTrends trends={[]} />);
    expect(screen.getByText("Pro trendové grafy nejsou dostupné stavby s obdobím realizace ani termínem dokončení.")).toBeInTheDocument();
  });
});
