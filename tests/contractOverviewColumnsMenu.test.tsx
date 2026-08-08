import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ContractOverviewColumnsMenu } from "@/features/contracts-overview/ui/ContractOverviewColumnsMenu";

describe("ContractOverviewColumnsMenu", () => {
  it("vykreslí portál nad tabulkou a ponechá jej otevřený při změně sloupce", async () => {
    const onToggle = vi.fn();
    render(
      <ContractOverviewColumnsMenu
        visible={new Set(["warranty"])}
        onToggle={onToggle}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Sloupce/ });
    fireEvent.click(trigger);
    const menu = await screen.findByRole("menu", { name: "Viditelné smluvní parametry" });
    expect(menu.parentElement).toBe(document.body);

    const warranty = screen.getByRole("menuitemcheckbox", { name: "Záruka" });
    expect(warranty).toHaveAttribute("aria-checked", "true");
    fireEvent.click(warranty);
    expect(onToggle).toHaveBeenCalledWith("warranty");
    expect(menu).toBeInTheDocument();

    fireEvent.keyDown(menu, { key: "Escape" });
    await waitFor(() => expect(menu).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
