import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectDetails } from "@/types";

type SubscriptionOptions = {
  onBidUpdated: (categoryId: string | null) => void;
  onSubscriptionError?: () => void;
  onReconnected?: () => void;
};
const state = vi.hoisted(() => ({
  subscriptions: [] as SubscriptionOptions[], cleanup: vi.fn(), subscribe: vi.fn(),
  refresh: vi.fn(), notify: vi.fn(),
}));
vi.mock("@features/projects/api/projectBidRealtimeApi", () => ({
  projectBidRealtimeApi: { subscribeToBidUpdates: state.subscribe },
}));
vi.mock("@features/projects/model/refreshProjectBidCategories", () => ({
  refreshProjectBidCategories: state.refresh,
}));
vi.mock("@features/projects/model/projectBidEvents", () => ({ notifyProjectBidsPersisted: state.notify }));
import { useProjectBidRealtimeSync } from "@features/projects/hooks/useProjectBidRealtimeSync";
import { PROJECT_DETAILS_KEYS } from "@shared/queryKeys/projectDetailKeys";

const details = {
  p1: { id: "p1", categories: [{ id: "c1" }, { id: "c2" }], bids: {} },
  p2: { id: "p2", categories: [{ id: "c3" }], bids: {} },
} as Record<string, ProjectDetails>;
function setup(selectedProjectId: string | null = "p1", enabled = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  Object.values(details).forEach(project => client.setQueryData(PROJECT_DETAILS_KEYS.detail(project.id!), project));
  const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue();
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook((props: {selectedProjectId: string | null; enabled: boolean}) => useProjectBidRealtimeSync({ allProjectDetails: details, ...props }), {
    wrapper, initialProps: { selectedProjectId, enabled },
  });
  return { ...hook, client, invalidate };
}
const tick = async (ms = 300) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const event = (id: string | null) => act(() => state.subscriptions[0].onBidUpdated(id));

describe("project bid refresh scheduling", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks(); state.subscriptions = [];
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    state.subscribe.mockImplementation((options: SubscriptionOptions) => { state.subscriptions.push(options); return state.cleanup; });
    state.refresh.mockResolvedValue("applied");
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("coalesces a burst into one category refresh without refetching project metadata", async () => {
    const { invalidate } = setup();
    event("c1"); event("c1"); event("c2"); await tick();
    expect(state.refresh).toHaveBeenCalledOnce();
    expect(state.refresh.mock.calls[0].slice(1, 3)).toEqual(["p1", ["c1", "c2"]]);
    expect(invalidate).not.toHaveBeenCalled(); expect(state.notify).toHaveBeenCalledOnce();
  });
  it("marks another cached project stale without fetching it", async () => {
    const { invalidate } = setup(); event("c3"); await tick();
    expect(state.refresh).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: PROJECT_DETAILS_KEYS.detail("p2"), exact: true, refetchType: "none" });
  });
  it("uses a full refresh for unknown categories and retains the minute deletion fallback", async () => {
    const { invalidate } = setup(); event(null); await tick(); await tick(60_000);
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenLastCalledWith({ queryKey: PROJECT_DETAILS_KEYS.detail("p1"), exact: true, refetchType: "active" }, { cancelRefetch: false });
  });
  it("does not poll or process realtime while hidden, then reconciles once on return", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get");
    const { invalidate } = setup(); visibility.mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    event("c1"); await tick(120_000);
    expect(invalidate).not.toHaveBeenCalled(); expect(state.refresh).not.toHaveBeenCalled();
    visibility.mockReturnValue("visible"); act(() => document.dispatchEvent(new Event("visibilitychange"))); await tick();
    expect(invalidate).toHaveBeenCalledOnce(); expect(state.refresh).not.toHaveBeenCalled();
  });
  it("reconciles on reconnect and ignores repeated subscription errors in the same burst", async () => {
    const { invalidate } = setup();
    act(() => { state.subscriptions[0].onSubscriptionError?.(); state.subscriptions[0].onSubscriptionError?.(); state.subscriptions[0].onReconnected?.(); });
    await tick(); expect(invalidate).toHaveBeenCalledOnce();
  });
  it("pauses offline and reconciles on online", async () => {
    const online = vi.spyOn(navigator, "onLine", "get"); const { invalidate } = setup();
    online.mockReturnValue(false); event("c1"); await tick(60_000);
    expect(state.refresh).not.toHaveBeenCalled(); expect(invalidate).not.toHaveBeenCalled();
    online.mockReturnValue(true); act(() => window.dispatchEvent(new Event("online"))); await tick();
    expect(invalidate).toHaveBeenCalledOnce();
  });
  it("keeps one request in flight and reconciles events arriving during it", async () => {
    let finish!: (result: string) => void;
    state.refresh.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    setup(); event("c1"); await tick(); event("c2"); await tick();
    expect(state.refresh).toHaveBeenCalledOnce();
    await act(async () => finish("applied")); await tick();
    expect(state.refresh).toHaveBeenCalledTimes(2);
    expect(state.refresh.mock.calls[1][2]).toEqual(["c2"]);
  });
  it("falls back to a full query on partial refresh failure", async () => {
    state.refresh.mockRejectedValueOnce(new Error("offline")); const { invalidate } = setup();
    event("c1"); await tick(1_000); expect(invalidate).toHaveBeenCalledOnce();
  });
  it("reconciles all data when partial refresh detects revoked category access", async () => {
    state.refresh.mockResolvedValueOnce("full"); const { invalidate } = setup();
    event("c1"); await tick(1_000); expect(invalidate).toHaveBeenCalledOnce();
  });
  it("cancels pending work when project or auth scope changes", async () => {
    const { rerender, invalidate } = setup(); event("c1"); rerender({ selectedProjectId: "p2", enabled: true }); await tick();
    expect(state.refresh).not.toHaveBeenCalled();
    event("c3"); rerender({ selectedProjectId: "p2", enabled: false }); await tick(60_000);
    expect(state.refresh).not.toHaveBeenCalled(); expect(invalidate).not.toHaveBeenCalled();
  });
  it("does not start subscriptions or polling while disabled", async () => {
    const { invalidate } = setup("p1", false); await tick(60_000);
    expect(state.subscribe).not.toHaveBeenCalled(); expect(invalidate).not.toHaveBeenCalled();
  });
  it("keeps realtime outside the detail but starts no polling", async () => {
    const { invalidate } = setup(null); await tick(60_000);
    expect(state.subscribe).toHaveBeenCalledOnce(); expect(invalidate).not.toHaveBeenCalled();
  });
  it("aborts in-flight category work and cleans up listeners on unmount", async () => {
    const { unmount, invalidate } = setup(); event("c1"); await tick();
    const signal = state.refresh.mock.calls[0][3] as AbortSignal;
    unmount(); await tick(60_000); act(() => window.dispatchEvent(new Event("online")));
    expect(signal.aborted).toBe(true); expect(state.cleanup).toHaveBeenCalledOnce(); expect(invalidate).not.toHaveBeenCalled();
  });
});
