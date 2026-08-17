import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/shared/ui/Button";

describe("Button", () => {
  it("staví sdílená tlačítka na Appica primitivu", () => {
    render(<Button variant="primary">Uložit</Button>);

    expect(screen.getByRole("button", { name: "Uložit" })).toHaveAttribute(
      "data-slot",
      "button",
    );
  });

  it("zachová sémantickou variantu pro skin", () => {
    render(<Button variant="danger">Smazat</Button>);

    expect(screen.getByRole("button", { name: "Smazat" })).toHaveAttribute(
      "data-tf-variant",
      "danger",
    );
  });

  it("zachová success a warning jako samostatné varianty i mimo TF Space", () => {
    render(
      <>
        <Button variant="success">Hotovo</Button>
        <Button variant="warning">Pozor</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Hotovo" })).toHaveClass(
      "tf-button-success",
    );
    expect(screen.getByRole("button", { name: "Pozor" })).toHaveClass(
      "tf-button-warning",
    );
  });
});
