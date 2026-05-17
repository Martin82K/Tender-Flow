import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskDateTimePicker } from "@features/tasks/ui/TaskDateTimePicker";

describe("TaskDateTimePicker", () => {
  it("otevře vlastní kalendář místo nativního datetime-local inputu", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TaskDateTimePicker label="Termín" value="" onChange={onChange} />,
    );

    expect(container.querySelector('input[type="datetime-local"]')).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Termín kalendář" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Bez termínu/i }));

    expect(screen.getByRole("dialog", { name: "Termín kalendář" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Předchozí měsíc" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Další měsíc" })).toBeInTheDocument();
    expect(screen.getByLabelText("Termín hodina")).toBeInTheDocument();
    expect(screen.getByLabelText("Termín minuta")).toBeInTheDocument();
  });

  it("umožní nastavit dnešní datum přes vlastní akci", () => {
    const onChange = vi.fn();
    render(<TaskDateTimePicker label="Termín" value="" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Bez termínu/i }));
    fireEvent.click(screen.getByRole("button", { name: "Dnes" }));

    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/));
  });
});
