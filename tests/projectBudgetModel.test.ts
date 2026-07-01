import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { calculateBudgetItemPricing } from "@/features/budgets/model/budgetPricing";
import { parseBudgetWorkbook } from "@/features/budgets/api/budgetImport";
import {
  filterBudgetByTender,
  summarizeBudget,
  summarizeBudgetByTender,
} from "@/features/budgets/model/budgetSummary";
import type { ProjectBudget } from "@/features/budgets/model/budgetTypes";
import { mapBudgetRows } from "@/features/budgets/api/budgetRepository";
import { buildBudgetTenderOptions } from "@/features/budgets/model/budgetTenderOptions";
import { filterDisplayBudgetCategories } from "@/features/budgets/model/budgetPlaceholders";
import { findLinkedCategoryForPlan } from "@/features/projects/model/tenderPlanModel";

const budgetFixture: ProjectBudget = {
  id: "pb_1",
  projectId: "p_1",
  name: "Rozpočet",
  status: "draft",
  currency: "CZK",
  totalPrice: 0,
  totalPriceWithVat: 0,
  sheets: [
    {
      id: "s_1",
      budgetId: "pb_1",
      name: "SO 01",
      order: 0,
      totalPrice: 0,
      totalPriceWithVat: 0,
      categories: [
        {
          id: "c_1",
          sheetId: "s_1",
          name: "Zemní práce",
          order: 0,
          totalPrice: 0,
          totalPriceWithVat: 0,
          items: [
            {
              id: "i_1",
              categoryId: "c_1",
              demandCategoryId: "dc_1",
              code: "122",
              name: "Výkop",
              unit: "m3",
              amount: 10,
              unitPrice: 100,
              vatRate: 21,
              marginPercent: 0,
              totalPrice: 1000,
              totalPriceWithVat: 1210,
              marginAmount: 0,
              order: 0,
              measurements: [],
            },
            {
              id: "i_2",
              categoryId: "c_1",
              demandCategoryId: null,
              code: "998",
              name: "Přesun",
              unit: "ks",
              amount: 1,
              unitPrice: 500,
              vatRate: 21,
              marginPercent: 0,
              totalPrice: 500,
              totalPriceWithVat: 605,
              marginAmount: 0,
              order: 1,
              measurements: [],
            },
          ],
        },
      ],
    },
    {
      id: "s_2",
      budgetId: "pb_1",
      name: "SO 02",
      order: 1,
      totalPrice: 0,
      totalPriceWithVat: 0,
      categories: [
        {
          id: "c_2",
          sheetId: "s_2",
          name: "Betony",
          order: 0,
          totalPrice: 0,
          totalPriceWithVat: 0,
          items: [
            {
              id: "i_3",
              categoryId: "c_2",
              demandCategoryId: "dc_1",
              code: "273",
              name: "Beton",
              unit: "m3",
              amount: 2,
              unitPrice: 1000,
              vatRate: 12,
              marginPercent: 0,
              totalPrice: 2000,
              totalPriceWithVat: 2240,
              marginAmount: 0,
              order: 0,
              measurements: [],
            },
          ],
        },
      ],
    },
  ],
};

