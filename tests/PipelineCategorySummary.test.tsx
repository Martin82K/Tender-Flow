import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PipelineCategorySummary } from "@features/projects/pipeline";
import { formatMoney } from "@shared/formatting/numberFormatters";

const normalizeWhitespace = (value: string) => value.replace(/\s/g, " ");

describe("PipelineCategorySummary", () => {
  it("zobrazí název a oba rozpočty v českém formátu", () => {
    render(
      <PipelineCategorySummary
        title="Elektroinstalace"
        sodBudget={1_250_000}
        planBudget={980_000}
      />,
    );

    expect(screen.getByTestId("pipeline-category-summary")).toHaveAttribute(
      "data-help-id",
      "kanban-info-bar",
    );
    expect(screen.getByText("Elektroinstalace")).toBeInTheDocument();
    expect(screen.getByText("Cena SOD:")).toBeInTheDocument();
    expect(screen.getByText("Interní plán:")).toBeInTheDocument();
    expect(
      screen.getByText((content) =>
        normalizeWhitespace(content).includes(
          normalizeWhitespace(formatMoney(1_250_000)),
        ),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText((content) =>
        normalizeWhitespace(content).includes(
          normalizeWhitespace(formatMoney(980_000)),
        ),
      ),
    ).toBeInTheDocument();
  });

  it("použije bezpečné nuly pro chybějící rozpočty", () => {
    render(<PipelineCategorySummary title="Bez rozpočtu" />);

    expect(
      screen.getAllByText((content) =>
        normalizeWhitespace(content).includes(normalizeWhitespace(formatMoney(0))),
      ),
    ).toHaveLength(2);
  });
});
