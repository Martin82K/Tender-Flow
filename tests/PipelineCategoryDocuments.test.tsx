import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PipelineCategoryDocuments } from "@features/projects/pipeline";
import type { DemandDocument } from "@/types";

const getDocumentUrlMock = vi.hoisted(() => vi.fn());

vi.mock("@/services/documentService", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/documentService")>();
  return { ...original, getDocumentUrl: getDocumentUrlMock };
});

const documents: DemandDocument[] = [
  {
    id: "doc-1",
    name: "Nabídka.pdf",
    url: "private/category/nabidka.pdf",
    size: 2048,
    uploadedAt: "2026-08-12T06:00:00.000Z",
  },
];

describe("PipelineCategoryDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDocumentUrlMock.mockResolvedValue("https://storage.example/signed.pdf");
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  it("pro prázdný seznam nic nevykreslí", () => {
    const { container } = render(
      <PipelineCategoryDocuments documents={[]} onOpenError={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("otevře podepsanou URL bezpečně a zobrazí velikost", async () => {
    render(
      <PipelineCategoryDocuments
        documents={documents}
        onOpenError={vi.fn()}
      />,
    );

    expect(screen.getByText("Nabídka.pdf")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Nabídka\.pdf/i }));

    await waitFor(() => {
      expect(getDocumentUrlMock).toHaveBeenCalledWith(
        "private/category/nabidka.pdf",
      );
      expect(window.open).toHaveBeenCalledWith(
        "https://storage.example/signed.pdf",
        "_blank",
        "noopener,noreferrer",
      );
    });
  });

  it("předá uživatelsky bezpečnou chybu bez backend detailu", async () => {
    const onOpenError = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    getDocumentUrlMock.mockRejectedValue(
      new Error("storage token=secret backend detail"),
    );

    render(
      <PipelineCategoryDocuments
        documents={documents}
        onOpenError={onOpenError}
      />,
    );
    fireEvent.click(screen.getByRole("link", { name: /Nabídka\.pdf/i }));

    await waitFor(() => {
      expect(onOpenError).toHaveBeenCalledWith(
        "Dokument se nepodařilo otevřít. Zkuste to prosím znovu.",
      );
    });
    expect(JSON.stringify(onOpenError.mock.calls)).not.toContain("secret");
    expect(consoleError).toHaveBeenCalledWith(
      "Pipeline document could not be opened.",
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("secret");
  });
});
