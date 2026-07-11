import { describe, expect, it } from "vitest";
import { formatIncidentReference } from "@/shared/errors/incidentReference";

describe("incident reference", () => {
  it("formats a stable error code and incident id", () => {
    expect(
      formatIncidentReference({
        errorCode: "app_core_data_load_failed",
        incidentId: "INC-ABC123",
      }),
    ).toBe("Kód chyby: APP_CORE_DATA_LOAD_FAILED\nKód incidentu: INC-ABC123");
  });

  it("sanitizes unexpected reference characters before rendering", () => {
    expect(
      formatIncidentReference({
        errorCode: "bad code<script>",
        incidentId: "INC-123<script>",
      }),
    ).toBe("Kód chyby: BAD_CODE_SCRIPT_\nKód incidentu: INC-123script");
  });

  it("keeps the error code visible while the incident id is pending", () => {
    expect(
      formatIncidentReference({
        errorCode: "APP_CORE_DATA_LOAD_FAILED",
        incidentId: null,
      }),
    ).toBe("Kód chyby: APP_CORE_DATA_LOAD_FAILED");
  });
});
