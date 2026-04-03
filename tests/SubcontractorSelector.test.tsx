import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SubcontractorSelector } from "../shared/ui/SubcontractorSelector";

describe("SubcontractorSelector", () => {
  it("pouziva select styly bez nativni sipky pro filtry", () => {
    render(
      <SubcontractorSelector
        contacts={[]}
        statuses={[{ id: "available", label: "K dispozici", color: "green" }]}
        selectedIds={new Set()}
        onSelectionChange={() => undefined}
      />,
    );

    const specializationSelect = screen.getByDisplayValue("Všechny specializace");
    const statusSelect = screen.getByDisplayValue("Všechny stavy");

    expect(specializationSelect.className).toContain("select-no-native-arrow");
    expect(specializationSelect.className).toContain("bg-none");

    expect(statusSelect.className).toContain("select-no-native-arrow");
    expect(statusSelect.className).toContain("bg-none");
  });
});
