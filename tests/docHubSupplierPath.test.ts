import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOCHUB_HIERARCHY,
  DocHubHierarchyItem,
  ensureExtraHierarchy,
  findHierarchyAncestors,
  getDocHubTenderLinksDesktop,
} from "../utils/docHub";

const ROOT = "C:\\Stavby\\26017 - Fibichova\\_TF";

describe("ensureExtraHierarchy", () => {
  it("returns provided hierarchy when non-empty", () => {
    const custom: DocHubHierarchyItem[] = [
      { id: "x", key: "custom", name: "X", enabled: true, depth: 0 },
    ];
    expect(ensureExtraHierarchy(custom)).toBe(custom);
  });

  it("falls back to DEFAULT_DOCHUB_HIERARCHY when undefined", () => {
    expect(ensureExtraHierarchy(undefined)).toBe(DEFAULT_DOCHUB_HIERARCHY);
  });

  it("falls back to DEFAULT_DOCHUB_HIERARCHY when empty", () => {
    expect(ensureExtraHierarchy([])).toBe(DEFAULT_DOCHUB_HIERARCHY);
  });

  it("falls back to DEFAULT_DOCHUB_HIERARCHY when null", () => {
    expect(ensureExtraHierarchy(null)).toBe(DEFAULT_DOCHUB_HIERARCHY);
  });
});

describe("findHierarchyAncestors", () => {
  it("returns full ancestor chain ending in matched node (supplier under Poptavky)", () => {
    const path = findHierarchyAncestors(
      DEFAULT_DOCHUB_HIERARCHY,
      (item) => item.key === "supplier"
    );
    const keys = path.map((item) => item.key);
    expect(keys).toEqual(["tenders", "category", "tendersInquiries", "supplier"]);
  });

  it("returns empty array when no match is found", () => {
    const path = findHierarchyAncestors(
      DEFAULT_DOCHUB_HIERARCHY,
      (item) => item.key === "nonexistent"
    );
    expect(path).toEqual([]);
  });

  it("skips disabled ancestors", () => {
    const hierarchy: DocHubHierarchyItem[] = [
      { id: "t", key: "tenders", name: "03_VR", enabled: true, depth: 0 },
      { id: "c", key: "category", name: "{Název VŘ}", enabled: true, depth: 1 },
      { id: "skip", key: "custom", name: "SKIP", enabled: false, depth: 2 },
      { id: "p", key: "tendersInquiries", name: "Poptavky", enabled: true, depth: 2 },
      { id: "s", key: "supplier", name: "{Název dodavatele}", enabled: true, depth: 3 },
    ];
    const path = findHierarchyAncestors(hierarchy, (i) => i.key === "supplier");
    expect(path.map((i) => i.id)).toEqual(["t", "c", "p", "s"]);
  });

  it("continues climbing when the only ancestor at a depth is disabled", () => {
    // Regression: user disabled Poptavky (depth 2) but left supplier at depth 3.
    // Old logic got stuck hunting depth 2 and returned [supplier] only.
    const hierarchy: DocHubHierarchyItem[] = [
      { id: "t", key: "tenders", name: "03_VR", enabled: true, depth: 0 },
      { id: "c", key: "category", name: "{Název VŘ}", enabled: true, depth: 1 },
      { id: "p", key: "tendersInquiries", name: "Poptavky", enabled: false, depth: 2 },
      { id: "s", key: "supplier", name: "{Název dodavatele}", enabled: true, depth: 3 },
    ];
    const path = findHierarchyAncestors(hierarchy, (i) => i.key === "supplier");
    expect(path.map((i) => i.id)).toEqual(["t", "c", "s"]);
  });

  it("continues climbing when a depth level is missing entirely from hierarchy", () => {
    // Regression: user removed Poptavky node but forgot to bump supplier depth.
    const hierarchy: DocHubHierarchyItem[] = [
      { id: "t", key: "tenders", name: "03_VR", enabled: true, depth: 0 },
      { id: "c", key: "category", name: "{Název VŘ}", enabled: true, depth: 1 },
      { id: "s", key: "supplier", name: "{Název dodavatele}", enabled: true, depth: 3 },
    ];
    const path = findHierarchyAncestors(hierarchy, (i) => i.key === "supplier");
    expect(path.map((i) => i.id)).toEqual(["t", "c", "s"]);
  });
});

