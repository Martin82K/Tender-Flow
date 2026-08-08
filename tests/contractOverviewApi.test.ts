import { describe, expect, it, vi } from "vitest";

vi.mock("@infra/db/dbAdapter", () => ({
  dbAdapter: { rpc: vi.fn() },
}));
import { mapContractOverviewRows } from "@/features/contracts-overview/api/contractOverviewApi";

describe("contract overview mapper", () => {
  it("maps only the public read-only allowlist", () => {
    const [result] = mapContractOverviewRows([{
      organization_id: "org-1", project_id: "project-1", project_name: "Stavba", project_status: "realization",
      contract_id: "contract-1", contract_partner: "Dodavatel", contract_title: "SOD", contract_number: "S-1",
      contract_status: "active", currency: "CZK", base_price: "100", current_total: "120",
      approved_drawdown: "25", remaining_amount: "95", retention_percent: "5", warranty_months: 60,
      signed_at: "2026-01-01", effective_from: "2026-02-01", effective_to: null,
      document_url: "secret.pdf", extraction_json: { confidential: true }, invoice_number: "INV-1", source_bid_id: "bid-1",
    }]);

    expect(result).toMatchObject({ contractPartner: "Dodavatel", currentTotal: 120, approvedDrawdown: 25, remainingAmount: 95 });
    expect(result).not.toHaveProperty("documentUrl");
    expect(result).not.toHaveProperty("extractionJson");
    expect(result).not.toHaveProperty("invoiceNumber");
    expect(result).not.toHaveProperty("sourceBidId");
  });
});
