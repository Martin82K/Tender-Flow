import { describe, expect, it, vi } from "vitest";

vi.mock("@infra/db/dbAdapter", () => ({
  dbAdapter: { rpc: vi.fn() },
}));
import {
  formatContractOverviewMoney,
  mapContractOverviewRows,
} from "@/features/contracts-overview/api/contractOverviewApi";

describe("contract overview mapper", () => {
  it("maps only the public read-only allowlist", () => {
    const [result] = mapContractOverviewRows([{
      organization_id: "org-1", project_id: "project-1", project_name: "Stavba", project_status: "realization",
      contract_id: "contract-1", contract_partner: "Dodavatel", contract_title: "SOD", contract_number: "S-1",
      contract_status: "active", currency: "CZK", base_price: "100", current_total: "120",
      approved_drawdown: "25", remaining_amount: "95", retention_percent: "5", warranty_months: 60,
      signed_at: "2026-01-01", effective_from: "2026-02-01", effective_to: null,
      retention_short_percent: "3", retention_short_release_on: "2026-06-01",
      retention_long_percent: "2", retention_long_release_on: "2031-06-01",
      payment_terms: "30 dní", document_url: "https://drive.example/signed.pdf",
      document_storage_path: "projects/project-1/contracts/signed.pdf", document_file_name: "signed.pdf",
      amendments: [{ id: "a-1", amendment_no: 1, delta_price: "-10", document_url: "https://drive.example/amendment.pdf" }],
      extraction_json: { confidential: true }, invoice_number: "INV-1", source_bid_id: "bid-1",
    }]);

    expect(result).toMatchObject({
      contractPartner: "Dodavatel",
      currentTotal: 120,
      approvedDrawdown: 25,
      remainingAmount: 95,
      retentionShortPercent: 3,
      retentionShortReleaseOn: "2026-06-01",
      retentionLongPercent: 2,
      retentionLongReleaseOn: "2031-06-01",
      paymentTerms: "30 dní",
      documentUrl: "https://drive.example/signed.pdf",
      documentStoragePath: "projects/project-1/contracts/signed.pdf",
    });
    expect(result.amendments).toEqual([expect.objectContaining({ id: "a-1", amendmentNo: 1, deltaPrice: -10 })]);
    expect(result).not.toHaveProperty("extractionJson");
    expect(result).not.toHaveProperty("invoiceNumber");
    expect(result).not.toHaveProperty("sourceBidId");
  });

  it("normalizes historical currency labels without crashing the overview", () => {
    const [result] = mapContractOverviewRows([{ currency: "KČ" }]);

    expect(result.currency).toBe("CZK");
    expect(() => formatContractOverviewMoney(1250, "KČ")).not.toThrow();
    expect(formatContractOverviewMoney(1250, "invalid")).toContain("Kč");
  });
});
