import { describe, expect, it, vi } from "vitest";

const exportServiceMock = vi.hoisted(() => ({
  exportContactsToCSV: vi.fn(),
  exportToPDF: vi.fn(),
}));

vi.mock("@/services/exportService", () => exportServiceMock);

import {
  exportContactsToCSV,
  exportToPDF,
} from "@infra/export/exportService";

describe("infra export service", () => {
  it("deleguje export helpery do legacy export service", () => {
    expect(exportContactsToCSV).toBe(exportServiceMock.exportContactsToCSV);
    expect(exportToPDF).toBe(exportServiceMock.exportToPDF);
  });
});
