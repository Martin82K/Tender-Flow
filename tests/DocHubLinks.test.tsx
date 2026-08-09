import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/fileSystemService", () => ({
  openInExplorer: vi.fn(),
}));
vi.mock("@/services/platformAdapter", () => ({
  isDesktop: false,
}));

import { DocHubLinks } from "@/components/projectLayoutComponents/documents/dochub/DocHubLinks";

const projectLinks = {
  pd: "C:\\TenderFlow\\01_PD",
  tenders: "C:\\TenderFlow\\03_Vyberova_rizeni",
  contracts: "C:\\TenderFlow\\04_Smlouvy",
  realization: "C:\\TenderFlow\\05_Realizace",
  archive: "C:\\TenderFlow\\99_Archiv",
  ceniky: "C:\\TenderFlow\\06_Ceniky",
};

const renderLinks = (
  structureDraft: Record<string, string>,
  links: typeof projectLinks | Record<string, string | null> = projectLinks,
) =>
  render(
    <DocHubLinks
      state={{ links, structureDraft } as never}
      showModal={vi.fn()}
    />,
  );

describe("DocHubLinks", () => {
  it("renders default folder names when the project has no stored structure overrides", () => {
    renderLinks({});

    expect(screen.getByText("/01_PD")).toBeInTheDocument();
    expect(screen.getByText("/03_Vyberova_rizeni")).toBeInTheDocument();
    expect(screen.getByText("/04_Smlouvy")).toBeInTheDocument();
    expect(screen.getByText("/05_Realizace")).toBeInTheDocument();
    expect(screen.getByText("/99_Archiv")).toBeInTheDocument();
    expect(screen.queryByText("/undefined")).not.toBeInTheDocument();
  });

  it("preserves custom folder names from project structure overrides", () => {
    renderLinks({
      pd: "Projektova_dokumentace",
      tenders: "Vyberova_rizeni",
      contracts: "Kontrakty",
      realization: "Stavba",
      archive: "Archivace",
    });

    expect(screen.getByText("/Projektova_dokumentace")).toBeInTheDocument();
    expect(screen.getByText("/Vyberova_rizeni")).toBeInTheDocument();
    expect(screen.getByText("/Kontrakty")).toBeInTheDocument();
    expect(screen.getByText("/Stavba")).toBeInTheDocument();
    expect(screen.getByText("/Archivace")).toBeInTheDocument();
  });

  it("renders only links that are actually available", () => {
    renderLinks({}, {
      pd: "https://drive.google.com/drive/folders/pd",
      tenders: null,
      contracts: null,
      realization: null,
      archive: null,
    });

    expect(screen.getByText("/01_PD")).toBeInTheDocument();
    expect(screen.queryByText("/03_Vyberova_rizeni")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
