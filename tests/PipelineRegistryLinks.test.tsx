import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const platformMocks = vi.hoisted(() => ({
  openExternal: vi.fn(),
}));

vi.mock("@infra/platform/platformAdapter", () => ({
  isDesktop: true,
  shellAdapter: {
    openExternal: platformMocks.openExternal,
  },
}));

import { PipelineRegistryLinks } from "@features/projects/pipeline/ui/PipelineRegistryLinks";

describe("PipelineRegistryLinks", () => {
  beforeEach(() => {
    platformMocks.openExternal.mockReset();
    platformMocks.openExternal.mockResolvedValue(undefined);
  });

  it("nevykreslí registry pro prázdné nebo zástupné IČO", () => {
    const { rerender } = render(<PipelineRegistryLinks ico="  " />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    rerender(<PipelineRegistryLinks ico="—" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("vytvoří pouze pevné registry a bezpečně zakóduje IČO", () => {
    render(<PipelineRegistryLinks ico=" 123&redirect=evil " />);

    expect(screen.getByRole("link", { name: /ARES/ })).toHaveAttribute(
      "href",
      "https://ares.gov.cz/ekonomicke-subjekty?ico=123%26redirect%3Devil",
    );
    expect(screen.getByRole("link", { name: /RŽP/ })).toHaveAttribute(
      "href",
      "https://rzp.gov.cz/portal/cs/vyhledani?q=123%26redirect%3Devil",
    );
    expect(screen.getByRole("link", { name: /^RES/ })).toHaveAttribute(
      "href",
      "https://or.justice.cz/ias/ui/rejstrik-$firma?ico=123%26redirect%3Devil",
    );

    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("otevře registry v desktop shellu a nepropaguje kliknutí", async () => {
    const onParentClick = vi.fn();
    render(
      <div onClick={onParentClick}>
        <PipelineRegistryLinks ico="12345678" />
      </div>,
    );

    fireEvent.click(screen.getByRole("link", { name: /ARES/ }));

    await waitFor(() => {
      expect(platformMocks.openExternal).toHaveBeenCalledWith(
        "https://ares.gov.cz/ekonomicke-subjekty?ico=12345678",
      );
    });
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it("udržuje registry mimo legacy modal", () => {
    const source = readFileSync(
      join(process.cwd(), "features/projects/pipeline/ui/CreateContactModal.tsx"),
      "utf8",
    );

    expect(source).toContain(
      'from "@features/projects/pipeline/ui/PipelineRegistryLinks"',
    );
    expect(source).not.toContain("https://ares.gov.cz");
    expect(source).not.toContain("handleRegistryLinkClick");
  });
});
