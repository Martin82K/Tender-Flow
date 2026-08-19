import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ThemedSelect } from "@shared/ui/ThemedSelect";
import { ThemedNativeSelect } from "@shared/ui/ThemedNativeSelect";

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

  it("zavře portál nabídky, když focus opustí celý select", () => {
    render(
      <>
        <ThemedSelect
          ariaLabel="Stav kontaktu"
          value="active"
          onChange={vi.fn()}
          options={[
            { value: "active", label: "Aktivní" },
            { value: "inactive", label: "Neaktivní" },
          ]}
        />
        <button type="button">Další pole</button>
      </>,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Stav kontaktu" }));
    expect(screen.getByRole("listbox", { name: "Stav kontaktu" })).toBeInTheDocument();

    fireEvent.focus(screen.getByRole("button", { name: "Další pole" }));

    expect(screen.queryByRole("listbox", { name: "Stav kontaktu" })).not.toBeInTheDocument();
  });

  it("nabídne vyhledávání u dlouhého seznamu a filtruje bez ztráty vybrané hodnoty", () => {
    render(
      <ThemedSelect
        ariaLabel="Specializace"
        value="all"
        onChange={vi.fn()}
        searchable
        options={[
          { value: "all", label: "Všechny specializace" },
          { value: "beton", label: "Betony" },
          { value: "bourani", label: "Bourací práce" },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Specializace" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Hledat v nabídce Specializace" }), {
      target: { value: "bour" },
    });

    expect(screen.getByRole("option", { name: "Bourací práce" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Betony" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Specializace" })).toHaveTextContent("Všechny specializace");
  });

  it("kompatibilní náhrada předá původní change událost a zachová formulářové jméno", () => {
    const onChange = vi.fn();
    const Harness = () => {
      const [value, setValue] = React.useState("all");
      return (
        <ThemedNativeSelect
          aria-label="Stav"
          name="status"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setValue(event.target.value);
          }}
        >
          <option value="all">Všechny stavy</option>
          <option value="active">Aktivní</option>
        </ThemedNativeSelect>
      );
    };
    const { container } = render(
      <Harness />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Stav" }));
    fireEvent.click(screen.getByRole("option", { name: "Aktivní" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("active");
    expect(container.querySelector('select[name="status"]')).toHaveValue("active");
  });

  it("zachová selectedOptions a ovládání vícenásobného výběru", () => {
    const onChange = vi.fn();
    const Harness = () => {
      const [value, setValue] = React.useState<string[]>(["first"]);
      return (
        <ThemedNativeSelect
          aria-label="Navázané záznamy"
          name="records"
          multiple
          value={value}
          onChange={(event) => {
            const nextValue = Array.from(event.target.selectedOptions, (option) => option.value);
            onChange(nextValue);
            setValue(nextValue);
          }}
        >
          <option value="first">První</option>
          <option value="second">Druhý</option>
        </ThemedNativeSelect>
      );
    };

    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole("option", { name: "Druhý" }));

    expect(onChange).toHaveBeenCalledWith(["first", "second"]);
    expect(container.querySelector('select[name="records"]')).toHaveValue(["first", "second"]);
    expect(screen.getByRole("option", { name: "Druhý" })).toHaveAttribute("aria-selected", "true");
  });

  it("ovládá vícenásobný výběr šipkami, Home, End a rozsahem se Shift", () => {
    const onChange = vi.fn();
    const Harness = () => {
      const [value, setValue] = React.useState<string[]>(["first"]);
      return (
        <ThemedNativeSelect
          aria-label="Profese"
          multiple
          value={value}
          onChange={(event) => {
            const nextValue = Array.from(event.target.selectedOptions, (option) => option.value);
            onChange(nextValue);
            setValue(nextValue);
          }}
        >
          <option value="first">První</option>
          <option value="second">Druhá</option>
          <option value="third">Třetí</option>
        </ThemedNativeSelect>
      );
    };

    render(<Harness />);
    const first = screen.getByRole("option", { name: "První" });
    const second = screen.getByRole("option", { name: "Druhá" });
    const third = screen.getByRole("option", { name: "Třetí" });

    expect(first).toHaveAttribute("tabindex", "0");
    expect(second).toHaveAttribute("tabindex", "-1");

    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute("tabindex", "0");
    expect(first).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(second, { key: "ArrowDown", shiftKey: true });
    expect(third).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith(["first", "second", "third"]);

    fireEvent.keyDown(third, { key: "Home" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "End" });
    expect(third).toHaveFocus();
  });

  it("zachová vazbu externího labelu na viditelný ovládací prvek", () => {
    render(
      <>
        <label htmlFor="display-limit">Max zobrazení</label>
        <ThemedNativeSelect id="display-limit" value="auto" onChange={vi.fn()}>
          <option value="auto">Auto</option>
          <option value="25">25</option>
        </ThemedNativeSelect>
      </>,
    );

    expect(screen.getByLabelText("Max zobrazení")).toHaveAttribute("role", "combobox");
    expect(document.querySelector("select")).toHaveAttribute("id", "display-limit-native");
  });

  it("obě organizační obrazovky používají sdílený custom select", () => {
    const members = readFileSync(join(process.cwd(), "features/organization/ui/OrgMembersTab.tsx"), "utf8");
    const matrix = readFileSync(join(process.cwd(), "features/organization/ui/OrgRolePermissionsTab.tsx"), "utf8");

    expect(members).toContain("<ThemedSelect");
    expect(matrix).toContain("<ThemedSelect");
    expect(members).not.toContain("<select");
    expect(matrix).not.toContain("<select");
  });

  it("správa realizačního týmu používá stejný skinovaný výběr", () => {
    const team = readFileSync(join(process.cwd(), "features/projects/team/ProjectTeamSettings.tsx"), "utf8");

    expect(team).toContain("<ThemedSelect");
    expect(team).not.toContain("<select");
    expect(team).toContain('ariaLabel="Vyberte člena organizace"');
  });
});
