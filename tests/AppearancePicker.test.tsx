import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { themeSkinOptions } from "@/shared/theme/appearanceOptions";
import { AppearancePicker } from "@/shared/ui/AppearancePicker";

describe("AppearancePicker", () => {
  it("vybere TF Space přes Appica autocomplete", async () => {
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

    fireEvent.click(screen.getByRole("combobox", { name: "Skin" }));
    fireEvent.click(await screen.findByRole("option", { name: /TF Space/i }));

    expect(onChange).toHaveBeenCalledWith("space");
  });
});
