import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/services/supabase", () => ({
  supabase: {
    rpc: state.rpc,
  },
}));

import { contractService } from "@/services/contractService";

describe("contractService vendor rating", () => {
  beforeEach(() => {
    state.rpc.mockReset();
    state.rpc.mockResolvedValue({ data: null, error: null });
  });

  it("sends only rating content to the server-owned audit RPC", async () => {
    await contractService.updateVendorRating("contract-1", {
      rating: 4,
      note: "Spolehlivý dodavatel",
    });

    expect(state.rpc).toHaveBeenCalledWith("update_contract_vendor_rating", {
      contract_id_input: "contract-1",
      rating_input: 4,
      note_input: "Spolehlivý dodavatel",
    });
  });

  it("propagates an RPC or RLS failure", async () => {
    const error = new Error("update denied");
    state.rpc.mockResolvedValue({ data: null, error });

    await expect(
      contractService.updateVendorRating("contract-1", {
        rating: null,
        note: null,
      }),
    ).rejects.toBe(error);
  });
});
