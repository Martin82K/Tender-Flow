import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { themeSkinOptions } from "@/shared/theme/appearanceOptions";
import { AppearancePicker } from "@/shared/ui/AppearancePicker";

describe("AppearancePicker", () => {
  it("vybere TF Space přes jednoduchý nativní select", () => {
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

    const select = screen.getByRole("combobox", { name: "Skin" });
    expect(select.tagName).toBe("SELECT");
    fireEvent.change(select, { target: { value: "space" } });

    expect(onChange).toHaveBeenCalledWith("space");
  });

  it("vykreslí všechny motivy bez vnořeného portálu", () => {
    render(
      <AppearancePicker
        label="Skin"
        icon="palette"
        value="industrial"
        options={themeSkinOptions}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("option")).toHaveLength(themeSkinOptions.length);
    expect(document.querySelector(".tf-appearance-picker-positioner")).not.toBeInTheDocument();
  });
});
