import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryFormModal } from "@/components/pipelineComponents/CategoryFormModal";

const selectBudgetAttachmentMock = vi.hoisted(() => vi.fn());
const selectPendingBudgetAttachmentMock = vi.hoisted(() => vi.fn());
const openInExplorerMock = vi.hoisted(() => vi.fn());

vi.mock("@/services/budgetAttachmentService", () => ({
  selectBudgetAttachment: selectBudgetAttachmentMock,
  selectPendingBudgetAttachment: selectPendingBudgetAttachmentMock,
}));

vi.mock("@infra/files/fileSystemService", () => ({
  openInExplorer: openInExplorerMock,
}));

describe("CategoryFormModal rozpočtová příloha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectBudgetAttachmentMock.mockResolvedValue({
      source: "dochub",
      fileName: "rozpocet libovolny.xlsx",
      relativePath: "podklady/rozpocet libovolny.xlsx",
      size: 2048,
      selectedAt: "2026-07-01T20:00:00.000Z",
      enabled: true,
    });
    selectPendingBudgetAttachmentMock.mockResolvedValue({
      sourcePath: "/Users/tester/Downloads/rozpocet libovolny.xlsx",
      fileName: "rozpocet libovolny.xlsx",
      size: 2048,
    });
    openInExplorerMock.mockResolvedValue({ success: true });
  });

  it("umožní vybrat, nahradit a odpojit rozpočtovou přílohu", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <CategoryFormModal
        isOpen
        mode="create"
        isDesktop
        isDocHubEnabled
        resolveDesktopTenderFolderPath={vi.fn().mockResolvedValue("/Projects/Stavba/Betony")}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Např. Klempířské konstrukce"), {
      target: { value: "Betony" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Vybrat soubor/i }));

    expect(await screen.findByText("rozpocet libovolny.xlsx")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nahradit přílohu/i })).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Odpojit přílohu"));
    expect(screen.getByText(/Není připojena žádná rozpočtová příloha/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Vybrat soubor/i }));
    expect(await screen.findByText("rozpocet libovolny.xlsx")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Vytvořit poptávku/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          pendingBudgetAttachment: expect.objectContaining({
            fileName: "rozpocet libovolny.xlsx",
            sourcePath: "/Users/tester/Downloads/rozpocet libovolny.xlsx",
          }),
        }),
      );
    });
  });

  it("zobrazí desktop-only informaci při mapování přílohy ve web režimu", async () => {
    render(
      <CategoryFormModal
        isOpen
        mode="edit"
        initialData={{ title: "Betony" }}
        isDesktop={false}
        isDocHubEnabled
        resolveDesktopTenderFolderPath={vi.fn().mockResolvedValue("/Projects/Stavba/Betony")}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Vybrat soubor/i }));

    expect(await screen.findByText("Desktop funkce")).toBeInTheDocument();
    expect(selectBudgetAttachmentMock).not.toHaveBeenCalled();
    expect(selectPendingBudgetAttachmentMock).not.toHaveBeenCalled();
  });

  it("označí přílohu nad 10 MB varovným vykřičníkem", async () => {
    selectPendingBudgetAttachmentMock.mockResolvedValue({
      sourcePath: "/Users/tester/Downloads/velky-rozpocet.xlsx",
      fileName: "velky-rozpocet.xlsx",
      size: 10 * 1024 * 1024 + 1,
    });

    render(
      <CategoryFormModal
        isOpen
        mode="create"
        isDesktop
        isDocHubEnabled
        resolveDesktopTenderFolderPath={vi.fn().mockResolvedValue("/Projects/Stavba/Betony")}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Např. Klempířské konstrukce"), {
      target: { value: "Betony" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Vybrat soubor/i }));

    expect(
      await screen.findByRole("img", {
        name: "Příloha je větší než 10 MB a do EML se nevloží",
      }),
    ).toHaveAttribute(
      "title",
      "Příloha je větší než 10 MB a do EML se nevloží. EML zpráva se vytvoří bez ní.",
    );
  });
});
