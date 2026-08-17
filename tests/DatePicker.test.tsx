import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DatePicker } from "@/shared/ui/DatePicker";

describe("DatePicker", () => {
  it("vykreslí skinovaný český kalendář a vrátí ISO datum", () => {
    const onChange = vi.fn();
    const { container } = render(
      <DatePicker
        id="deadline"
        ariaLabel="Termín odevzdání nabídky"
        value="2026-09-15"
        onChange={onChange}
        className="w-full"
      />,
    );

    expect(container.querySelector('input[type="date"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Termín odevzdání nabídky" }));

    const calendar = screen.getByRole("dialog", { name: "Termín odevzdání nabídky kalendář" });
    expect(calendar).toHaveTextContent("září 2026");
    expect(calendar).toHaveClass(
      "bg-[var(--tf-skin-surface)]",
      "border-[var(--tf-skin-line-2)]",
      "text-[var(--tf-skin-text)]",
    );

    fireEvent.click(screen.getByTitle("Vybrat datum 22. 9. 2026"));
    expect(onChange).toHaveBeenCalledWith("2026-09-22");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("podporuje klávesovou navigaci mezi dny", () => {
    render(
      <DatePicker
        id="deadline"
        ariaLabel="Termín"
        value="2026-09-15"
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Termín" }));
    const selectedDay = screen.getByTitle("Vybrat datum 15. 9. 2026");
    selectedDay.focus();
    fireEvent.keyDown(selectedDay, { key: "ArrowRight" });

    expect(screen.getByTitle("Vybrat datum 16. 9. 2026")).toHaveFocus();
  });
});
