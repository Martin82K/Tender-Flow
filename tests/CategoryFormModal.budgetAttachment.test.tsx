import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryFormModal } from "@features/projects/pipeline";

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

  it("zarovná rozpočtová pole bez posunutí přepínačem režimu", () => {
    render(
      <CategoryFormModal
        isOpen
        mode="edit"
        initialData={{
          title: "Elektroinstalace",
          sodBudget: 853295,
          planBudget: 767966,
        }}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const sodHeader = screen.getByText("Cena SOD (Investor)").parentElement;
    const planHeader = screen.getByText("Interní Plán").parentElement;
    const planModeToggle = screen.getByRole("button", { name: "Kč" }).parentElement;

    expect(sodHeader).toHaveClass("relative", "min-h-7");
    expect(planHeader).toHaveClass("relative", "min-h-7");
    expect(planModeToggle).toHaveClass("absolute", "right-0", "top-1/2", "-translate-y-1/2");
  });

  it("umožní přidat a jednotlivě odpojit více rozpočtových příloh", async () => {
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
    expect(screen.getByRole("button", { name: /Přidat další soubor/i })).toBeInTheDocument();

    selectPendingBudgetAttachmentMock.mockResolvedValueOnce({
      sourcePath: "/Users/tester/Downloads/vykaz vymer.pdf",
      fileName: "vykaz vymer.pdf",
      size: 4096,
    });
    fireEvent.click(screen.getByRole("button", { name: /Přidat další soubor/i }));

    expect(await screen.findByText("vykaz vymer.pdf")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Odpojit přílohu rozpocet libovolny.xlsx"));
    expect(screen.queryByText("rozpocet libovolny.xlsx")).not.toBeInTheDocument();
    expect(screen.getByText("vykaz vymer.pdf")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Vytvořit poptávku/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          pendingBudgetAttachments: [
            expect.objectContaining({
              fileName: "vykaz vymer.pdf",
              sourcePath: "/Users/tester/Downloads/vykaz vymer.pdf",
            }),
          ],
        }),
      );
    });
  });

  it("nepřekročí limit deseti příloh při souběžném dokončení dvou výběrů", async () => {
    const existingAttachments = Array.from({ length: 9 }, (_, index) => ({
      source: "dochub" as const,
      fileName: `rozpocet-${index + 1}.xlsx`,
      relativePath: `rozpocet-${index + 1}.xlsx`,
      size: 1024,
      selectedAt: "2026-07-01T20:00:00.000Z",
      enabled: true,
    }));
    let resolveFirstSelection:
      | ((value: (typeof existingAttachments)[number]) => void)
      | undefined;
    let resolveSecondSelection:
      | ((value: (typeof existingAttachments)[number]) => void)
      | undefined;
    selectBudgetAttachmentMock
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirstSelection = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSecondSelection = resolve;
        }),
      );
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <CategoryFormModal
        isOpen
        mode="edit"
        initialData={{
          title: "Betony",
          budgetAttachments: existingAttachments,
        }}
        isDesktop
        isDocHubEnabled
        resolveDesktopTenderFolderPath={vi
          .fn()
          .mockResolvedValue("/Projects/Stavba/Betony")}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const addButton = screen.getByRole("button", {
      name: /Přidat další soubor/i,
    });
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(selectBudgetAttachmentMock).toHaveBeenCalledTimes(2);
    });

    resolveFirstSelection?.({
      source: "dochub",
      fileName: "prvni-nova.xlsx",
      relativePath: "prvni-nova.xlsx",
      size: 1024,
      selectedAt: "2026-07-01T20:01:00.000Z",
      enabled: true,
    });
    resolveSecondSelection?.({
      source: "dochub",
      fileName: "druha-nova.xlsx",
      relativePath: "druha-nova.xlsx",
      size: 1024,
      selectedAt: "2026-07-01T20:02:00.000Z",
      enabled: true,
    });

    await waitFor(() => {
      expect(screen.getAllByTitle(/^Odpojit přílohu /)).toHaveLength(10);
    });

    fireEvent.click(screen.getByRole("button", { name: /Uložit změny/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          budgetAttachments: expect.any(Array),
        }),
      );
      expect(onSubmit.mock.calls[0][0].budgetAttachments).toHaveLength(10);
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
