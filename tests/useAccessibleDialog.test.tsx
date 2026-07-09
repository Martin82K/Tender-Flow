import React, { useRef, useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAccessibleDialog } from "@/shared/ui/useAccessibleDialog";

const DialogHarness: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useAccessibleDialog({
    isOpen,
    onClose: () => setIsOpen(false),
    containerRef: dialogRef,
  });

  return (
    <div>
      <button type="button" onClick={() => setIsOpen(true)}>
        Otevřít dialog
      </button>
      {isOpen ? (
        <div ref={dialogRef} role="dialog" aria-label="Testovací dialog" tabIndex={-1}>
          <button type="button">První</button>
          <button type="button">Poslední</button>
        </div>
      ) : null}
    </div>
  );
};

describe("useAccessibleDialog", () => {
  it("přesune fokus, uzamkne tabulátor a po Escape ho vrátí na spouštěč", async () => {
    render(<DialogHarness />);

    const trigger = screen.getByRole("button", { name: "Otevřít dialog" });
    trigger.focus();
    fireEvent.click(trigger);

    const firstButton = screen.getByRole("button", { name: "První" });
    const lastButton = screen.getByRole("button", { name: "Poslední" });
    await waitFor(() => expect(firstButton).toHaveFocus());

    lastButton.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(firstButton).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(lastButton).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Testovací dialog" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