describe("project budget model", () => {
  it("počítá cenu položky bez DPH, s DPH a marži", () => {
    expect(
      calculateBudgetItemPricing({
        amount: 10,
        unitPrice: 121,
        vatRate: 21,
        marginPercent: 21,
      }),
    ).toEqual({
      totalPrice: 1210,
      totalPriceWithVat: 1464.1,
      marginAmount: 210,
    });
  });

  it("sumarizuje rozpočet podle objektů a kapitol", () => {
    const summary = summarizeBudget(budgetFixture);

    expect(summary.totalItems).toBe(3);
    expect(summary.totalPrice).toBe(3500);
    expect(summary.totalPriceWithVat).toBe(4055);
    expect(summary.objectSummaries.map((object) => object.name)).toEqual(["SO 01", "SO 02"]);
  });

  it("sumarizuje položky podle výběrového řízení", () => {
    expect(summarizeBudgetByTender(budgetFixture)).toEqual([
      {
        demandCategoryId: "dc_1",
        itemCount: 2,
        totalPrice: 3000,
        totalPriceWithVat: 3450,
      },
    ]);
  });

  it("filtruje export pouze na položky přiřazené k jednomu VŘ", () => {
    const filtered = filterBudgetByTender(budgetFixture, "dc_1");

    expect(filtered?.sheets).toHaveLength(2);
    expect(filtered?.sheets.flatMap((sheet) => sheet.categories.flatMap((category) => category.items))).toHaveLength(2);
    expect(filtered?.totalPrice).toBe(3000);
    expect(filterBudgetByTender(budgetFixture, "missing")).toBeNull();
  });

  it("nezobrazuje prázdnou placeholder kapitolu Nezařazené položky", () => {
    const visible = filterDisplayBudgetCategories([
      {
        id: "placeholder-empty",
        sheetId: "s_1",
        name: "Nezařazené položky",
        code: null,
        order: 0,
        totalPrice: 0,
        totalPriceWithVat: 0,
        items: [],
      },
      {
        id: "placeholder-with-data",
        sheetId: "s_1",
        name: "Nezařazené položky",
        code: null,
        order: 1,
        totalPrice: 100,
        totalPriceWithVat: 121,
        items: budgetFixture.sheets[0].categories[0].items.slice(0, 1),
      },
      {
        id: "real",
        sheetId: "s_1",
        name: "1 - Zemní práce",
        code: null,
        order: 2,
        totalPrice: 0,
        totalPriceWithVat: 0,
        items: [],
      },
    ]);

    expect(visible.map((category) => category.id)).toEqual(["placeholder-with-data", "real"]);
  });

  it("mapuje normalizované DB řádky do stromu rozpočtu", () => {
    const budget = mapBudgetRows({
      budget: {
        id: "pb_1",
        project_id: "p_1",
        name: "Rozpočet",
        status: "draft",
        currency: "CZK",
        created_at: null,
        updated_at: null,
      },
      sheets: [{ id: "s_1", budget_id: "pb_1", name: "SO 01", sort_order: 0 }],
      categories: [{ id: "c_1", sheet_id: "s_1", name: "Kapitola", code: null, sort_order: 0 }],
      items: [
        {
          id: "i_1",
          category_id: "c_1",
          demand_category_id: "dc_1",
          position_label: "1.1",
          code: "001",
          name: "Položka",
          unit: "m",
          amount: 3,
          unit_price: 100,
          vat_rate: 21,
          margin_percent: 0,
          description: null,
          sort_order: 0,
        },
      ],
      measurements: [
        {
          id: "m_1",
          item_id: "i_1",
          row_number: 1,
          note: "Délka",
          formula: "1+2",
          result: 3,
        },
      ],
    });

    expect(budget.totalPrice).toBe(300);
    expect(budget.sheets[0].categories[0].items[0].positionLabel).toBe("1.1");
    expect(budget.sheets[0].categories[0].items[0].measurements[0]).toMatchObject({
      note: "Délka",
      result: 3,
    });
  });
});

describe("budget tender options", () => {
  it("preferuje propojení Plánu VŘ přes categoryId před shodou názvu", () => {
    const categories = [
      {
        id: "dc_1",
        title: "Původní název VŘ",
        budget: "0 Kč",
        sodBudget: 0,
        planBudget: 0,
        status: "open" as const,
        subcontractorCount: 0,
        description: "",
      },
      {
        id: "dc_2",
        title: "Kolizní plán",
        budget: "0 Kč",
        sodBudget: 0,
        planBudget: 0,
        status: "open" as const,
        subcontractorCount: 0,
        description: "",
      },
    ];
    const tenderPlans = [
      {
        id: "tp_1",
        name: "Kolizní plán",
        dateFrom: "",
        dateTo: "",
        categoryId: "dc_1",
      },
    ];

    const options = buildBudgetTenderOptions(categories, tenderPlans);

    expect(options[0]).toMatchObject({
      id: "dc_1",
      title: "Kolizní plán",
    });
    expect(findLinkedCategoryForPlan(tenderPlans[0], categories)?.id).toBe("dc_1");
  });
});

