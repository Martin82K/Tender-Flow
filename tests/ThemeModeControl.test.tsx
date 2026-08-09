import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ThemeModeControl } from "@/shared/ui/ThemeModeControl";

describe("ThemeModeControl", () => {
  it("přepíná přímo mezi světlým, tmavým a systémovým režimem", () => {
    const onChange = vi.fn();
    render(<ThemeModeControl value="light" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Světlý" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Tmavý" }));
    fireEvent.click(screen.getByRole("button", { name: "Auto" }));

    expect(onChange).toHaveBeenNthCalledWith(1, "dark");
    expect(onChange).toHaveBeenNthCalledWith(2, "system");
  });

  it("umožňuje přesouvat fokus šipkami a klávesami Home a End", () => {
    render(<ThemeModeControl value="dark" onChange={vi.fn()} />);
    const darkButton = screen.getByRole("button", { name: "Tmavý" });
    const autoButton = screen.getByRole("button", { name: "Auto" });
    const lightButton = screen.getByRole("button", { name: "Světlý" });

    darkButton.focus();
    fireEvent.keyDown(darkButton, { key: "ArrowRight" });
    expect(autoButton).toHaveFocus();
    fireEvent.keyDown(autoButton, { key: "Home" });
    expect(lightButton).toHaveFocus();
    fireEvent.keyDown(lightButton, { key: "End" });
    expect(autoButton).toHaveFocus();
  });
});
