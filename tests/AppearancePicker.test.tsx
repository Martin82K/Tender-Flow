import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { themeSkinOptions } from "@/shared/theme/appearanceOptions";
import { AppearancePicker } from "@/shared/ui/AppearancePicker";

describe("AppearancePicker", () => {
  it("vybere TF Space přes tematický listbox", () => {
    const onChange = vi.fn();

    render(
      <AppearancePicker
        label="Skin"
        icon="palette"
        value="industrial"
        options={themeSkinOptions}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Skin" });
    expect(trigger.tagName).toBe("BUTTON");
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "TF Space" }));

    expect(onChange).toHaveBeenCalledWith("space");
  });

  it("vykreslí všechny motivy v tematickém portálu", () => {
    render(
      <AppearancePicker
        label="Skin"
        icon="palette"
        value="industrial"
        options={themeSkinOptions}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Skin" }));

    expect(screen.getAllByRole("option")).toHaveLength(themeSkinOptions.length);
    expect(document.querySelector(".tf-themed-select-popover")).toBeInTheDocument();
  });
});
