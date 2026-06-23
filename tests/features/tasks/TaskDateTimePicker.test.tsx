import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskDateTimePicker } from "@features/tasks/ui/TaskDateTimePicker";

describe("TaskDateTimePicker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 20, 9, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("otevře vlastní kalendář místo nativního datetime-local inputu", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TaskDateTimePicker label="Termín" value="" onChange={onChange} />,
    );

    expect(container.querySelector('input[type="datetime-local"]')).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Termín kalendář" })).not.toBeInTheDocument();

    const pickerButton = screen.getByRole("button", { name: /Bez termínu/i });
    expect(pickerButton).toHaveAttribute("title", "Termín: otevřít výběr data a času");

    fireEvent.click(pickerButton);

    expect(screen.getByRole("dialog", { name: "Termín kalendář" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Předchozí měsíc" })).toHaveAttribute("title", "Zobrazit předchozí měsíc");
    expect(screen.getByRole("button", { name: "Další měsíc" })).toHaveAttribute("title", "Zobrazit další měsíc");
    expect(screen.getByLabelText("Termín hodina")).toBeInTheDocument();
    expect(screen.getByLabelText("Termín minuta")).toBeInTheDocument();
  });

  it("vždy ukáže dnešní datum jako orientační bod i u jiného vybraného měsíce", () => {
    render(<TaskDateTimePicker label="Termín" value="2026-09-15T14:00" onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /15\. 09\. 2026/i }));

    const dialog = screen.getByRole("dialog", { name: "Termín kalendář" });
    const todayBadge = dialog.querySelector('[data-help-id="task-date-picker-today"]');

    expect(dialog).toHaveTextContent("září 2026");
    expect(todayBadge).not.toBeNull();
    expect(todayBadge).toHaveTextContent("Dnes je 20. 5. 2026");
  });

  it("v mřížce plně podbarví dnešní datum", () => {
    render(<TaskDateTimePicker label="Termín" value="" onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Bez termínu/i }));

    const dialog = screen.getByRole("dialog", { name: "Termín kalendář" });
    const todayButton = dialog.querySelector('[data-today="true"]');

    expect(todayButton).not.toBeNull();
    expect(todayButton).toHaveClass("bg-orange-500");
    expect(todayButton).toHaveClass("text-white");
    expect(todayButton).toHaveClass("border-orange-600");
  });

  it("umožní nastavit dnešní datum přes vlastní akci", () => {
    const onChange = vi.fn();
    render(<TaskDateTimePicker label="Termín" value="" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Bez termínu/i }));
    fireEvent.click(screen.getByRole("button", { name: "Dnes" }));

    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/));
  });
});