describe("budget xlsx import", () => {
  it("rozpozná českou XLSX hlavičku a převede řádky na import položky", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["P.č.", "Kód položky", "Popis a technologická specifikace stavebního prvku", "MJ", "Množství VV", "Jednotková cena", "DPH %", "Kapitola"],
      ["1.1", "11328", "Odstranění příkopů", "m", "12,5", "1 150", "21", "Zemní práce"],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "SO 01");

    const parsed = parseBudgetWorkbook(workbook, "rozpocet.xlsx");

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      sheetName: "SO 01",
      categoryName: "1 - Zemní práce",
      positionLabel: "1.1",
      code: "11328",
      name: "Odstranění příkopů",
      unit: "m",
      amount: 12.5,
      unitPrice: 1150,
      vatRate: 21,
    });
  });

  it("přenáší EasyCalc typy řádků Díl a VV do kapitoly a výkazu výměr", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Typ", "Kód položky", "Popis a technologická specifikace stavebního prvku", "MJ", "Množství VV", "Jednotková cena", "DPH %"],
      ["Díl", "", "1 - Zemní práce", "", "", "", ""],
      ["K", "11328", "Odstranění příkopů", "m", "12,5", "1 150", "21"],
      ["PP", "", "Odstranění příkopů včetně přesunu hmot.", "", "", "", ""],
      ["VV", "", "odečteno z CAD: km 1.870-2.100", "", "12,5", "", ""],
      ["X", "", "neimportovatelný typ", "", "", "", ""],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "SO 01");

    const parsed = parseBudgetWorkbook(workbook, "rozpocet.xlsx");

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].categoryName).toBe("1 - Zemní práce");
    expect(parsed.rows[0].measurements).toEqual([
      {
        note: "Odstranění příkopů včetně přesunu hmot.",
        formula: null,
        result: 0,
      },
      {
        note: "odečteno z CAD: km 1.870-2.100",
        formula: null,
        result: 12.5,
      },
    ]);
    expect(parsed.skippedRowDetails).toEqual([
      expect.objectContaining({
        sheetName: "SO 01",
        rowNumber: 2,
        reason: "Řádek je hlavička kapitoly, ne položka rozpočtu.",
      }),
      expect.objectContaining({
        sheetName: "SO 01",
        rowNumber: 6,
        reason: 'Typ řádku "X" není položka rozpočtu.',
      }),
    ]);
  });

  it("neimportuje řádky KAPITOLA jako položky a zachová pořadí kapitol", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Kód položky", "Popis a technologická specifikace stavebního prvku", "MJ", "Množství VV", "Jednotková cena", "DPH %"],
      ["-", "KAPITOLA: VŠEOBECNÉ KONSTRUKCE A PRÁCE", "", "", "", ""],
      ["014101R.1", "Poplatky za skládku - živice", "m3", "59,81", "350", "21"],
      ["-", "KAPITOLA: 1 - ZEMNÍ PRÁCE", "", "", "", ""],
      ["111204", "Odstranění křovin s odvozem do 5km", "m2", "73", "120", "21"],
      ["-", "KAPITOLA: 2 - ZAKLÁDÁNÍ A ZVLÁŠTNÍ ZAKLÁDÁNÍ", "", "", "", ""],
      ["21461F", "Separační geotextilie do 600g/m2", "m2", "116,96", "45", "21"],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "201");

    const parsed = parseBudgetWorkbook(workbook, "rozpocet.xlsx");

    expect(parsed.rows.map((row) => row.name)).toEqual([
      "Poplatky za skládku - živice",
      "Odstranění křovin s odvozem do 5km",
      "Separační geotextilie do 600g/m2",
    ]);
    expect(parsed.rows.map((row) => row.categoryName)).toEqual([
      "VŠEOBECNÉ KONSTRUKCE A PRÁCE",
      "1 - Zemní práce",
      "2 - Zakládání a zvláštní zakládání",
    ]);
    expect(parsed.skippedRows).toBe(3);
    expect(parsed.skippedRowDetails.map((row) => row.reason)).toEqual([
      "Řádek je hlavička kapitoly, ne položka rozpočtu.",
      "Řádek je hlavička kapitoly, ne položka rozpočtu.",
      "Řádek je hlavička kapitoly, ne položka rozpočtu.",
    ]);
  });

  it("vrací metadata pro preview a respektuje ruční mapování sloupců", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Kód položky", "Popis a technologická specifikace stavebního prvku", "MJ", "Množství VV", "Jednotková cena"],
      ["11328", "Odstranění příkopů", "m", "12,5", "1 150"],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "SO 01");

    const parsed = parseBudgetWorkbook(workbook, "rozpocet.xlsx", {
      columnOverrides: {
        code: 1,
        name: 0,
        unitPrice: -1,
      },
    });

    expect(parsed.headerSheetName).toBe("SO 01");
    expect(parsed.headerRowNumber).toBe(1);
    expect(parsed.headerRow).toContain("Kód položky");
    expect(parsed.mappedColumnIndices).toMatchObject({
      code: 1,
      name: 0,
    });
    expect(parsed.mappedColumnIndices.unitPrice).toBeUndefined();
    expect(parsed.mappedColumns).toMatchObject({
      code: "Popis a technologická specifikace stavebního prvku",
      name: "Kód položky",
    });
    expect(parsed.rows[0]).toMatchObject({
      code: "Odstranění příkopů",
      name: "11328",
      unitPrice: 0,
    });
    expect(parsed.rows[0].unitPriceColumnIndex).toBeUndefined();
  });
});
