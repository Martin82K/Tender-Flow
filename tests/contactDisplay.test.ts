import { describe, it, expect } from "vitest";
import {
  contactInitials,
  formatRegionCoverage,
  formatSpecializations,
  getStatusConfig,
  getStatusTextClasses,
} from "../shared/ui/contacts/contactDisplay";

describe("contactDisplay helpers", () => {
  it("formatSpecializations spojí s výchozím oddělovačem", () => {
    expect(formatSpecializations(["Zednictví", "Elektro"])).toBe(
      "Zednictví • Elektro",
    );
  });

  it("formatSpecializations filtruje prázdné položky", () => {
    expect(formatSpecializations(["", "A", ""])).toBe("A");
  });

  it("formatRegionCoverage vrací pomlčku pro prázdný seznam", () => {
    expect(formatRegionCoverage(undefined)).toBe("—");
    expect(formatRegionCoverage([])).toBe("—");
  });

  it("formatRegionCoverage mapuje kódy na názvy krajů", () => {
    expect(formatRegionCoverage(["PHA", "STC"])).toBe("Praha, Středočeský");
  });

  it("formatRegionCoverage vrací 'Celá ČR' když je pokrytí úplné", () => {
    const all = [
      "PHA","STC","JHC","PLK","KVK","ULK","LBK","HKK","PAK","VYS","JHM","OLK","ZLK","MSK",
    ];
    expect(formatRegionCoverage(all)).toBe("Celá ČR");
  });

  it("contactInitials vrací prvních dvě velká písmena", () => {
    expect(contactInitials("Jan Novák")).toBe("JN");
    expect(contactInitials("petr čermák dvořák")).toBe("PČ");
    expect(contactInitials("")).toBe("");
  });

  it("getStatusConfig vrací default pro neznámé id", () => {
    const cfg = getStatusConfig(
      [{ id: "a", label: "A", color: "green" }],
      "xyz",
    );
    expect(cfg.id).toBe("xyz");
    expect(cfg.label).toBe("xyz");
    expect(cfg.color).toBe("slate");
  });

  it("getStatusTextClasses vrací odpovídající text-color utility", () => {
    expect(getStatusTextClasses("green")).toContain("text-green-600");
    expect(getStatusTextClasses("red")).toContain("text-red-600");
    expect(getStatusTextClasses("unknown")).toContain("text-slate-600");
  });
});
