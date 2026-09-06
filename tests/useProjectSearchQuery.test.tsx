import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import type { Project } from "@/types";
const mocks = vi.hoisted(() => ({ from: vi.fn(), range: vi.fn(), select: vi.fn(), ids: [] as string[] }));
vi.mock("@infra/db/dbAdapter", () => ({ dbAdapter: { from: mocks.from } }));
vi.mock("@features/projects/api/projectDemoDataApi", () => ({ projectDemoDataApi: {
  isDemoSession: () => false, isDemoProjectId: (id: string) => id === "demo",
  getProjectDetails: () => ({ title: "Demo", categories: [{ id: "demo-cat", title: "Demo kategorie" }] }),
} }));
import { useProjectSearchQuery } from "@features/projects/hooks/useProjectSearchQuery";
const project = (id: string): Project => ({ id, name: id, status: "tender", location: "Praha" });
const setup = (projects = [project("p1")]) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(({ userId, projects }) => useProjectSearchQuery({ userId, projects }), {
    initialProps: { userId: "u1", projects },
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.range.mockResolvedValue({ data: [], error: null });
  mocks.from.mockImplementation(() => ({ select: mocks.select.mockImplementation(() => ({
    in: (_key: string, ids: string[]) => { mocks.ids = ids; return { order: () => ({ range: mocks.range }) }; },
  })) }));
});
it("does not load before search opens and paginates every category of unopened visible projects", async () => {
  mocks.range.mockImplementation(async (start: number, end: number) => ({ data: Array.from({ length: Math.max(0, Math.min(end + 1, 1201) - start) }, (_, i) => ({
    id: `c${i + start}`, project_id: "p1", title: `Category ${i + start}`, description: "Popis", work_items: ["Práce"],
  })), error: null }));
  const { result } = setup();
  expect(mocks.from).not.toHaveBeenCalled();
  act(() => result.current.requestSearch());
  await waitFor(() => expect(result.current.data?.p1.categories).toHaveLength(1201));
  expect(mocks.from.mock.calls.every(([table]) => table === "demand_categories")).toBe(true);
  expect(mocks.select).toHaveBeenCalledWith("id,project_id,title,description,work_items");
  expect(mocks.range).toHaveBeenCalledTimes(3);
  expect(mocks.ids).toEqual(["p1"]);
  expect(result.current.data?.p1.categories[1200].workItems).toEqual(["Práce"]);
});
it("drops old search data immediately when user or visible project permissions change", async () => {
  mocks.range.mockResolvedValue({ data: [{ id: "c1", project_id: "p1", title: "Private" }, { id: "c2", project_id: "hidden", title: "Hidden" }], error: null });
  const { result, rerender } = setup();
  act(() => result.current.requestSearch());
  await waitFor(() => expect(result.current.data?.p1.categories).toHaveLength(1));
  expect(result.current.data?.hidden).toBeUndefined();
  mocks.range.mockReturnValue(new Promise(() => {}));
  rerender({ userId: "u2", projects: [project("p2")] });
  expect(result.current.data?.p1).toBeUndefined();
  const calls = mocks.range.mock.calls.length;
  rerender({ userId: "u2", projects: [] });
  expect(mocks.range).toHaveBeenCalledTimes(calls);
  act(() => result.current.requestSearch());
  await waitFor(() => expect(result.current.data).toEqual({}));
});
it("reports a failed page and retries the complete index without duplicates", async () => {
  mocks.range.mockResolvedValueOnce({ data: null, error: new Error("failed") });
  const { result } = setup();
  act(() => result.current.requestSearch());
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();
  await act(async () => { await result.current.refetch(); });
  await waitFor(() => expect(result.current.data?.p1.categories).toEqual([]));
});
it("chunks large portfolios and keeps demo search local", async () => {
  const { result } = setup([...Array.from({ length: 205 }, (_, i) => project(`p${i}`)), project("demo")]);
  act(() => result.current.requestSearch());
  await waitFor(() => expect(Object.keys(result.current.data ?? {})).toHaveLength(206));
  expect(mocks.range).toHaveBeenCalledTimes(3);
  expect(result.current.data?.demo.categories[0].id).toBe("demo-cat");
});

it("requires a fresh search request after logout and login in the same desktop renderer", async () => {
  const { result, rerender } = setup();
  act(() => result.current.requestSearch());
  await waitFor(() => expect(result.current.data?.p1).toBeDefined());
  const calls = mocks.from.mock.calls.length;
  rerender({ userId: "", projects: [] });
  rerender({ userId: "u2", projects: [project("p2")] });
  expect(mocks.from).toHaveBeenCalledTimes(calls);
  act(() => result.current.requestSearch());
  await waitFor(() => expect(result.current.data?.p2).toBeDefined());
});
