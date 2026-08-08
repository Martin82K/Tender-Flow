import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CONTRACT_OVERVIEW_STATUS_LABELS,
  filterContractOverviewRows,
  toggleContractOverviewProject,
} from "@/features/contracts-overview/model/contractOverviewModel";
import type { ContractOverviewRow } from "@/features/contracts-overview/api/contractOverviewApi";
import { buildContractOverviewExportRows } from "@/features/contracts-overview/api/contractOverviewExport";

const row = (overrides: Partial<ContractOverviewRow>): ContractOverviewRow => ({
  organizationId: "org-1",
  projectId: "project-1",
  projectName: "Stavba Alfa",
  projectStatus: "realization",
  contractId: "contract-1",
  contractPartner: "Dodavatel",
  contractTitle: "Smlouva o dílo",
  contractNumber: "S-1",
  contractStatus: "active",
  currency: "CZK",
  basePrice: 100,
  currentTotal: 120,
  approvedDrawdown: 20,
  remainingAmount: 100,
  retentionPercent: null,
  retentionShortPercent: null,
  retentionShortAmount: null,
  retentionShortReleaseOn: null,
  retentionLongPercent: null,
  retentionLongAmount: null,
  retentionLongReleaseOn: null,
  warrantyMonths: null,
  warrantyEnd: null,
  warrantyRetentionPercent: null,
  warrantyRetentionReleaseOn: null,
  maturityDays: null,
  paymentTerms: null,
  signedAt: null,
  effectiveFrom: null,
  effectiveTo: null,
  documentUrl: null,
  documentStoragePath: null,
  documentFileName: null,
  amendments: [],
  ...overrides,
});

describe("redesign Smluvního přehledu", () => {
  it("lokalizuje uložené stavy bez změny jejich hodnot", () => {
    expect(CONTRACT_OVERVIEW_STATUS_LABELS).toEqual({
      draft: "Návrh",
      active: "Aktivní",
      closed: "Uzavřeno",
    });
  });

  it("kombinuje hledání, stavový filtr a více vybraných staveb", () => {
    const rows = [
      row({ contractId: "a", projectId: "p1", projectName: "Škola", contractStatus: "active" }),
      row({ contractId: "b", projectId: "p2", projectName: "Most", contractPartner: "Beton", contractStatus: "draft" }),
      row({ contractId: "c", projectId: "p3", projectName: "Bazén", contractStatus: "closed" }),
    ];

    expect(filterContractOverviewRows(rows, {
      query: "beton",
      projectIds: new Set(["p1", "p2"]),
      statuses: new Set(["draft", "active"]),
    }).map((item) => item.contractId)).toEqual(["b"]);
  });

  it("první výběr z režimu Všechny stavby zvolí právě jednu stavbu a poslední zrušení resetuje filtr", () => {
    const first = toggleContractOverviewProject(null, "p2");
    expect([...first!]).toEqual(["p2"]);

    const second = toggleContractOverviewProject(first, "p1");
    expect([...second!].sort()).toEqual(["p1", "p2"]);

    const oneRemaining = toggleContractOverviewProject(second, "p2");
    expect([...oneRemaining!]).toEqual(["p1"]);
    expect(toggleContractOverviewProject(oneRemaining, "p1")).toBeNull();
  });

  it("sjednocuje hover podklad řádku i přes sticky identifikační buňky", () => {
    const component = readFileSync(
      join(process.cwd(), "features/contracts-overview/ContractOverview.tsx"),
      "utf8",
    );
    const styles = readFileSync(join(process.cwd(), "index.css"), "utf8");

    expect(component).toContain('className="tf-contract-overview-row group');
    expect(component).not.toContain("{row.projectStatus}");
    expect(styles).toContain(".tf-contract-overview-row:hover > td");
    expect(styles).toContain("var(--tf-skin-card)");
  });

  it("nový RPC allowlist neobsahuje nabídky, VŘ ani faktury", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20260808200000_expand_contract_overview_columns.sql"),
      "utf8",
    );
    const body = migration.split("CREATE FUNCTION public.get_contract_overview")[1] || "";

    expect(body).toContain("c.document_url");
    expect(body).toContain("c.retention_short_percent");
    expect(body).toContain("c.retention_percent");
    expect(body).toContain("c.payment_terms");
    for (const forbidden of ["invoice_number", "source_bid_id", "extraction_json", "bids", "demand_categories"]) {
      expect(body).not.toContain(forbidden);
    }
  });

  it("exportuje dodatky samostatně bez druhého započtení do limitu smlouvy", () => {
    const exportRows = buildContractOverviewExportRows([
      row({
        currentTotal: 110,
        amendments: [{
          id: "amendment-1",
          amendmentNo: 1,
          status: null,
          signedAt: null,
          effectiveFrom: null,
          deltaPrice: -10,
          documentUrl: null,
          documentStoragePath: null,
          documentFileName: null,
        }],
      }),
    ], []);

    expect(exportRows[1][6]).toBe(110);
    expect(exportRows[2][6]).toBe("");
    expect(exportRows[2][9]).toBe(-10);
  });
});
