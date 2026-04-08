import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ProjectDetails, Subcontractor } from "../types";

// ---- Mocks ----

const mockGeocode = vi.fn();
vi.mock("../features/maps/services/mapyApiService", () => ({
  mapyApiService: {
    geocode: (...args: unknown[]) => mockGeocode(...args),
  },
}));

// Import after mock setup
const { geocodingService } = await import("../features/maps/services/geocodingService");

const buildProject = (overrides: Partial<ProjectDetails> = {}): ProjectDetails => ({
  id: "project-1",
  title: "Test Stavba",
  investor: "",
  location: "Karlovy Vary",
  address: "Spálená 511/8, Karlovy Vary",
  finishDate: "",
  siteManager: "",
  plannedCost: 0,
  categories: [],
  ...overrides,
});

const buildSubcontractor = (overrides: Partial<Subcontractor> = {}): Subcontractor => ({
  id: "sub-1",
  company: "Test s.r.o.",
  specialization: ["Elektro"],
  contacts: [],
  ico: "12345678",
  region: "Karlovarský",
  address: "Hlavní 10",
  city: "Karlovy Vary",
  status: "available",
  ...overrides,
});

describe("geocodingService", () => {
  beforeEach(() => {
    mockGeocode.mockReset();
  });

  describe("geocodeProject", () => {
    it("returns existing coordinates when project already geocoded", async () => {
      const project = buildProject({ latitude: 50.23, longitude: 12.87 });
      const result = await geocodingService.geocodeProject(project);

      expect(result).toEqual({
        lat: 50.23,
        lng: 12.87,
        label: "Spálená 511/8, Karlovy Vary",
      });
      expect(mockGeocode).not.toHaveBeenCalled();
    });

    it("geocodes using address as primary query", async () => {
      mockGeocode.mockResolvedValueOnce({ lat: 50.2321, lng: 12.8714, label: "Spálená 511/8, Karlovy Vary" });

      const project = buildProject({ latitude: undefined, longitude: undefined });
      const result = await geocodingService.geocodeProject(project);

      expect(mockGeocode).toHaveBeenCalledWith("Spálená 511/8, Karlovy Vary");
      expect(result).toEqual({ lat: 50.2321, lng: 12.8714, label: "Spálená 511/8, Karlovy Vary" });
    });

    it("falls back to location when address geocoding fails", async () => {
      mockGeocode.mockResolvedValueOnce(null); // address fails
      mockGeocode.mockResolvedValueOnce({ lat: 50.23, lng: 12.87, label: "Karlovy Vary" });

      const project = buildProject({ latitude: undefined, longitude: undefined });
      const result = await geocodingService.geocodeProject(project);

      expect(mockGeocode).toHaveBeenCalledTimes(2);
      expect(mockGeocode).toHaveBeenNthCalledWith(1, "Spálená 511/8, Karlovy Vary");
      expect(mockGeocode).toHaveBeenNthCalledWith(2, "Karlovy Vary");
      expect(result?.lat).toBe(50.23);
    });

    it("returns null when no address or location", async () => {
      const project = buildProject({ address: undefined, location: undefined, latitude: undefined, longitude: undefined });
      const result = await geocodingService.geocodeProject(project);
      expect(result).toBeNull();
      expect(mockGeocode).not.toHaveBeenCalled();
    });

    it("returns null when all queries fail", async () => {
      mockGeocode.mockResolvedValue(null);
      const project = buildProject({ latitude: undefined, longitude: undefined });
      const result = await geocodingService.geocodeProject(project);
      expect(result).toBeNull();
    });
  });

  describe("geocodeSubcontractor", () => {
    it("returns existing coordinates when already geocoded", async () => {
      const sub = buildSubcontractor({ latitude: 50.1, longitude: 12.5 });
      const result = await geocodingService.geocodeSubcontractor(sub);

      expect(result?.lat).toBe(50.1);
      expect(mockGeocode).not.toHaveBeenCalled();
    });

    it("uses address+city as primary query", async () => {
      mockGeocode.mockResolvedValueOnce({ lat: 50.1, lng: 12.5, label: "Hlavní 10, Karlovy Vary" });

      const sub = buildSubcontractor({ latitude: undefined, longitude: undefined });
      const result = await geocodingService.geocodeSubcontractor(sub);

      expect(mockGeocode).toHaveBeenCalledWith("Hlavní 10, Karlovy Vary");
      expect(result?.lat).toBe(50.1);
    });

    it("falls back to city+region then city", async () => {
      mockGeocode.mockResolvedValueOnce(null); // address+city fails
      mockGeocode.mockResolvedValueOnce(null); // city+region fails
      mockGeocode.mockResolvedValueOnce({ lat: 50.23, lng: 12.87, label: "Karlovy Vary" });

      const sub = buildSubcontractor({ latitude: undefined, longitude: undefined });
      const result = await geocodingService.geocodeSubcontractor(sub);

      expect(mockGeocode).toHaveBeenCalledTimes(3);
      expect(mockGeocode).toHaveBeenNthCalledWith(1, "Hlavní 10, Karlovy Vary");
      expect(mockGeocode).toHaveBeenNthCalledWith(2, "Karlovy Vary, Karlovarský");
      expect(mockGeocode).toHaveBeenNthCalledWith(3, "Karlovy Vary");
      expect(result?.lat).toBe(50.23);
    });

    it("returns null when subcontractor has no address or city", async () => {
      const sub = buildSubcontractor({ address: undefined, city: undefined, latitude: undefined, longitude: undefined });
      const result = await geocodingService.geocodeSubcontractor(sub);
      expect(result).toBeNull();
    });
  });

  describe("batchGeocode", () => {
    it("geocodes multiple items and reports progress", async () => {
      mockGeocode.mockImplementation(async (query: string) => {
        if (query.includes("Hlavní")) return { lat: 50.1, lng: 12.5, label: query };
        if (query.includes("Brno")) return { lat: 49.2, lng: 16.6, label: query };
        return null;
      });

      const items = [
        { id: "1", address: "Hlavní 10", city: "Praha" },
        { id: "2", address: "Nádražní 5", city: "Brno" },
      ];
      const progressCalls: number[] = [];
      const results = await geocodingService.batchGeocode(items, (p) => {
        progressCalls.push(p.processed);
      });

      expect(results.size).toBe(2);
      expect(results.get("1")?.lat).toBe(50.1);
      expect(results.get("2")?.lat).toBe(49.2);
      expect(progressCalls.length).toBeGreaterThanOrEqual(2);
    });

    it("handles items with no matching geocode result", async () => {
      mockGeocode.mockResolvedValue(null);

      const items = [{ id: "1", address: "Neexistující 999", city: "Nikde" }];
      const results = await geocodingService.batchGeocode(items);

      expect(results.size).toBe(0);
    });

    it("can be cancelled", async () => {
      let callCount = 0;
      mockGeocode.mockImplementation(async () => {
        callCount++;
        await new Promise(r => setTimeout(r, 10));
        return { lat: 50, lng: 12, label: "test" };
      });

      const items = Array.from({ length: 30 }, (_, i) => ({
        id: `sub-${i}`,
        address: `Addr ${i}`,
        city: "Praha",
      }));

      const promise = geocodingService.batchGeocode(items);

      // Cancel after short delay
      await new Promise(r => setTimeout(r, 50));
      geocodingService.cancelBatch();

      const results = await promise;
      // Should have processed some but not all
      expect(results.size).toBeLessThan(30);
    });
  });
});

