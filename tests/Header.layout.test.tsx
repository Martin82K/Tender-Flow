import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Header } from "@/shared/ui/Header";
import { AccountMenuProvider } from "@/shared/ui/AccountMenuContext";

describe("Header layout", () => {
  it("umí vykreslit kontext nahoře a navigaci ve spodním řádku", () => {
    render(
      <AccountMenuProvider accountMenu={<button type="button">Avatar</button>}>
        <Header title="REKO Bazén Aš" subtitle="V realizaci" showSearch={false} childrenBelow>
          <nav aria-label="Projektové sekce">
            <button type="button">Přehled</button>
            <button type="button">Dokumenty</button>
          </nav>
        </Header>
      </AccountMenuProvider>,
    );

    const header = screen.getByRole("banner");
    const title = screen.getByRole("heading", { name: "REKO Bazén Aš" });
    const nav = screen.getByRole("navigation", { name: "Projektové sekce" });

    expect(header).toContainElement(title);
    expect(header).toContainElement(nav);
    expect(title.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: "Avatar" })).toBeInTheDocument();
  });

  it("umí schovat account menu pro vnořený toolbar", () => {
    render(
      <AccountMenuProvider accountMenu={<button type="button">Avatar</button>}>
        <Header title="AL Výplně otvorů" subtitle="REKO Bazén Aš > Průběh výběrového řízení" showSearch={false} showAccountMenu={false}>
          <button type="button">Email nevybraným</button>
        </Header>
      </AccountMenuProvider>,
    );

    expect(screen.getByRole("button", { name: "Email nevybraným" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Avatar" })).not.toBeInTheDocument();
  });

  it("v industriálním skinu zvýrazní Bazén psaným fontem", () => {
    render(
      <AccountMenuProvider accountMenu={null}>
        <Header title="REKO Bazén Aš" showSearch={false} skin="industrial" />
      </AccountMenuProvider>,
    );

    const title = screen.getByRole("heading", { name: "REKO Bazén Aš" });
    const scriptPart = screen.getByText("Bazén");

    expect(title).toContainElement(scriptPart);
    expect(scriptPart).toHaveClass("tf-skin-script");
  });

  it("v industriálním skinu zvýrazní typ stavby i v titulku jiného projektu", () => {
    render(
      <AccountMenuProvider accountMenu={null}>
        <Header
          title="25036 Statické zajištění silnice Oloví - Boučí, 2.etapa"
          showSearch={false}
          skin="industrial"
        />
      </AccountMenuProvider>,
    );

    const title = screen.getByRole("heading", {
      name: "25036 Statické zajištění silnice Oloví - Boučí, 2.etapa",
    });
    const scriptPart = screen.getByText("Statické zajištění silnice");

    expect(title).toContainElement(scriptPart);
    expect(scriptPart).toHaveClass("tf-skin-script");
  });
});
