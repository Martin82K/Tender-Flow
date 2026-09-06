import { dbAdapter } from "@infra/db/dbAdapter";
import type { ActiveProjectStatus, Bid, DemandCategory, Project, ProjectDetails } from "@/types";
import type { OverviewTenantData } from "@features/projects/model/overviewTenantData";

const PAGE_SIZE = 500;
const BATCH_SIZE = 100;

const readRows = async <Row>(table: string, columns: string, column: string, ids: string[], order = "id"): Promise<Row[]> => {
  const rows: Row[] = [];
  for (let batchStart = 0; batchStart < ids.length; batchStart += BATCH_SIZE) {
    const batch = ids.slice(batchStart, batchStart + BATCH_SIZE);
    const allowedIds = new Set(batch);
    for (let start = 0; ; start += PAGE_SIZE) {
      const { data, error } = await dbAdapter.from(table).select(columns)
        .in(column, batch).order(order).range(start, start + PAGE_SIZE - 1);
      if (error) throw error;
      const page = (data ?? []) as Row[];
      rows.push(...page.filter(row => allowedIds.has(String((row as Record<string, unknown>)[column]))));
      if (page.length < PAGE_SIZE) break;
    }
  }
  return rows;
};

interface ProjectRow {
  id: string;
  name: string;
  location?: string | null;
  status?: Project["status"] | null;
  organization_id?: string | null;
  finish_date?: string | null;
  archived_original_status?: ActiveProjectStatus | null;
}
interface CategoryRow {
  id: string;
  project_id: string;
  title: string;
  budget_display?: string | null;
  sod_budget?: number | null;
  plan_budget?: number | null;
  status?: DemandCategory["status"] | null;
  deadline?: string | null;
  documents?: DemandCategory["documents"] | null;
  realization_start?: string | null;
  realization_end?: string | null;
}
interface BidRow {
  id: string;
  demand_category_id: string;
  subcontractor_id: string;
  company_name: string;
  status: Bid["status"];
  price?: number | null;
  price_display?: string | null;
  update_date?: string | null;
}
interface FinancialRow { project_id: string; sod_price: number | null }
interface AmendmentRow { id: string; project_id: string; label: string | null; price: number | null }

/** Personal projects are outside the tenant RPC. Read only analytical columns under normal RLS. */
export const fetchPersonalProjectOverview = async (visiblePersonalIds: string[]): Promise<OverviewTenantData> => {
  const projectRows = (await readRows<ProjectRow>("projects",
    "id,name,location,status,organization_id,finish_date,archived_original_status", "id", visiblePersonalIds))
    .filter(project => !project.organization_id);
  const ids = projectRows.map(project => project.id);
  if (ids.length === 0) return { projects: [], projectDetails: {} };

  const [categories, financials, amendments] = await Promise.all([
    readRows<CategoryRow>("demand_categories", "id,project_id,title,budget_display,sod_budget,plan_budget,status,deadline,documents,realization_start,realization_end", "project_id", ids),
    readRows<FinancialRow>("project_investor_financials", "project_id,sod_price", "project_id", ids, "project_id"),
    readRows<AmendmentRow>("project_amendments", "id,project_id,label,price", "project_id", ids),
  ]);
  const bids = await readRows<BidRow>("bids", "id,demand_category_id,subcontractor_id,company_name,status,price,price_display,update_date",
    "demand_category_id", categories.map(category => category.id));
  const bidsByCategory: Record<string, Bid[]> = {};
  for (const bid of bids) {
    (bidsByCategory[bid.demand_category_id] ??= []).push({
      id: bid.id, subcontractorId: bid.subcontractor_id, companyName: bid.company_name,
      contactPerson: "", status: bid.status,
      price: bid.price_display ?? (bid.price == null ? undefined : String(bid.price)),
      updateDate: bid.update_date ?? undefined,
    });
  }
  const projectDetails: Record<string, ProjectDetails> = {};
  for (const project of projectRows) {
    const projectCategories = categories.filter(category => category.project_id === project.id);
    const financial = financials.find(row => row.project_id === project.id);
    const projectAmendments = amendments.filter(row => row.project_id === project.id);
    projectDetails[project.id] = {
      id: project.id, title: project.name, location: project.location ?? "", finishDate: project.finish_date ?? "", siteManager: "",
      categories: projectCategories.map(category => ({
        id: category.id, title: category.title, description: "", budget: category.budget_display ?? "",
        sodBudget: category.sod_budget ?? 0, planBudget: category.plan_budget ?? 0, status: category.status ?? "open",
        subcontractorCount: bidsByCategory[category.id]?.length ?? 0,
        deadline: category.deadline ?? undefined, documents: category.documents ?? [],
        realizationStart: category.realization_start ?? undefined, realizationEnd: category.realization_end ?? undefined,
      })),
      bids: Object.fromEntries(projectCategories.map(category => [category.id, bidsByCategory[category.id] ?? []])),
      ...(financial || projectAmendments.length ? { investorFinancials: {
        sodPrice: financial?.sod_price ?? 0,
        amendments: projectAmendments.map(row => ({ id: row.id, label: row.label ?? "", price: row.price ?? 0 })),
      } } : {}),
    };
  }
  return {
    projects: projectRows.map(project => ({
      id: project.id, name: project.name, location: project.location ?? "", status: project.status ?? "realization",
      archivedOriginalStatus: project.archived_original_status ?? null,
    })),
    projectDetails,
  };
};
