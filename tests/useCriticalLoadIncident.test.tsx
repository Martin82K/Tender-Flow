import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCriticalLoadIncident } from "@app/hooks/useCriticalLoadIncident";
import {
  APP_CORE_DATA_LOAD_ERROR_CODE,
  APP_CORE_DATA_LOAD_ERROR_MESSAGE,
} from "@/shared/errors/appLoadError";

const logIncidentMock = vi.hoisted(() => vi.fn());

vi.mock("@/services/incidentLogger", () => ({
  logIncident: logIncidentMock,
}));

describe("useCriticalLoadIncident", () => {
  beforeEach(() => {
    logIncidentMock.mockReset();
    logIncidentMock.mockResolvedValue({ incidentId: "INC-LOAD-1" });
  });

  it("does not log when there is no critical load failure", () => {
    const { result } = renderHook(() => useCriticalLoadIncident(null));

    expect(result.current).toBeNull();
    expect(logIncidentMock).not.toHaveBeenCalled();
  });

  it("logs once and exposes a safe user-facing reference", async () => {
    const { result, rerender } = renderHook(
      ({ diagnostic }) => useCriticalLoadIncident(diagnostic),
      { initialProps: { diagnostic: "projects timeout | contacts unavailable" } },
    );

    expect(result.current).toEqual({
      errorCode: APP_CORE_DATA_LOAD_ERROR_CODE,
      incidentId: null,
      userMessage: APP_CORE_DATA_LOAD_ERROR_MESSAGE,
    });

    await waitFor(() => {
      expect(result.current?.incidentId).toBe("INC-LOAD-1");
    });
    expect(logIncidentMock).toHaveBeenCalledTimes(1);
    expect(logIncidentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: APP_CORE_DATA_LOAD_ERROR_CODE,
        source: "react-query",
        category: "network",
      }),
    );

    rerender({ diagnostic: "projects timeout | contacts unavailable" });
    expect(logIncidentMock).toHaveBeenCalledTimes(1);
  });

  it("allows the same failure to be logged after recovery", async () => {
    const { rerender } = renderHook(
      ({ diagnostic }: { diagnostic: string | null }) =>
        useCriticalLoadIncident(diagnostic),
      { initialProps: { diagnostic: "projects timeout" } },
    );

    await waitFor(() => expect(logIncidentMock).toHaveBeenCalledTimes(1));
    rerender({ diagnostic: null });
    rerender({ diagnostic: "projects timeout" });
    await waitFor(() => expect(logIncidentMock).toHaveBeenCalledTimes(2));
  });
});
