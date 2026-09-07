import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ upsert: vi.fn(), signal: vi.fn() }));
vi.mock("@/services/supabase", () => ({ supabase: { from: () => ({
  upsert: mocks.upsert,
}) } }));
import { pipelineRepository } from "@infra/projects/pipelineRepository";

it("ignores category/supplier conflicts without updating the original bid and bounds the request", async () => {
  mocks.signal.mockReturnValue({ returns: () => Promise.resolve({ data: [], error: null }) });
  mocks.upsert.mockReturnValue({ select: () => ({ abortSignal: mocks.signal }) });
  await pipelineRepository.insertBids([]);
  expect(mocks.upsert).toHaveBeenCalledWith([], { onConflict: "demand_category_id,subcontractor_id", ignoreDuplicates: true });
  expect(mocks.signal).toHaveBeenCalledWith(expect.any(AbortSignal));
});
