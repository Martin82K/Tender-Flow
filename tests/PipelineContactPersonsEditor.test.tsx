import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { PipelineContactPersonsEditor } from "@features/projects/pipeline/ui/PipelineContactPersonsEditor";
import type { ContactPerson } from "@/types";

const firstContact: ContactPerson = {
  id: "person-1",
  name: "Jan Novák",
  phone: "111",
  email: "jan@example.cz",
  position: "Hlavní kontakt",
};

describe("PipelineContactPersonsEditor", () => {
  it("neumožní odstranit jedinou kontaktní osobu", () => {
    render(
      <PipelineContactPersonsEditor
        contacts={[firstContact]}
        onChange={vi.fn()}
        createId={() => "person-2"}
      />,
    );

    expect(screen.queryByRole("button", { name: /Odstranit/ })).not.toBeInTheDocument();
  });

  it("přidá stabilně identifikovanou prázdnou osobu", () => {
    const onChange = vi.fn();
    render(
      <PipelineContactPersonsEditor
        contacts={[firstContact]}
        onChange={onChange}
        createId={() => "person-2"}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Přidat osobu" }));

    expect(onChange).toHaveBeenCalledWith([
      firstContact,
      {
        id: "person-2",
        name: "",
        phone: "",
        email: "",
        position: "",
      },
    ]);
  });

  it("aktualizuje pouze vybranou osobu a zachová pořadí", () => {
    const onChange = vi.fn();
    const secondContact: ContactPerson = {
      id: "person-2",
      name: "Eva Svobodová",
      phone: "222",
      email: "eva@example.cz",
      position: "Obchod",
    };
    render(
      <PipelineContactPersonsEditor
        contacts={[firstContact, secondContact]}
        onChange={onChange}
        createId={() => "person-3"}
      />,
    );

    fireEvent.change(screen.getAllByPlaceholderText("Jméno a Příjmení")[1], {
      target: { value: "Eva Nová" },
    });

    expect(onChange).toHaveBeenCalledWith([
      firstContact,
      { ...secondContact, name: "Eva Nová" },
    ]);
  });

  it("odstraní pouze zvolenou osobu", () => {
    const onChange = vi.fn();
    const secondContact: ContactPerson = {
      id: "person-2",
      name: "Eva Svobodová",
      phone: "222",
      email: "eva@example.cz",
    };
    render(
      <PipelineContactPersonsEditor
        contacts={[firstContact, secondContact]}
        onChange={onChange}
        createId={() => "person-3"}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Odstranit Eva Svobodová" }));

    expect(onChange).toHaveBeenCalledWith([firstContact]);
  });

  it("udržuje editor osob mimo legacy modal", () => {
    const source = readFileSync(
      join(process.cwd(), "features/projects/pipeline/ui/CreateContactModal.tsx"),
      "utf8",
    );

    expect(source).toContain(
      'from "@features/projects/pipeline/ui/PipelineContactPersonsEditor"',
    );
    expect(source).not.toContain("handleAddContactPerson");
    expect(source).not.toContain('placeholder="Jméno a Příjmení"');
  });
});
