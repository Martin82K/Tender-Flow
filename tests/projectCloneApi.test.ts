import { beforeEach, describe, expect, it, vi } from "vitest";
import { cloneTenderToRealization } from "@/features/projects/api/projectCloneApi";

const mocks = vi.hoisted(() => ({
  rpcRestMock: vi.fn(),
}));

vi.mock("@/services/dbAdapter", () => ({
  dbAdapter: {
    rpcRest: mocks.rpcRestMock,
  },
}));

describe("projectCloneApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("vrátí projectId při úspěšném klonování", async () => {
    mocks.rpcRestMock.mockResolvedValue({
      data: [{ cloned_project_id: "realization-1" }],
      error: null,
    });

    await expect(cloneTenderToRealization("tender-1")).resolves.toEqual({
      projectId: "realization-1",
    });
  });

  it("mapuje chybějící RPC na srozumitelnou hlášku o migraci", async () => {
    mocks.rpcRestMock.mockResolvedValue({
      data: null,
      error: {
        code: "HTTP_404",
        message:
          "Could not find the function public.clone_tender_project_to_realization(project_id_input) in the schema cache",
      },
    });

    await expect(cloneTenderToRealization("tender-1")).rejects.toThrow(
      "V databázi chybí nová RPC funkce pro přepnutí soutěže do realizace.",
    );
  });
});
