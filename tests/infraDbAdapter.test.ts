import { describe, expect, it, vi } from "vitest";

const dbAdapterMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  rpcRest: vi.fn(),
}));

vi.mock("@/services/dbAdapter", () => ({
  dbAdapter: dbAdapterMock,
}));

import { dbAdapter } from "@infra/db/dbAdapter";

describe("infra db adapter", () => {
  it("deleguje databazovy adapter do legacy db service", () => {
    expect(dbAdapter).toBe(dbAdapterMock);
  });
});
