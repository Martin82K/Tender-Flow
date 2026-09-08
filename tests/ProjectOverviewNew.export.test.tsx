import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectOverviewNew } from "@features/projects/ui/ProjectOverviewNew";
import { exportProjectOverviewToXlsx } from "@features/projects/api/projectOverviewExportApi";
import type { ProjectDetails } from "@/types";

vi.mock("@features/projects/api/projectOverviewExportApi", () => ({ exportProjectOverviewToXlsx: vi.fn() }));
const project: ProjectDetails = {
  title: "Bazén Aš", investor: "Město", location: "Aš", finishDate: "", siteManager: "",
  categories: Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, title: `Poptávka ${String(i).padStart(2, "0")}`, status: "open", budget: "", description: "", sodBudget: 1000, planBudget: 900, subcontractorCount: 0 })),
};

describe("overview export control", () => {
  beforeEach(() => vi.mocked(exportProjectOverviewToXlsx).mockReset());

  it("passes the complete project and current filter/search/columns, independent of pagination", async () => {
    render(<ProjectOverviewNew project={project} onUpdate={() => undefined} variant="compact" searchQuery="Poptávka" />);
    expect(screen.queryByText("Poptávka 11")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Poptávané (12)" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "SOD (Cena)" }));
    fireEvent.click(screen.getByRole("button", { name: "Export do Excelu" }));
    await waitFor(() => expect(exportProjectOverviewToXlsx).toHaveBeenCalledWith(project, expect.objectContaining({
      demandFilter: "open", searchQuery: "Poptávka", visibleColumns: expect.objectContaining({ sod: false }),
    })));
  });

  it("blocks repeated clicks and shows a recoverable export failure without leaking details", async () => {
    let rejectExport!: (error: Error) => void;
    vi.mocked(exportProjectOverviewToXlsx).mockImplementation(() => new Promise((_, reject) => { rejectExport = reject; }));
    render(<ProjectOverviewNew project={project} onUpdate={() => undefined} />);
    const button = screen.getByRole("button", { name: "Export do Excelu" });
    fireEvent.click(button);
    await waitFor(() => expect(exportProjectOverviewToXlsx).toHaveBeenCalledTimes(1));
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(exportProjectOverviewToXlsx).toHaveBeenCalledTimes(1);
    await act(async () => rejectExport(new Error("secret internals")));
    expect(screen.getByRole("alert")).toHaveTextContent("Soubor se nepodařilo exportovat");
    expect(screen.queryByText(/secret internals/)).not.toBeInTheDocument();
    expect(button).toBeEnabled();
    vi.mocked(exportProjectOverviewToXlsx).mockResolvedValue();
    fireEvent.click(button);
    await waitFor(() => expect(exportProjectOverviewToXlsx).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("allows exporting the summary even before any tenders exist", async () => {
    render(<ProjectOverviewNew project={{ ...project, categories: [] }} onUpdate={() => undefined} variant="compact" />);
    fireEvent.click(screen.getByRole("button", { name: "Export do Excelu" }));
    await waitFor(() => expect(exportProjectOverviewToXlsx).toHaveBeenCalledTimes(1));
  });
});
