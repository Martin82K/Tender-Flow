import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PipelineDetailToolbar } from "@features/projects/pipeline/ui/PipelineDetailToolbar";

describe("PipelineDetailToolbar", () => {
  const renderToolbar = () => {
    const callbacks = {
      onBack: vi.fn(),
      onAddSubcontractor: vi.fn(),
      onSelectBulkEmail: vi.fn(),
      onOpenDocHub: vi.fn(),
      onExport: vi.fn(),
    };

    render(
      <PipelineDetailToolbar
        categoryTitle="Elektroinstalace"
        canOpenDocHub
        inquiryRecipientCount={2}
        loserRecipientCount={1}
        {...callbacks}
      />,
    );

    return callbacks;
  };

  it("předá hlavní akce detailu jejich vlastníkům", () => {
    const callbacks = renderToolbar();

    fireEvent.click(screen.getByRole("button", { name: /zpět na přehled/i }));
    fireEvent.click(screen.getByRole("button", { name: /přidat dodavatele/i }));
    fireEvent.click(screen.getByRole("button", { name: /otevřít složku/i }));

    expect(callbacks.onBack).toHaveBeenCalledOnce();
    expect(callbacks.onAddSubcontractor).toHaveBeenCalledOnce();
    expect(callbacks.onOpenDocHub).toHaveBeenCalledOnce();
  });

  it("nabídne exporty a po výběru menu zavře", () => {
    const callbacks = renderToolbar();

    fireEvent.click(
      screen.getByRole("button", { name: /otevřít nabídku exportních formátů/i }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /excel/i }));

    expect(callbacks.onExport).toHaveBeenCalledWith("xlsx");
    expect(screen.queryByRole("menu", { name: /formáty exportu/i })).not.toBeInTheDocument();
  });

  it("zavře exportní menu klávesou Escape a vrátí fokus", () => {
    renderToolbar();
    const trigger = screen.getByRole("button", {
      name: /otevřít nabídku exportních formátů/i,
    });

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu", { name: /formáty exportu/i })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("DocHub akci nevykreslí, když není dostupná", () => {
    render(
      <PipelineDetailToolbar
        categoryTitle="Elektroinstalace"
        canOpenDocHub={false}
        inquiryRecipientCount={0}
        loserRecipientCount={0}
        onBack={vi.fn()}
        onAddSubcontractor={vi.fn()}
        onSelectBulkEmail={vi.fn()}
        onOpenDocHub={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /otevřít složku/i })).not.toBeInTheDocument();
  });
});
