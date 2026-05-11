import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient } from "../_shared/supabase.ts";

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "content-type": "application/json" },
  });

const numberOrNull = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const mapContract = (
  row: any,
  amendments: any[],
  drawdowns: any[],
  invoices: any[],
) => {
  const basePrice = numberOrNull(row.base_price) || 0;
  const amendmentTotal = amendments.reduce((sum, item) => sum + (numberOrNull(item.delta_price) || 0), 0);
  const approvedSum = drawdowns.reduce((sum, item) => sum + (numberOrNull(item.approved_amount) || 0), 0);
  const invoicedSum = invoices.reduce((sum, item) => sum + (numberOrNull(item.amount) || 0), 0);
  const paidSum = invoices
    .filter((item) => item.status === "paid")
    .reduce((sum, item) => sum + (numberOrNull(item.amount) || 0), 0);
  const overdueSum = invoices
    .filter((item) => item.status === "overdue")
    .reduce((sum, item) => sum + (numberOrNull(item.amount) || 0), 0);
  const currentTotal = basePrice + amendmentTotal;

  return {
    id: row.id,
    projectId: row.project_id,
    vendorId: row.vendor_id || null,
    vendorName: row.vendor_name || "",
    vendorIco: row.vendor_ico || null,
    title: row.title || "",
    contractNumber: row.contract_number || null,
    status: row.status || null,
    signedAt: row.signed_at || null,
    effectiveFrom: row.effective_from || null,
    effectiveTo: row.effective_to || null,
    completionDate: row.completion_date || null,
    currency: row.currency || "CZK",
    basePrice,
    currentTotal,
    approvedSum,
    remaining: currentTotal - approvedSum,
    invoicedSum,
    paidSum,
    overdueSum,
    retentionPercent: numberOrNull(row.retention_percent),
    retentionAmount: numberOrNull(row.retention_amount),
    retentionShortPercent: numberOrNull(row.retention_short_percent),
    retentionShortAmount: numberOrNull(row.retention_short_amount),
    retentionShortReleaseOn: row.retention_short_release_on || null,
    retentionShortStatus: row.retention_short_status || null,
    retentionLongPercent: numberOrNull(row.retention_long_percent),
    retentionLongAmount: numberOrNull(row.retention_long_amount),
    retentionLongReleaseOn: row.retention_long_release_on || null,
    retentionLongStatus: row.retention_long_status || null,
    siteSetupPercent: numberOrNull(row.site_setup_percent),
    warrantyMonths: numberOrNull(row.warranty_months),
    paymentTerms: row.payment_terms || null,
    scopeSummary: row.scope_summary || null,
    source: row.source || null,
    sourceBidId: row.source_bid_id || null,
    documentUrl: row.document_url || null,
    extractionConfidence: numberOrNull(row.extraction_confidence),
    vendorRating: numberOrNull(row.vendor_rating),
    vendorRatingNote: row.vendor_rating_note || null,
    amendments: amendments.map((item) => ({
      id: item.id,
      contractId: item.contract_id,
      amendmentNo: item.amendment_no,
      signedAt: item.signed_at || null,
      effectiveFrom: item.effective_from || null,
      deltaPrice: numberOrNull(item.delta_price) || 0,
      deltaDeadline: item.delta_deadline || null,
      reason: item.reason || null,
      documentUrl: item.document_url || null,
    })),
    drawdowns: drawdowns.map((item) => ({
      id: item.id,
      contractId: item.contract_id,
      period: item.period,
      claimedAmount: numberOrNull(item.claimed_amount) || 0,
      approvedAmount: numberOrNull(item.approved_amount) || 0,
      note: item.note || null,
      documentUrl: item.document_url || null,
    })),
    invoices: invoices.map((item) => ({
      id: item.id,
      contractId: item.contract_id,
      invoiceNumber: item.invoice_number,
      issueDate: item.issue_date,
      dueDate: item.due_date,
      amount: numberOrNull(item.amount) || 0,
      currency: item.currency || "CZK",
      status: item.status || null,
      paidAt: item.paid_at || null,
      note: item.note || null,
      documentUrl: item.document_url || null,
    })),
  };
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) return json(req, 401, { error: "Unauthorized" });

    const body = await req.json().catch(() => ({}));
    const projectId = typeof body?.projectId === "string" ? body.projectId : null;
    if (!projectId) return json(req, 400, { error: "Missing projectId" });

    // Fetch project, demand_categories, and bids in parallel
    const [projectRes, categoriesRes] = await Promise.all([
      authed
        .from("projects")
        .select("id,name,location,status,finish_date,investor")
        .eq("id", projectId)
        .single(),
      authed
        .from("demand_categories")
        .select("id,title,status,deadline,budget_display,plan_budget")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
    ]);

    if (projectRes.error) return json(req, 500, { error: projectRes.error.message });
    if (!projectRes.data) return json(req, 404, { error: "Project not found" });

    const categoryIds = (categoriesRes.data || []).map((c: any) => c.id);

    // Fetch bids for all demand categories
    let bids: any[] = [];
    if (categoryIds.length > 0) {
      const bidsRes = await authed
        .from("bids")
        .select("id,category_id,subcontractor_id,price,price_display,notes,status,contracted,subcontractors(company_name,contact_person_name,email,phone)")
        .in("category_id", categoryIds);
      if (!bidsRes.error) {
        bids = bidsRes.data || [];
      }
    }

    const contractsRes = await authed
      .from("contracts")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    const contractRows = contractsRes.error ? [] : contractsRes.data || [];
    const contractIds = contractRows.map((contract: any) => contract.id);
    let amendments: any[] = [];
    let drawdowns: any[] = [];
    let invoices: any[] = [];
    if (contractIds.length > 0) {
      const [amendmentsRes, drawdownsRes, invoicesRes] = await Promise.all([
        authed.from("contract_amendments").select("*").in("contract_id", contractIds).order("amendment_no", { ascending: true }),
        authed.from("contract_drawdowns").select("*").in("contract_id", contractIds).order("period", { ascending: true }),
        authed.from("contract_invoices").select("*").in("contract_id", contractIds).order("due_date", { ascending: true }),
      ]);
      amendments = amendmentsRes.error ? [] : amendmentsRes.data || [];
      drawdowns = drawdownsRes.error ? [] : drawdownsRes.data || [];
      invoices = invoicesRes.error ? [] : invoicesRes.data || [];
    }

    const project = {
      id: projectRes.data.id,
      name: projectRes.data.name,
      location: projectRes.data.location || null,
      status: projectRes.data.status || null,
      finishDate: projectRes.data.finish_date || null,
      investor: projectRes.data.investor || null,
    };

    const demandCategories = (categoriesRes.data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      status: row.status || null,
      deadline: row.deadline || null,
      budgetDisplay: row.budget_display || null,
      planBudget: row.plan_budget || null,
    }));

    const mappedBids = bids.map((row: any) => ({
      id: row.id,
      categoryId: row.category_id,
      subcontractorId: row.subcontractor_id,
      companyName: row.subcontractors?.company_name || null,
      contactPerson: row.subcontractors?.contact_person_name || null,
      email: row.subcontractors?.email || null,
      phone: row.subcontractors?.phone || null,
      price: row.price || null,
      priceDisplay: row.price_display || null,
      notes: row.notes || null,
      status: row.status || null,
      contracted: Boolean(row.contracted),
    }));

    const contracts = contractRows.map((contract: any) =>
      mapContract(
        contract,
        amendments.filter((item) => item.contract_id === contract.id),
        drawdowns.filter((item) => item.contract_id === contract.id),
        invoices.filter((item) => item.contract_id === contract.id),
      ),
    );

    return json(req, 200, { project, demandCategories, bids: mappedBids, contracts });
  } catch (error) {
    return json(req, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
