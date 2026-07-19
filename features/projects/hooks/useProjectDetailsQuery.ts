import { useQueries, useQuery } from "@tanstack/react-query";

import { projectDemoDataApi } from "@features/projects/api/projectDemoDataApi";
import { applyLocalBudgetAttachments } from "@features/projects/model/budgetAttachmentLocalStore";
import { dbAdapter } from "@infra/db/dbAdapter";
import { withRetry } from "@shared/async/asyncControl";
import type {
  ActiveProjectStatus,
  Bid,
  DemandCategory,
  DocumentLink,
  InvestorInvoice,
  Project,
  ProjectDetails,
} from "@/types";

interface QueryResponse<T> {
  data: T | null;
  error: unknown;
}

interface ProjectDetailsRow {
  id: string;
  name: string;
  status?: ProjectDetails["status"] | null;
  archived_original_status?: ActiveProjectStatus | null;
  investor?: string | null;
  technical_supervisor?: string | null;
  location?: string | null;
  finish_date?: string | null;
  site_manager?: string | null;
  construction_manager?: string | null;
  construction_technician?: string | null;
  planned_cost?: number | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geocoded_at?: string | null;
  documentation_link?: string;
  document_links?: DocumentLink[] | null;
  inquiry_letter_link?: string;
  material_inquiry_template_link?: string;
  losers_email_template_link?: string;
  price_list_link?: string;
  dochub_enabled?: boolean | null;
  dochub_root_link?: string | null;
  dochub_provider?: ProjectDetails["docHubProvider"];
  dochub_mode?: ProjectDetails["docHubMode"];
  dochub_root_id?: string | null;
  dochub_root_name?: string | null;
  dochub_drive_id?: string | null;
  dochub_site_id?: string | null;
  dochub_root_web_url?: string | null;
  dochub_status?: ProjectDetails["docHubStatus"];
  dochub_last_error?: string | null;
  dochub_structure_v1?: ProjectDetails["docHubStructureV1"];
  dochub_structure_version?: number | null;
  dochub_autocreate_enabled?: boolean | null;
  dochub_autocreate_last_run_at?: string | null;
  dochub_autocreate_last_error?: string | null;
  dochub_settings?: ProjectDetails["docHubSettings"];
}

interface DemandCategoryRow {
  id: string;
  title: string;
  budget_display?: string | null;
  sod_budget?: number | null;
  plan_budget?: number | null;
  status?: DemandCategory["status"] | null;
  description?: string | null;
  work_items?: string[] | null;
  deadline?: string | null;
  realization_start?: string | null;
  realization_end?: string | null;
  created_at?: string | null;
  documents?: DemandCategory["documents"];
}

interface ContractRow {
  maturity_days?: number | null;
  warranty_months?: number | null;
  retention_terms?: string | null;
  site_facilities_percent?: number | null;
  insurance_percent?: number | null;
}

interface FinancialsRow {
  sod_price?: number | null;
}

interface AmendmentRow {
  id: string;
  label: string;
  price?: number | null;
}

interface InvestorInvoiceRow {
  id: string;
  invoice_number?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: InvestorInvoice["status"] | null;
  paid_at?: string | null;
  note?: string | null;
}

interface BidRow {
  id: string;
  demand_category_id: string;
  subcontractor_id: string;
  company_name: string;
  contact_person: string;
  email?: string;
  phone?: string;
  price_display?: string | null;
  price?: string | number | null;
  price_history?: Bid["priceHistory"];
  notes?: string;
  tags?: string[];
  status: Bid["status"];
  update_date?: string;
  selection_round?: number;
  contracted?: boolean | null;
}

export const PROJECT_DETAILS_KEYS = {
  all: ["projectDetails"] as const,
  detail: (projectId: string) =>
    [...PROJECT_DETAILS_KEYS.all, projectId] as const,
};

