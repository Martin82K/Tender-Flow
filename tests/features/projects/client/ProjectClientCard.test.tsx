import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectClientCard } from "@features/projects/client/ui/ProjectClientCard";
import type { ProjectClientCard as Card } from "@/types";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@features/projects/client/clientCardApi", () => ({
  clientCardApi: api,
}));

const savedCard: Card = {
  companyName: "Javor Invest",
  ico: "74907026",
  street: "Lesní 1",
  zip: "110 00",
  city: "Praha",
  contactName: "Jana Nová",
  contactEmail: "jana@example.cz",
  contactPhone: "+420 777 123 456",
  internalNote: "Interní",
};

const renderCard = (props?: Partial<React.ComponentProps<typeof ProjectClientCard>>) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onCopyCustomerName = vi.fn();
  const view = render(
    <QueryClientProvider client={client}>
      <ProjectClientCard
        projectId="project-1"
        projectTitle="Bytový dům Javor"
        projectCode="project-1"
        organizationId="org-1"
        readOnly={false}
        financialCustomerName="Starý název"
        onCopyCustomerName={onCopyCustomerName}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { ...view, onCopyCustomerName };
};

describe("ProjectClientCard", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.save.mockReset();
    api.remove.mockReset();
    api.get.mockResolvedValue(null);
    api.save.mockImplementation(async (_projectId: string, _orgId: string, card: Card) => card);
    api.remove.mockResolvedValue(undefined);
  });

  it("ukáže prázdný stav a uloží novou kartu", async () => {
    renderCard();
    expect(await screen.findByText("Objednatel není vyplněn")).toBeInTheDocument();
    expect(screen.queryByText("Bez objednatele")).not.toBeInTheDocument();
    expect(screen.queryByText("Ve vývoji")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Doplnit" }));
    fireEvent.change(screen.getByLabelText("Ulice"), { target: { value: "Lesní 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
    expect(await screen.findByText(/Doplňte firmu nebo jméno/)).toBeInTheDocument();
    expect(api.save).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Firma nebo jméno"), { target: { value: "Javor Invest" } });
    fireEvent.change(screen.getByLabelText("IČO"), { target: { value: "74 907 026" } });
    fireEvent.change(screen.getByLabelText("PSČ"), { target: { value: "11000" } });
    fireEvent.change(screen.getByLabelText("Město"), { target: { value: "Praha" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));

    await waitFor(() => expect(api.save).toHaveBeenCalledWith("project-1", "org-1", expect.objectContaining({
      companyName: "Javor Invest",
      ico: "74907026",
      zip: "110 00",
      street: "Lesní 1",
      city: "Praha",
    })));
    expect(await screen.findByText("Javor Invest")).toBeInTheDocument();
  });

  it("načte uloženou kartu a úpravu zapíše znovu", async () => {
    api.get.mockResolvedValue(savedCard);
    renderCard();
    expect(await screen.findByText("Javor Invest")).toBeInTheDocument();
    expect(screen.getByText("Bytový dům Javor")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Upravit" }));
    fireEvent.change(screen.getByLabelText("Kontaktní osoba"), { target: { value: "Petr Malý" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));

    await waitFor(() => expect(api.save).toHaveBeenCalledWith("project-1", "org-1", expect.objectContaining({
      companyName: "Javor Invest",
      contactName: "Petr Malý",
    })));
  });

  it("na archivované stavbě nenabídne úpravu", async () => {
    api.get.mockResolvedValue(null);
    renderCard({ readOnly: true });
    expect(await screen.findByText("Objednatel není vyplněn")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Doplnit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upravit" })).not.toBeInTheDocument();
  });

  it("převezme jméno do smlouvy až po potvrzení", async () => {
    api.get.mockResolvedValue(savedCard);
    const { onCopyCustomerName } = renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Převzít jméno do smlouvy" }));
    expect(onCopyCustomerName).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Zrušit" }));
    expect(onCopyCustomerName).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Převzít jméno do smlouvy" }));
    fireEvent.click(screen.getByRole("button", { name: "Převzít jméno" }));
    await waitFor(() => expect(onCopyCustomerName).toHaveBeenCalledWith("Javor Invest"));
    expect(api.save).not.toHaveBeenCalled();
  });
});