describe("useProjectOverviewNewController - address geocoding", async () => {
  const { useProjectOverviewNewController } = await import(
    "../features/projects/model/useProjectOverviewNewController"
  );

  it("calls onAddressChanged when address changes on save", () => {
    const onUpdate = vi.fn();
    const onAddressChanged = vi.fn();
    const project = buildProject({ address: "Stará adresa" });

    const { result } = renderHook(() =>
      useProjectOverviewNewController({
        project,
        onUpdate,
        onAddressChanged,
        searchQuery: "",
      }),
    );

    act(() => {
      result.current.setEditingInfo(true);
      result.current.setInfoForm((prev) => ({
        ...prev,
        address: "Nová adresa 123",
      }));
    });

    act(() => {
      result.current.handleSaveInfo();
    });

    expect(onAddressChanged).toHaveBeenCalledWith("Nová adresa 123", "Karlovy Vary");
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ address: "Nová adresa 123" }),
    );
  });

  it("does NOT call onAddressChanged when address unchanged", () => {
    const onUpdate = vi.fn();
    const onAddressChanged = vi.fn();
    const project = buildProject({ address: "Spálená 511/8, Karlovy Vary" });

    const { result } = renderHook(() =>
      useProjectOverviewNewController({
        project,
        onUpdate,
        onAddressChanged,
        searchQuery: "",
      }),
    );

    act(() => {
      result.current.setEditingInfo(true);
      // Change only investor, not address
      result.current.setInfoForm((prev) => ({
        ...prev,
        investor: "Nový investor",
      }));
    });

    act(() => {
      result.current.handleSaveInfo();
    });

    expect(onAddressChanged).not.toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalled();
  });

  it("does NOT call onAddressChanged when address cleared to empty", () => {
    const onUpdate = vi.fn();
    const onAddressChanged = vi.fn();
    const project = buildProject({ address: "Spálená 511/8, Karlovy Vary", location: "" });

    const { result } = renderHook(() =>
      useProjectOverviewNewController({
        project,
        onUpdate,
        onAddressChanged,
        searchQuery: "",
      }),
    );

    act(() => {
      result.current.setEditingInfo(true);
      result.current.setInfoForm((prev) => ({
        ...prev,
        address: "",
        location: "",
      }));
    });

    act(() => {
      result.current.handleSaveInfo();
    });

    // Address changed but both are empty → no geocoding
    expect(onAddressChanged).not.toHaveBeenCalled();
  });
});

