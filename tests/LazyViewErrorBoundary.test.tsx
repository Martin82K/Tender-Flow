import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LazyViewErrorBoundary } from "@app/views/LazyViewErrorBoundary";
import { logIncident } from "@/services/incidentLogger";

vi.mock("@/services/incidentLogger", () => ({
  logIncident: vi.fn().mockResolvedValue({ incidentId: "INC-LAZY-1" }),
}));

const BrokenView: React.FC = () => {
  throw new Error("Failed to fetch dynamically imported module: secret-url");
};

describe("LazyViewErrorBoundary", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("nahradí pád lazy modulu bezpečnou zotavitelnou obrazovkou", async () => {
    const onReload = vi.fn();
    const onLogout = vi.fn();

    render(
      <LazyViewErrorBoundary onReload={onReload} onLogout={onLogout}>
        <BrokenView />
      </LazyViewErrorBoundary>,
    );

    expect(screen.getByRole("heading", { name: "Chyba při načítání" })).toBeInTheDocument();
    expect(
      screen.getByText("Část aplikace se nepodařilo načíst. Obnovte stránku a zkuste akci znovu."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/secret-url/i)).not.toBeInTheDocument();
    expect(screen.getByText(/APP_LAZY_MODULE_LOAD_FAILED/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Obnovit stránku" }));
    fireEvent.click(screen.getByRole("button", { name: "Odhlásit se" }));

    expect(onReload).toHaveBeenCalledTimes(1);
    expect(onLogout).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(logIncident).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "APP_LAZY_MODULE_LOAD_FAILED",
          context: expect.objectContaining({ operation: "lazy_view_render" }),
        }),
      );
    });
  });
});
