import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ContractOverviewProjectCheckbox } from "@/features/contracts-overview/ui/ContractOverviewProjectCheckbox";

describe("ContractOverviewProjectCheckbox", () => {
  it("zobrazuje checked stav i přístupovou hodnotu", () => {
    render(
      <ContractOverviewProjectCheckbox checked label="Stavba Alfa" onChange={vi.fn()}>
        Stavba Alfa
      </ContractOverviewProjectCheckbox>,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Stavba Alfa" });
    expect(checkbox).toHaveAttribute("aria-checked", "true");
    expect(checkbox.querySelector("[data-checkbox-mark]")).toHaveTextContent("check");
  });

  it("zobrazuje indeterminate stav a zůstává ovladatelný klávesnicí", () => {
    const onChange = vi.fn();
    render(
      <ContractOverviewProjectCheckbox checked="mixed" label="Všechny stavby" onChange={onChange}>
        Všechny stavby
      </ContractOverviewProjectCheckbox>,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Všechny stavby" });
    expect(checkbox).toHaveAttribute("aria-checked", "mixed");
    expect(checkbox.querySelector("[data-checkbox-mark]")).toHaveTextContent("remove");
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledOnce();
  });
});
