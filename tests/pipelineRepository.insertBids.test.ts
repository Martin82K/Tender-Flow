import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), signal: vi.fn() }));
vi.mock("@/services/supabase", () => ({ supabase: { rpc: mocks.rpc } }));
import { pipelineRepository } from "@infra/projects/pipelineRepository";

it("uses the idempotent RPC without changing legacy table inserts and bounds the request", async () => {
  mocks.signal.mockResolvedValue({ data: [], error: null });
  mocks.rpc.mockReturnValue({ abortSignal: mocks.signal });
  await pipelineRepository.insertBids([]);
  expect(mocks.rpc).toHaveBeenCalledWith("insert_pipeline_bids", { p_bids: [] });
  expect(mocks.signal).toHaveBeenCalledWith(expect.any(AbortSignal));
});