describe("getDocHubTenderLinksDesktop", () => {
  it("includes Poptavky in path when hierarchy is saved with it (regression guard for v04)", () => {
    const path = getDocHubTenderLinksDesktop(
      ROOT,
      "01 Betony",
      "ZAPA beton as Kačerov",
      { extraHierarchy: DEFAULT_DOCHUB_HIERARCHY } as any
    );
    expect(path).toBe(
      "C:\\Stavby\\26017 - Fibichova\\_TF\\03_Vyberova_rizeni\\01 Betony\\Poptavky\\ZAPA beton as Kačerov"
    );
  });

  it("falls back to DEFAULT_DOCHUB_HIERARCHY when project has no extraHierarchy saved", () => {
    const path = getDocHubTenderLinksDesktop(
      ROOT,
      "01 Betony",
      "ZAPA beton as Kačerov",
      undefined
    );
    // Should still include Poptavky because default hierarchy has supplier under Poptavky
    expect(path).toBe(
      "C:\\Stavby\\26017 - Fibichova\\_TF\\03_Vyberova_rizeni\\01 Betony\\Poptavky\\ZAPA beton as Kačerov"
    );
  });

  it("preserves diacritics in supplier and tender names", () => {
    const path = getDocHubTenderLinksDesktop(
      ROOT,
      "Železobeton",
      "Kačerov s.r.o.",
      { extraHierarchy: DEFAULT_DOCHUB_HIERARCHY } as any
    );
    expect(path).toContain("Železobeton");
    expect(path).toContain("Kačerov s.r.o.");
  });

  it("strips Windows-invalid chars from segments (but keeps drive letter colon)", () => {
    const path = getDocHubTenderLinksDesktop(
      ROOT,
      'A|B<C>D',
      'X:Y"Z',
      { extraHierarchy: DEFAULT_DOCHUB_HIERARCHY } as any
    );
    // Drop the "C:" drive prefix and verify no invalid chars remain in the rest
    const rest = path.replace(/^[A-Za-z]:/, "");
    expect(rest).not.toMatch(/[<>:"|?*]/);
    expect(path).toContain("ABCD");
    expect(path).toContain("XYZ");
  });

  it("honors custom tenders folder name from hierarchy", () => {
    const customHierarchy: DocHubHierarchyItem[] = [
      { id: "t", key: "tenders", name: "VR_CUSTOM", enabled: true, depth: 0 },
      { id: "c", key: "category", name: "{Název VŘ}", enabled: true, depth: 1 },
      { id: "p", key: "tendersInquiries", name: "Inquiries", enabled: true, depth: 2 },
      { id: "s", key: "supplier", name: "{Název dodavatele}", enabled: true, depth: 3 },
    ];
    const path = getDocHubTenderLinksDesktop(
      ROOT,
      "CatTitle",
      "SupplierCo",
      { extraHierarchy: customHierarchy } as any
    );
    expect(path).toBe(
      "C:\\Stavby\\26017 - Fibichova\\_TF\\VR_CUSTOM\\CatTitle\\Inquiries\\SupplierCo"
    );
  });

  it("places supplier directly under category when hierarchy has no Poptavky layer", () => {
    const flatHierarchy: DocHubHierarchyItem[] = [
      { id: "t", key: "tenders", name: "03_VR", enabled: true, depth: 0 },
      { id: "c", key: "category", name: "{Název VŘ}", enabled: true, depth: 1 },
      { id: "s", key: "supplier", name: "{Název dodavatele}", enabled: true, depth: 2 },
    ];
    const path = getDocHubTenderLinksDesktop(
      ROOT,
      "Category A",
      "Supplier B",
      { extraHierarchy: flatHierarchy } as any
    );
    expect(path).toBe(
      "C:\\Stavby\\26017 - Fibichova\\_TF\\03_VR\\Category A\\Supplier B"
    );
  });

  it("falls back to simple tenders/category/supplier when hierarchy has no supplier node", () => {
    const noSupplier: DocHubHierarchyItem[] = [
      { id: "t", key: "tenders", name: "03_CUSTOM", enabled: true, depth: 0 },
    ];
    const path = getDocHubTenderLinksDesktop(
      ROOT,
      "CatX",
      "SupY",
      { extraHierarchy: noSupplier } as any
    );
    expect(path).toBe(
      "C:\\Stavby\\26017 - Fibichova\\_TF\\03_CUSTOM\\CatX\\SupY"
    );
  });

  it("builds path with tenders+category even when Poptavky is disabled", () => {
    // Regression for the reported bug: user's project had Poptavky disabled
    // but supplier stayed at depth 3. Old code returned "{root}\{supplier}"
    // (missing tenders + category segments). Fix should restore the full path.
    const disabledPoptavky: DocHubHierarchyItem[] = [
      { id: "t", key: "tenders", name: "03_Vyberova_rizeni", enabled: true, depth: 0 },
      { id: "c", key: "category", name: "{Název VŘ}", enabled: true, depth: 1 },
      { id: "p", key: "tendersInquiries", name: "Poptavky", enabled: false, depth: 2 },
      { id: "s", key: "supplier", name: "{Název dodavatele}", enabled: true, depth: 3 },
    ];
    const path = getDocHubTenderLinksDesktop(
      ROOT,
      "01 Betony",
      "FRISCHBETON sro Praha",
      { extraHierarchy: disabledPoptavky } as any
    );
    expect(path).toBe(
      "C:\\Stavby\\26017 - Fibichova\\_TF\\03_Vyberova_rizeni\\01 Betony\\FRISCHBETON sro Praha"
    );
  });

  it("falls back to tenders/category/supplier when ancestors collapse to just supplier at root", () => {
    // Defensive: if a project somehow ends up with supplier at depth 0 and no
    // other ancestors (e.g. corrupted structure), we still want a sensible path
    // instead of "{root}/{supplier}".
    const onlySupplier: DocHubHierarchyItem[] = [
      { id: "t", key: "tenders", name: "03_Vyberova_rizeni", enabled: true, depth: 0 },
      { id: "s", key: "supplier", name: "{Název dodavatele}", enabled: true, depth: 0 },
    ];
    const path = getDocHubTenderLinksDesktop(
      ROOT,
      "01 Betony",
      "FRISCHBETON sro Praha",
      { extraHierarchy: onlySupplier } as any
    );
    expect(path).toBe(
      "C:\\Stavby\\26017 - Fibichova\\_TF\\03_Vyberova_rizeni\\01 Betony\\FRISCHBETON sro Praha"
    );
  });
});
