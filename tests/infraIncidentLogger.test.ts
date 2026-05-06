import { describe, expect, it, vi } from "vitest";

const incidentLoggerMock = vi.hoisted(() => ({
  logIncident: vi.fn(),
  setIncidentContext: vi.fn(),
}));

vi.mock("@/services/incidentLogger", () => incidentLoggerMock);

import {
  logIncident,
  setIncidentContext,
} from "@infra/diagnostics/incidentLogger";

describe("infra incident logger", () => {
  it("deleguje logovani incidentu a context do legacy loggeru", async () => {
    incidentLoggerMock.logIncident.mockResolvedValue({ incidentId: "INC-1" });

    setIncidentContext({ project_id: "project-1" });
    await expect(
      logIncident({
        severity: "warn",
        source: "renderer",
        category: "storage",
        code: "TEST_INCIDENT",
        message: "test",
      }),
    ).resolves.toEqual({ incidentId: "INC-1" });

    expect(incidentLoggerMock.setIncidentContext).toHaveBeenCalledWith({
      project_id: "project-1",
    });
    expect(incidentLoggerMock.logIncident).toHaveBeenCalledWith({
      severity: "warn",
      source: "renderer",
      category: "storage",
      code: "TEST_INCIDENT",
      message: "test",
    });
  });
});
