import { describe, expect, it } from "vitest";
import {
  MODULES,
  ZONE_ORDER,
  defaultEnabledModules,
  getModuleById,
  getModulesByZone,
} from "@features/command-center/registry";

describe("command-center registry", () => {
  it("obsahuje 10 modulů", () => {
    expect(MODULES).toHaveLength(10);
  });

  it("každý modul má unikátní id", () => {
    const ids = MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("každý modul patří do registrované zóny", () => {
    for (const mod of MODULES) {
      expect(ZONE_ORDER).toContain(mod.zone);
    }
  });

  it("defaultEnabledModules respektuje enabledByDefault", () => {
    const map = defaultEnabledModules();
    for (const mod of MODULES) {
      expect(map[mod.id]).toBe(mod.enabledByDefault);
    }
  });

  it("getModuleById vrací modul nebo undefined", () => {
    expect(getModuleById("kpi-row")?.id).toBe("kpi-row");
    expect(getModuleById("neexistuje")).toBeUndefined();
  });

  it("getModulesByZone řadí podle priority", () => {
    for (const zone of ZONE_ORDER) {
      const mods = getModulesByZone(zone);
      for (let i = 1; i < mods.length; i += 1) {
        expect(mods[i].priority).toBeGreaterThanOrEqual(mods[i - 1].priority);
      }
    }
  });
});
