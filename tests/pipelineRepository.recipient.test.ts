import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), update: vi.fn(), eq: vi.fn(), is: vi.fn(), select: vi.fn(), single: vi.fn(), abortSignal: vi.fn() }));
vi.mock("@/services/supabase", () => ({ supabase: { from: mocks.from } }));
import { pipelineRepository } from "@infra/projects/pipelineRepository";

beforeEach(() => { vi.clearAllMocks(); });

it("scopes the contact-only update and requires a returned row under caller RLS", async () => {
  for (const key of ["from", "update", "eq", "select", "abortSignal"] as const) mocks[key].mockReturnValue(mocks);
  mocks.single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });
  const payload = { contact_person: "Eva", email: "eva@example.com", phone: "222" };
  const response = await pipelineRepository.updateBidRecipient("cat", "bid", "sub", payload, "2026-09-14T10:00:00.123456+00:00");
  expect(mocks.from).toHaveBeenCalledWith("bids");
  expect(mocks.update).toHaveBeenCalledWith(payload);
  expect(mocks.eq.mock.calls).toEqual([["id", "bid"], ["demand_category_id", "cat"], ["subcontractor_id", "sub"], ["updated_at", "2026-09-14T10:00:00.123456+00:00"]]);
  expect(mocks.single).toHaveBeenCalledOnce();
  expect(response.error?.code).toBe("PGRST116");
});

it("protects legacy rows whose version is null with an IS NULL predicate", async () => {
  for (const key of ["from", "update", "eq", "is", "select", "abortSignal"] as const) mocks[key].mockReturnValue(mocks);
  mocks.single.mockResolvedValue({ data: null, error: null });
  await pipelineRepository.updateBidRecipient("cat", "bid", "sub", { contact_person: "Eva", email: "eva@example.com", phone: "" }, null);
  expect(mocks.is).toHaveBeenCalledWith("updated_at", null);
});
