import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ThemedSelect } from "@shared/ui/ThemedSelect";

describe("ThemedSelect pro role a oprávnění", () => {
  it("otevře vlastní listbox a umožní volbu klávesnicí", () => {
    const onChange = vi.fn();
    render(
      <ThemedSelect
        ariaLabel="Profesní role"
        value=""
        onChange={onChange}
        options={[
          { value: "", label: "Bez profesní role" },
          { value: "technician", label: "Technik" },
        ]}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Profesní role" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    expect(screen.getByRole("listbox", { name: "Profesní role" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Bez profesní role" })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("technician");
    expect(screen.queryByRole("listbox", { name: "Profesní role" })).not.toBeInTheDocument();
  });

  it("obě organizační obrazovky používají sdílený custom select", () => {
    const members = readFileSync(join(process.cwd(), "features/organization/ui/OrgMembersTab.tsx"), "utf8");
    const matrix = readFileSync(join(process.cwd(), "features/organization/ui/OrgRolePermissionsTab.tsx"), "utf8");

    expect(members).toContain("<ThemedSelect");
    expect(matrix).toContain("<ThemedSelect");
    expect(members).not.toContain("<select");
    expect(matrix).not.toContain("<select");
  });
});
