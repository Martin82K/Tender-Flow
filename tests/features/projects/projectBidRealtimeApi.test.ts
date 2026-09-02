import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  changeHandler: undefined as undefined | ((payload: { new?: Record<string, unknown> }) => void),
  statusHandler: undefined as undefined | ((status: string) => void),
  channel: { id: "bid-channel" },
  on: vi.fn(),
  subscribe: vi.fn(),
  removeChannel: vi.fn(),
}));

vi.mock("@infra/db/dbAdapter", () => ({
  dbAdapter: {
    channel: vi.fn(() => ({
      on: state.on,
    })),
    removeChannel: state.removeChannel,
  },
}));

import { projectBidRealtimeApi } from "@features/projects/api/projectBidRealtimeApi";

describe("projectBidRealtimeApi", () => {
  beforeEach(() => {
    state.changeHandler = undefined;
    state.statusHandler = undefined;
    state.on.mockReset();
    state.subscribe.mockReset();
    state.removeChannel.mockReset();
    state.on.mockImplementation((_kind, _filter, handler) => {
      state.changeHandler = handler;
      return { subscribe: state.subscribe };
    });
    state.subscribe.mockImplementation((handler) => {
      state.statusHandler = handler;
      return state.channel;
    });
  });

  it("odebírá pouze UPDATE události nabídek a předá ID kategorie", () => {
    const onBidUpdated = vi.fn();

    projectBidRealtimeApi.subscribeToBidUpdates({ onBidUpdated });
    state.changeHandler?.({ new: { demand_category_id: "category-1" } });

    expect(state.on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "bids" },
      expect.any(Function),
    );
    expect(onBidUpdated).toHaveBeenCalledWith("category-1");
  });

  it("ohlásí výpadek a při cleanup odstraní kanál", () => {
    const onSubscriptionError = vi.fn();
    const cleanup = projectBidRealtimeApi.subscribeToBidUpdates({
      onBidUpdated: vi.fn(),
      onSubscriptionError,
    });

    state.statusHandler?.("TIMED_OUT");
    cleanup();

    expect(onSubscriptionError).toHaveBeenCalledOnce();
    expect(state.removeChannel).toHaveBeenCalledWith(state.channel);
  });
});
