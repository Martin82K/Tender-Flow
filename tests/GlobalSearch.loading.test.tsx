import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { GlobalSearch } from "@shared/ui/GlobalSearch/GlobalSearch";
import { GlobalSearchProvider } from "@shared/ui/GlobalSearch/GlobalSearchContext";
import type { SearchInputSources } from "@shared/ui/GlobalSearch/types";
const view = (sources: SearchInputSources, isOpen = true) => <GlobalSearchProvider sources={sources}>
  <GlobalSearch variant="modal" isOpen={isOpen} onOpenChange={vi.fn()} />
</GlobalSearchProvider>;
it("loads the search index on opening and avoids an empty result claim while loading or failed", async () => {
  const requestSearch = vi.fn();
  const retryProjectSearch = vi.fn();
  const sources = { projects: [], contacts: [], projectDetails: {}, requestSearch, retryProjectSearch, isProjectSearchLoading: true };
  const { rerender } = render(view(sources, false));
  expect(requestSearch).not.toHaveBeenCalled();
  rerender(view(sources));
  expect(requestSearch).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "okna" } });
  expect(screen.getByRole("status")).toHaveTextContent("Načítám podklady");
  expect(screen.queryByText(/Žádné výsledky/)).not.toBeInTheDocument();
  rerender(view({ ...sources, isProjectSearchLoading: false, projectSearchError: true }));
  expect(screen.getByRole("alert")).toHaveTextContent("Výsledky mohou být neúplné");
  expect(screen.queryByText(/Žádné výsledky/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Zkusit znovu" }));
  expect(retryProjectSearch).toHaveBeenCalledTimes(1);
  rerender(view({ ...sources, isProjectSearchLoading: false }));
  await waitFor(() => expect(screen.getByText(/Žádné výsledky/)).toBeInTheDocument());
});
