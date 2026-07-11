import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppLoadErrorView } from "@app/views/AppLoadErrorView";

describe("AppLoadErrorView", () => {
  const writeText = vi.fn();

  beforeEach(() => {
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("shows and copies a safe error reference", () => {
    render(
      <AppLoadErrorView
        error="Nepodařilo se načíst základní data aplikace."
        errorCode="APP_CORE_DATA_LOAD_FAILED"
        incidentId="INC-LOAD-1"
        onReload={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByText("Nepodařilo se načíst základní data aplikace.")).toBeInTheDocument();
    expect(screen.getByText(/Kód chyby: APP_CORE_DATA_LOAD_FAILED/)).toBeInTheDocument();
    expect(screen.getByText(/Kód incidentu: INC-LOAD-1/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Kopírovat referenci chyby" }));
    expect(writeText).toHaveBeenCalledWith(
      "Kód chyby: APP_CORE_DATA_LOAD_FAILED\nKód incidentu: INC-LOAD-1",
    );
  });
});