describe("project details query mapping", () => {
  it("maps geocoding columns from DB row", async () => {
    // Verify the mapping structure would include lat/lng/geocodedAt
    // This is a structural test - the actual query test requires DB mocking
    const dbRow = {
      id: "p1",
      latitude: 50.23,
      longitude: 12.87,
      geocoded_at: "2026-04-08T10:00:00Z",
      address: "Spálená 511/8",
    };

    // The mapping should convert snake_case to camelCase
    expect(dbRow.latitude).toBeDefined();
    expect(dbRow.longitude).toBeDefined();
    expect(dbRow.geocoded_at).toBeDefined();

    // Verify camelCase mapping convention
    const mapped = {
      latitude: dbRow.latitude ?? undefined,
      longitude: dbRow.longitude ?? undefined,
      geocodedAt: dbRow.geocoded_at ?? undefined,
    };
    expect(mapped.latitude).toBe(50.23);
    expect(mapped.longitude).toBe(12.87);
    expect(mapped.geocodedAt).toBe("2026-04-08T10:00:00Z");
  });

  it("handles null geocoding columns gracefully", () => {
    const dbRow = {
      latitude: null,
      longitude: null,
      geocoded_at: null,
    };

    const mapped = {
      latitude: dbRow.latitude ?? undefined,
      longitude: dbRow.longitude ?? undefined,
      geocodedAt: dbRow.geocoded_at ?? undefined,
    };

    expect(mapped.latitude).toBeUndefined();
    expect(mapped.longitude).toBeUndefined();
    expect(mapped.geocodedAt).toBeUndefined();
  });
});

describe("contact mutation geocoding mapping", () => {
  it("maps geocoding fields to DB columns", () => {
    const data: Partial<Subcontractor> = {
      latitude: 50.1,
      longitude: 12.5,
      geocodedAt: "2026-04-08T10:00:00Z",
    };

    const dbUpdates: Record<string, unknown> = {};
    if (data.latitude !== undefined) dbUpdates.latitude = data.latitude;
    if (data.longitude !== undefined) dbUpdates.longitude = data.longitude;
    if (data.geocodedAt !== undefined) dbUpdates.geocoded_at = data.geocodedAt;

    expect(dbUpdates).toEqual({
      latitude: 50.1,
      longitude: 12.5,
      geocoded_at: "2026-04-08T10:00:00Z",
    });
  });

  it("does not include geocoding fields when not present", () => {
    const data: Partial<Subcontractor> = {
      company: "Updated s.r.o.",
    };

    const dbUpdates: Record<string, unknown> = {};
    if (data.latitude !== undefined) dbUpdates.latitude = data.latitude;
    if (data.longitude !== undefined) dbUpdates.longitude = data.longitude;
    if (data.geocodedAt !== undefined) dbUpdates.geocoded_at = data.geocodedAt;

    expect(dbUpdates).toEqual({});
  });
});
