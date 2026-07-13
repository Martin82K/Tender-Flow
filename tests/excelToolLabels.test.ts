import fs from "node:fs";
import path from "node:path";

import { TOOLS_NAV_ITEM } from "@/config/navigation";
import { PRICING_CONFIG } from "@/services/billingService";

const ROOT = process.cwd();

describe("excel tool labels", () => {
  it("uses the Czech product names in navigation and pricing", () => {
    const labels = Object.fromEntries(
      (TOOLS_NAV_ITEM.children || []).map((item) => [item.id, item.label]),
    );

    expect(labels["settings-excelunlocker-pro"]).toBe("Excel – odemčení");
    expect(labels["settings-excelmerger-pro"]).toBe("Excel Spojení listů");
    expect(labels["settings-excel-indexer"]).toBe("Excel Indexace VŘ");
    expect(PRICING_CONFIG.starter.features).toContain("Excel – odemčení");
    expect(PRICING_CONFIG.pro.features).toContain("Excel Spojení listů");
    expect(PRICING_CONFIG.enterprise.features).toContain("Excel Indexace VŘ");
  });

  it("keeps stable feature keys while migrating their display names", () => {
    const migration = fs.readFileSync(
      path.join(
        ROOT,
        "supabase/migrations/20260713203534_rename_excel_tools.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("when 'excel_unlocker' then 'Excel – odemčení'");
    expect(migration).toContain("when 'excel_merger' then 'Excel Spojení listů'");
    expect(migration).toContain("when 'excel_indexer' then 'Excel Indexace VŘ'");
    expect(migration).toContain(
      "where key in ('excel_unlocker', 'excel_merger', 'excel_indexer')",
    );
  });
});
