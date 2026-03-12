import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { mapContractWithDetailsToSummaryDto } from "../shared/contracts/contractSummary";

describe("contracts summary API docs", () => {
  it("OpenAPI example odpovídá ContractSummaryDto kontraktu", () => {
    const openApiSpec = JSON.parse(
      readFileSync("docs/api/contracts-summary.openapi.json", "utf8"),
    );
    const example =
      openApiSpec.paths["/projects/{projectId}/contracts/summary"].get.responses["200"].content[
        "application/json"
      ].example[0];

    const dto = mapContractWithDetailsToSummaryDto({
      id: "contract-1",
      projectId: "project-1",
      vendorName: "KLIMA - ELEKTRON s.r.o.",
      title: "VZT",
      contractNumber: "SOD-2026-001",
      status: "active",
      currency: "CZK",
      basePrice: 100000,
      currentTotal: 125000,
      approvedSum: 30000,
      remaining: 95000,
      retentionPercent: 5,
      siteSetupPercent: 2,
      warrantyMonths: 24,
      paymentTerms: "21 dní",
      scopeSummary: "Vzduchotechnika",
      source: "manual",
      amendments: [],
      drawdowns: [],
    });

    expect(Object.keys(example).sort()).toEqual(Object.keys(dto).sort());
  });
});