const fetchProjectDetails = async (
  projectId: string,
): Promise<ProjectDetails> => {
  if (
    projectDemoDataApi.isDemoSession() ||
    projectDemoDataApi.isDemoProjectId(projectId)
  ) {
    return projectDemoDataApi.getProjectDetails(projectId);
  }

  const [
    projectRes,
    categoriesRes,
    contractRes,
    financialsRes,
    amendmentsRes,
    internalAmendmentsRes,
    investorInvoicesRes,
  ] = await Promise.all([
    withRetry<QueryResponse<ProjectDetailsRow>>(async () =>
      dbAdapter.from("projects").select("*").eq("id", projectId).single(),
    ),
    withRetry<QueryResponse<DemandCategoryRow[]>>(async () =>
      dbAdapter
        .from("demand_categories")
        .select("*")
        .eq("project_id", projectId),
    ),
    withRetry<QueryResponse<ContractRow | null>>(async () =>
      dbAdapter
        .from("project_contracts")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle(),
    ),
    withRetry<QueryResponse<FinancialsRow | null>>(async () =>
      dbAdapter
        .from("project_investor_financials")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle(),
    ),
    withRetry<QueryResponse<AmendmentRow[]>>(async () =>
      dbAdapter
        .from("project_amendments")
        .select("*")
        .eq("project_id", projectId),
    ),
    withRetry<QueryResponse<AmendmentRow[]>>(async () =>
      dbAdapter
        .from("project_internal_amendments")
        .select("*")
        .eq("project_id", projectId),
    ),
    withRetry<QueryResponse<InvestorInvoiceRow[]>>(async () =>
      dbAdapter
        .from("project_investor_invoices")
        .select("*")
        .eq("project_id", projectId)
        .order("due_date", { ascending: true }),
    ),
  ]);

  if (projectRes.error) throw projectRes.error;
  if (categoriesRes.error) throw categoriesRes.error;
  if (contractRes.error) throw contractRes.error;
  if (financialsRes.error) throw financialsRes.error;
  if (amendmentsRes.error) throw amendmentsRes.error;
  if (internalAmendmentsRes.error) throw internalAmendmentsRes.error;
  if (investorInvoicesRes.error) throw investorInvoicesRes.error;
  if (!projectRes.data) {
    throw new Error("Projekt nebyl při načítání detailu nalezen.");
  }

  const project = projectRes.data;
  const categories: DemandCategory[] = applyLocalBudgetAttachments(
    projectId,
    (categoriesRes.data || []).map((category) => ({
      id: category.id,
      title: category.title,
      budget: category.budget_display || "",
      sodBudget: category.sod_budget || 0,
      planBudget: category.plan_budget || 0,
      status: category.status || "open",
      subcontractorCount: 0,
      description: category.description || "",
      workItems: category.work_items || [],
      deadline: category.deadline || undefined,
      realizationStart: category.realization_start || undefined,
      realizationEnd: category.realization_end || undefined,
      createdAt: category.created_at || undefined,
      documents: category.documents || [],
    })),
  );

  const contractData = contractRes.data;
  const financialsData = financialsRes.data;
  const amendmentsData = amendmentsRes.data || [];
  const internalAmendmentsData = internalAmendmentsRes.data || [];
  const investorInvoicesData = investorInvoicesRes.data || [];
  const categoryIds = categories.map((category) => category.id);
  const bidsRecord: Record<string, Bid[]> = {};

  if (categoryIds.length > 0) {
    const bidsRes = await withRetry<QueryResponse<BidRow[]>>(async () =>
      dbAdapter
        .from("bids")
        .select("*")
        .in("demand_category_id", categoryIds),
    );

    if (bidsRes.error) throw bidsRes.error;

    const bidsData = bidsRes.data || [];
    bidsData.forEach((bid) => {
      const categoryId = bid.demand_category_id;
      if (!bidsRecord[categoryId]) bidsRecord[categoryId] = [];

      bidsRecord[categoryId].push({
        id: bid.id,
        subcontractorId: bid.subcontractor_id,
        companyName: bid.company_name,
        contactPerson: bid.contact_person,
        email: bid.email,
        phone: bid.phone,
        price:
          bid.price_display || (bid.price != null ? bid.price.toString() : undefined),
        priceHistory: bid.price_history || undefined,
        notes: bid.notes,
        tags: bid.tags,
        status: bid.status,
        updateDate: bid.update_date,
        selectionRound: bid.selection_round,
        contracted: bid.contracted || false,
      });
    });

    categories.forEach((category) => {
      category.subcontractorCount = bidsRecord[category.id]?.length || 0;
    });
  }

  return {
    id: project.id,
    title: project.name,
    status: project.status || "realization",
    archivedOriginalStatus:
      (project.archived_original_status as ActiveProjectStatus | null) ?? null,
    investor: project.investor || "",
    technicalSupervisor: project.technical_supervisor || "",
    location: project.location || "",
    finishDate: project.finish_date || "",
    siteManager: project.site_manager || "",
    constructionManager: project.construction_manager || "",
    constructionTechnician: project.construction_technician || "",
    plannedCost: project.planned_cost || 0,
    address: project.address || "",
    latitude: project.latitude ?? undefined,
    longitude: project.longitude ?? undefined,
    geocodedAt: project.geocoded_at ?? undefined,
    internalAmendments: internalAmendmentsData.map((amendment) => ({
      id: amendment.id,
      label: amendment.label,
      price: amendment.price || 0,
    })),
    documentationLink: project.documentation_link,
    documentLinks: project.document_links || [],
    inquiryLetterLink: project.inquiry_letter_link,
    materialInquiryTemplateLink: project.material_inquiry_template_link,
    losersEmailTemplateLink: project.losers_email_template_link,
    priceListLink: project.price_list_link,
    docHubEnabled: project.dochub_enabled ?? false,
    docHubRootLink: project.dochub_root_link ?? "",
    docHubProvider: project.dochub_provider ?? null,
    docHubMode: project.dochub_mode ?? null,
    docHubRootId: project.dochub_root_id ?? null,
    docHubRootName: project.dochub_root_name ?? null,
    docHubDriveId: project.dochub_drive_id ?? null,
    docHubSiteId: project.dochub_site_id ?? null,
    docHubRootWebUrl: project.dochub_root_web_url ?? null,
    docHubStatus:
      project.dochub_status ??
      (project.dochub_root_link ? "connected" : "disconnected"),
    docHubLastError: project.dochub_last_error ?? null,
    docHubStructureV1: project.dochub_structure_v1 ?? null,
    docHubStructureVersion: project.dochub_structure_version ?? 1,
    docHubAutoCreateEnabled: project.dochub_autocreate_enabled ?? false,
    docHubAutoCreateLastRunAt: project.dochub_autocreate_last_run_at ?? null,
    docHubAutoCreateLastError: project.dochub_autocreate_last_error ?? null,
    docHubSettings: project.dochub_settings ?? {},
    categories,
    contract: contractData
      ? {
          maturity: contractData.maturity_days ?? 30,
          warranty: contractData.warranty_months ?? 60,
          retention: contractData.retention_terms || "",
          siteFacilities: contractData.site_facilities_percent ?? 0,
          insurance: contractData.insurance_percent ?? 0,
        }
      : undefined,
    investorFinancials:
      financialsData || amendmentsData.length > 0 || investorInvoicesData.length > 0
        ? {
            sodPrice: financialsData?.sod_price || 0,
            amendments: amendmentsData.map((amendment) => ({
              id: amendment.id,
              label: amendment.label,
              price: amendment.price || 0,
            })),
            invoices: investorInvoicesData.map((invoice) => ({
              id: invoice.id,
              invoiceNumber: invoice.invoice_number || "",
              issueDate: invoice.issue_date || "",
              dueDate: invoice.due_date || "",
              amount: invoice.amount || 0,
              currency: invoice.currency || "CZK",
              status: invoice.status || "issued",
              paidAt: invoice.paid_at || undefined,
              note: invoice.note || undefined,
            })),
          }
        : undefined,
    bids: bidsRecord,
  };
};

export const useProjectDetailsQuery = (
  projectId: string | undefined,
  enabled = true,
) =>
  useQuery({
    queryKey: PROJECT_DETAILS_KEYS.detail(projectId!),
    queryFn: () => fetchProjectDetails(projectId!),
    enabled: !!projectId && enabled,
    staleTime: 5 * 60 * 1000,
  });

export const useAllProjectDetailsQuery = (projects: Project[]) =>
  useQueries({
    queries: projects.map((project) => ({
      queryKey: PROJECT_DETAILS_KEYS.detail(project.id),
      queryFn: () => fetchProjectDetails(project.id),
      staleTime: 5 * 60 * 1000,
    })),
    combine: (results) => {
      const data: Record<string, ProjectDetails> = {};
      let isLoading = false;
      let isError = false;

      results.forEach((result) => {
        if (result.data) data[result.data.id!] = result.data;
        if (result.isLoading) isLoading = true;
        if (result.isError) isError = true;
      });

      return { data, isLoading, isError, results };
    },
  });
