import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Column } from "@features/projects/pipeline";

describe("Pipeline Column", () => {
  it("renders its content and forwards a drop to the configured status", () => {
    const onDrop = vi.fn();
    const { container } = render(
      <Column title="Cenová nabídka" status="offer" color="amber" count={2} onDrop={onDrop}>
        <div>Nabídka A</div>
      </Column>,
    );
    const column = container.firstElementChild as HTMLElement;

    expect(screen.getByRole("heading", { name: "Cenová nabídka" })).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Nabídka A")).toBeInTheDocument();

    fireEvent.dragOver(column);
    expect(column).toHaveClass("ring-2");

    fireEvent.drop(column);
    expect(onDrop).toHaveBeenCalledWith(expect.anything(), "offer");
    expect(column).not.toHaveClass("ring-2");
  });

  it("removes the drag highlight when the pointer leaves", () => {
    const { container } = render(
      <Column title="Oslovení" status="contacted" color="slate" onDrop={vi.fn()}>
        <span>Dodavatel</span>
      </Column>,
    );
    const column = container.firstElementChild as HTMLElement;

    fireEvent.dragOver(column);
    fireEvent.dragLeave(column);

    expect(column).not.toHaveClass("ring-2");
  });
});
