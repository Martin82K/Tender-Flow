import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectDetails } from "@/types";
import { PROJECT_DETAILS_KEYS } from "@shared/queryKeys/projectDetailKeys";
const state = vi.hoisted(() => ({ bids: vi.fn(), project: vi.fn(), categories: vi.fn() }));
vi.mock("@features/projects/api/projectBidsApi", () => ({ fetchProjectBids: state.bids }));
vi.mock("@infra/db/dbAdapter", () => ({ dbAdapter: { from: (table: string) => ({
  select: () => ({ eq: () => table === "projects"
    ? { abortSignal: () => ({ maybeSingle: state.project }) }
    : { in: () => ({ abortSignal: state.categories }) } }),
}) } }));
import { refreshProjectBidCategories } from "@features/projects/model/refreshProjectBidCategories";
const key = PROJECT_DETAILS_KEYS.detail("p1");
const original = { id: "p1", title: "Project", categories: [{ id: "c1", subcontractorCount: 1 }, { id: "c2", subcontractorCount: 1 }], bids: { c1: [{ id: "old" }], c2: [{ id: "untouched" }] }, contract: { maturity: 45 } } as ProjectDetails;
const setup = () => {
  const client = new QueryClient(); client.setQueryData(key, original, { updatedAt: 100 });
  const controller = new AbortController();
  return { client, controller, run: () => refreshProjectBidCategories(client, "p1", ["c1"], controller.signal) };
};
beforeEach(() => { vi.resetAllMocks(); state.project.mockResolvedValue({ data: { id: "p1" }, error: null }); state.categories.mockResolvedValue({data: [{id:"c1"}], error: null}); state.bids.mockResolvedValue({ c1: [{ id: "new" }] }); });
describe("category snapshot safety", () => {
  it("replaces only the affected category and preserves metadata freshness", async () => {
    const { client, run } = setup(); await run();
    expect(client.getQueryData(key)).toMatchObject({ title: "Project", bids: { c1: [{ id: "new" }], c2: [{ id: "untouched" }] }, contract: { maturity: 45 }, categories: [{ subcontractorCount: 1 }, { subcontractorCount: 1 }] });
    expect(client.getQueryState(key)?.dataUpdatedAt).toBe(100);
  });
  it("removes deleted or no-longer-visible bids from the affected category", async () => {
    state.bids.mockResolvedValue({}); const { client, run } = setup(); await run();
    expect(client.getQueryData<ProjectDetails>(key)?.bids.c1).toEqual([]);
    expect(client.getQueryData<ProjectDetails>(key)?.categories[0].subcontractorCount).toBe(0);
  });
  it("clears the full cached project after confirmed access revocation", async () => {
    state.project.mockResolvedValue({ data: null, error: null }); state.bids.mockRejectedValue(new Error("permission changed")); const { client, run } = setup(); await run(); expect(client.getQueryData(key)).toBeNull();
  });
  it("requests full reconciliation when category or pipeline access disappears", async () => {
    state.categories.mockResolvedValue({ data: [], error: null });
    const { run } = setup(); expect(await run()).toBe("full");
  });
  it("does not interpret network failure as deletion", async () => {
    state.project.mockResolvedValue({ data: null, error: new Error("network") }); const { client, run } = setup(); await expect(run()).rejects.toThrow("network"); expect(client.getQueryData(key)).toEqual(original);
  });
  it("does not overwrite a newer local write", async () => {
    let finish!: (value: Record<string, unknown[]>) => void; state.bids.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { client, run } = setup(); const result = run();
    client.setQueryData(key, { ...original, bids: { ...original.bids, c1: [{ id: "saved-during-fetch" }] } });
    finish({ c1: [{ id: "stale" }] }); expect(await result).toBe("retry");
    expect(client.getQueryData<ProjectDetails>(key)?.bids.c1[0].id).toBe("saved-during-fetch");
  });
  it("does not resurrect cache cleared on logout or update another account's query", async () => {
    let finish!: (value: Record<string, unknown[]>) => void; state.bids.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { client, run } = setup(); const result = run(); client.clear(); client.setQueryData(key, { ...original, title: "New session" });
    finish({ c1: [{ id: "stale" }] }); expect(await result).toBe("skipped");
    expect(client.getQueryData<ProjectDetails>(key)?.title).toBe("New session"); expect(client.getQueryData<ProjectDetails>(key)?.bids).toEqual(original.bids);
  });
  it("does not overlap a running full snapshot", async () => {
    const { client, run } = setup(); client.getQueryCache().find({ queryKey: key })!.setState({ fetchStatus: "fetching" });
    expect(await run()).toBe("retry"); expect(state.bids).not.toHaveBeenCalled();
  });
  it("ignores an aborted response even when the transport finishes", async () => {
    const { client, controller, run } = setup(); const result = run(); controller.abort(); expect(await result).toBe("skipped"); expect(client.getQueryData(key)).toEqual(original);
  });
});
