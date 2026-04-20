import { describe, expect, it } from "vitest";
import { allocateCols } from "@features/command-center/CommandCenterShell";
import { signalWeight } from "@features/command-center/hooks/useModuleSignals";
import type {
  CommandCenterModule,
  ModuleSignal,
} from "@features/command-center/types";

const makeModule = (
  id: string,
  cols: number,
  opts: Partial<CommandCenterModule> = {}
): CommandCenterModule =>
  ({
    id,
    title: id,
    description: "",
    zone: "tactical",
    defaultSize: { cols, minCols: 3 },
    enabledByDefault: true,
    priority: 0,
    component: (() => null) as unknown as CommandCenterModule["component"],
    ...opts,
  }) as CommandCenterModule;

const sig = (level: ModuleSignal["level"]): ModuleSignal => ({ level, count: 0 });

describe("allocateCols (data-driven)", () => {
  it("součet sloupců je 12", () => {
    const mods = [
      makeModule("a", 5, { weightBySignal: true }),
      makeModule("b", 4, { weightBySignal: true }),
      makeModule("c", 3, { weightBySignal: true }),
    ];
    const signals = { a: sig("normal"), b: sig("normal"), c: sig("normal") };
    const cols = allocateCols(mods, signals, true);
    expect(cols.reduce((s, v) => s + v, 0)).toBe(12);
  });

  it("kritický signál rozšíří modul na úkor normálního", () => {
    const mods = [
      makeModule("a", 5, { weightBySignal: true }),
      makeModule("b", 4, { weightBySignal: true }),
      makeModule("c", 3, { weightBySignal: true }),
    ];
    const baseline = allocateCols(
      mods,
      { a: sig("normal"), b: sig("normal"), c: sig("normal") },
      true
    );
    const withCritical = allocateCols(
      mods,
      { a: sig("normal"), b: sig("critical"), c: sig("normal") },
      true
    );
    expect(withCritical[1]).toBeGreaterThan(baseline[1]);
    expect(withCritical[0] + withCritical[2]).toBeLessThan(baseline[0] + baseline[2]);
    expect(withCritical.reduce((s, v) => s + v, 0)).toBe(12);
  });

  it("auto-layout off ignoruje signály a používá default cols", () => {
    const mods = [
      makeModule("a", 5, { weightBySignal: true }),
      makeModule("b", 4, { weightBySignal: true }),
      makeModule("c", 3, { weightBySignal: true }),
    ];
    const colsOff = allocateCols(
      mods,
      { a: sig("normal"), b: sig("critical"), c: sig("normal") },
      false
    );
    expect(colsOff.reduce((s, v) => s + v, 0)).toBe(12);
    expect(colsOff[0]).toBe(5);
    expect(colsOff[1]).toBe(4);
    expect(colsOff[2]).toBe(3);
  });

  it("respektuje minCols", () => {
    const mods = [
      makeModule("a", 10, { weightBySignal: true }),
      makeModule("b", 1, { weightBySignal: true, defaultSize: { cols: 1, minCols: 3 } }),
    ];
    const cols = allocateCols(
      mods,
      { a: sig("critical"), b: sig("empty") },
      true
    );
    expect(cols[1]).toBeGreaterThanOrEqual(3);
  });

  it("jediný modul dostane celých 12 sloupců", () => {
    const mods = [makeModule("a", 5)];
    expect(allocateCols(mods, {}, true)).toEqual([12]);
  });
});

describe("signalWeight", () => {
  it("prázdný modul s autoHideWhenEmpty má váhu 0", () => {
    expect(signalWeight(sig("empty"), true)).toBe(0);
  });

  it("prázdný modul bez autoHide má váhu < 1", () => {
    expect(signalWeight(sig("empty"), false)).toBeLessThan(1);
    expect(signalWeight(sig("empty"), false)).toBeGreaterThan(0);
  });

  it("hot > normal, critical > hot", () => {
    expect(signalWeight(sig("hot"), false)).toBeGreaterThan(signalWeight(sig("normal"), false));
    expect(signalWeight(sig("critical"), false)).toBeGreaterThan(signalWeight(sig("hot"), false));
  });
});
