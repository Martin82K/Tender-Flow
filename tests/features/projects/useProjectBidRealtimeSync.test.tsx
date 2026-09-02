import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectDetails } from "@/types";

type SubscriptionOptions = {
  onBidUpdated: (demandCategoryId: string | null) => void;
  onSubscriptionError?: () => void;
};

const state = vi.hoisted(() => ({
  subscriptions: [] as SubscriptionOptions[],
  cleanup: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock("@features/projects/api/projectBidRealtimeApi", () => ({
  projectBidRealtimeApi: {
    subscribeToBidUpdates: state.subscribe,
  },
}));

import { useProjectBidRealtimeSync } from "@features/projects/hooks/useProjectBidRealtimeSync";
import { PROJECT_DETAILS_KEYS } from "@features/projects/hooks/useProjectDetailsQuery";

const projectDetails = {
  "project-1": {
    id: "project-1",
    categories: [{ id: "category-1" }],
  },
  "project-2": {
    id: "project-2",
    categories: [{ id: "category-2" }],
  },
} as Record<string, ProjectDetails>;

describe("useProjectBidRealtimeSync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    state.subscriptions = [];
    state.cleanup.mockReset();
    state.subscribe.mockReset();
    state.subscribe.mockImplementation((options: SubscriptionOptions) => {
      state.subscriptions.push(options);
      return state.cleanup;
    });
  });

  it("obnoví pouze projekt odpovídající změně nabídky", () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(
      () => useProjectBidRealtimeSync({ allProjectDetails: projectDetails, selectedProjectId: "project-2" }),
      { wrapper },
    );

    act(() => state.subscriptions[0].onBidUpdated("category-1"));

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: PROJECT_DETAILS_KEYS.detail("project-1"),
      exact: true,
      refetchType: "active",
    });
  });

  it("při neznámé kategorii a při výpadku obnoví otevřený projekt", () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(
      () => useProjectBidRealtimeSync({ allProjectDetails: projectDetails, selectedProjectId: "project-2" }),
      { wrapper },
    );

    act(() => state.subscriptions[0].onBidUpdated(null));
    act(() => vi.advanceTimersByTime(60_000));

    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenLastCalledWith({
      queryKey: PROJECT_DETAILS_KEYS.detail("project-2"),
      exact: true,
      refetchType: "active",
    });
  });

  it("ukončí odběr a timer při odpojení komponenty", () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { unmount } = renderHook(
      () => useProjectBidRealtimeSync({ allProjectDetails: projectDetails, selectedProjectId: "project-1" }),
      { wrapper },
    );

    unmount();
    expect(state.cleanup).toHaveBeenCalledOnce();
  });
});
