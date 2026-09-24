import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  tables: [] as string[],
  changed: undefined as undefined | ((payload: { new: Record<string, unknown> }) => void),
  bids: [{ id: "bid-1", demand_category_id: "c1", company_name: "Původní dodavatel", status: "offer" }],
  visible: true,
}));
vi.mock("@infra/db/dbAdapter", () => ({ dbAdapter: {
  from: (table: string) => {
    state.tables.push(table);
    const response = () => Promise.resolve({ data: table === "projects" ? (state.visible ? { id: "p1", name: "Projekt" } : null)
      : table === "demand_categories" ? (state.visible ? [{ id: "c1", title: "Kategorie" }] : [])
      : table === "bids" ? state.bids : [], error: null });
    const builder = { select: () => builder, eq: () => builder, in: () => builder, order: () => builder, abortSignal: () => builder,
      maybeSingle: () => builder, then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => response().then(resolve, reject) };
    return builder;
  },
  channel: () => { const channel = { on: (_kind: unknown, _filter: unknown, callback: typeof state.changed) => { state.changed = callback; return channel; }, subscribe: () => channel }; return channel; },
  removeChannel: vi.fn(),
} }));
vi.mock("@features/projects/api/projectDemoDataApi", () => ({ projectDemoDataApi: { isDemoSession: () => false, isDemoProjectId: () => false } }));
import { useProjectDetailsQuery } from "@features/projects/hooks/useProjectDetailsQuery";
import { useProjectBidRealtimeSync } from "@features/projects/hooks/useProjectBidRealtimeSync";
function Detail() {
  const query = useProjectDetailsQuery("p1");
  useProjectBidRealtimeSync({ selectedProjectId: "p1", allProjectDetails: query.data ? { p1: query.data } : {} });
  return <main>{query.data === null ? "Přístup odebrán" : query.data ? <><h1>{query.data.title}</h1><ul>{Object.values(query.data.bids).flat().map(bid => <li key={bid.id}>{bid.companyName}</li>)}</ul></> : "Načítání"}</main>;
}
const tick = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
beforeEach(() => { vi.useFakeTimers(); state.tables=[]; state.visible=true; vi.spyOn(document,"visibilityState","get").mockReturnValue("visible"); vi.spyOn(navigator,"onLine","get").mockReturnValue(true); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it("loads a project, refreshes an external bid without finance reads, reconciles deletion and clears revoked data", async () => {
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  const {unmount}=render(<QueryClientProvider client={client}><Detail /></QueryClientProvider>);
  await tick(20); expect(screen.getByRole("heading",{name:"Projekt"})).toBeInTheDocument();
  expect(screen.getByText("Původní dodavatel")).toBeInTheDocument(); expect(state.tables).toHaveLength(8);
  state.tables=[]; state.bids=[{...state.bids[0],company_name:"Změna z druhého zařízení"}];
  act(()=>{state.changed?.({new:{demand_category_id:"c1"}});state.changed?.({new:{demand_category_id:"c1"}});});
  await tick(300); expect(screen.getByText("Změna z druhého zařízení")).toBeInTheDocument();
  expect(state.tables).toEqual(["projects","demand_categories","bids"]);
  state.bids=[]; await tick(60_000); expect(screen.queryByText("Změna z druhého zařízení")).not.toBeInTheDocument();
  state.visible=false; await tick(60_000); expect(screen.getByText("Přístup odebrán")).toBeInTheDocument();
  unmount(); client.clear();
});
