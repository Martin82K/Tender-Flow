import { useQuery, useQueries, UseQueryOptions } from "@tanstack/react-query";
import { supabase } from "../../services/supabase";
import { withRetry, withTimeout } from "../../utils/helpers";
import { Project, ProjectDetails, DemandCategory, Bid } from "../../types";
import { isDemoSession, DEMO_PROJECT_DETAILS, DEMO_PROJECT } from "../../services/demoData";

export const PROJECT_DETAILS_KEYS = {
    all: ["projectDetails"] as const,
    detail: (projectId: string) => [...PROJECT_DETAILS_KEYS.all, projectId] as const,
};

// Helper: Fetch details for a single project
const fetchProjectDetails = async (projectId: string): Promise<ProjectDetails> => {
    // Check for demo project
    if (isDemoSession() || projectId === DEMO_PROJECT.id || projectId === 'demo-project-1') {
        const demoData = localStorage.getItem('demo_data');
        if (demoData) {
            try {
                const parsed = JSON.parse(demoData);
                if (parsed.projectDetails && parsed.projectDetails[projectId]) {
                    return parsed.projectDetails[projectId];
                }
            } catch (e) {
                console.error("Failed to parse demo data", e);
            }
        }
        return DEMO_PROJECT_DETAILS;
    }

    // 1. Fetch metadata in parallel
    const [
        projectRes,
        categoriesRes,
        contractRes,
        financialsRes,
        amendmentsRes,
    ] = await Promise.all([
        withRetry<any>(async () => await supabase.from("projects").select("*").eq("id", projectId).single()),
        withRetry<any>(async () => await supabase.from("demand_categories").select("*").eq("project_id", projectId)),
        withRetry<any>(async () => await supabase.from("project_contracts").select("*").eq("project_id", projectId).maybeSingle()),
        withRetry<any>(async () => await supabase.from("project_investor_financials").select("*").eq("project_id", projectId).maybeSingle()),
        withRetry<any>(async () => await supabase.from("project_amendments").select("*").eq("project_id", projectId)),
    ]);

    if (projectRes.error) throw projectRes.error;
    if (categoriesRes.error) throw categoriesRes.error;
    // Contract/Financials might be null, but error if request failed
    if (contractRes.error) throw contractRes.error;
    if (financialsRes.error) throw financialsRes.error;
    if (amendmentsRes.error) throw amendmentsRes.error;

    const project = projectRes.data;
    const categories: DemandCategory[] = (categoriesRes.data || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        budget: c.budget_display || "",
        sodBudget: c.sod_budget || 0,
        planBudget: c.plan_budget || 0,
        status: c.status || "open",
        subcontractorCount: 0,
        description: c.description || "",
        workItems: c.work_items || [],
        deadline: c.deadline || undefined,
        realizationStart: c.realization_start || undefined,
        realizationEnd: c.realization_end || undefined,
        documents: c.documents || [], // assuming documents might be fetched or joined? useAppData didn't map documents here explicitly in the view I saw, but interface has it.
    }));

    const contractData = contractRes.data;
    const financialsData = financialsRes.data;
    const amendmentsData = (amendmentsRes.data || []) as any[];

    // 2. Fetch Bids for these categories
    const categoryIds = categories.map(c => c.id);
    let bidsRecord: Record<string, Bid[]> = {};

    if (categoryIds.length > 0) {
        const bidsRes = await withRetry<any>(async () =>
            await supabase.from("bids").select("*").in("demand_category_id", categoryIds)
        );

        if (bidsRes.error) throw bidsRes.error;

        const bidsData = (bidsRes.data || []) as any[];

        bidsData.forEach(bid => {
            const catId = bid.demand_category_id;
            if (!bidsRecord[catId]) bidsRecord[catId] = [];

            bidsRecord[catId].push({
                id: bid.id,
                subcontractorId: bid.subcontractor_id,
                companyName: bid.company_name,
                contactPerson: bid.contact_person,
                email: bid.email,
                phone: bid.phone,
                price: bid.price_display || (bid.price ? bid.price.toString() : null),
                priceHistory: bid.price_history || undefined,
                notes: bid.notes,
                tags: bid.tags,
                status: bid.status,
                updateDate: bid.update_date,
                selectionRound: bid.selection_round,
                contracted: bid.contracted || false,
            });
        });

        // Update subcontractor counts
        categories.forEach(c => {
            c.subcontractorCount = bidsRecord[c.id]?.length || 0;
        });
    }

    // Construct Result
    return {
        id: project.id,
        title: project.name,
        status: project.status || "realization",
        investor: project.investor || "",
        technicalSupervisor: project.technical_supervisor || "",
        location: project.location || "",
        finishDate: project.finish_date || "",
        siteManager: project.site_manager || "",
        constructionManager: project.construction_manager || "",
        constructionTechnician: project.construction_technician || "",
        plannedCost: project.planned_cost || 0,
        documentationLink: project.documentation_link,
        documentLinks: project.document_links || [],
        inquiryLetterLink: project.inquiry_letter_link,
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
        docHubStatus: project.dochub_status ?? (project.dochub_root_link ? "connected" : "disconnected"),
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
        investorFinancials: financialsData
            ? {
                sodPrice: financialsData.sod_price || 0,
                amendments: amendmentsData.map((a) => ({
                    id: a.id,
                    label: a.label,
                    price: a.price || 0,
                })),
            }
            : undefined,
        bids: bidsRecord
    };
};

export const useProjectDetailsQuery = (projectId: string | undefined, enabled = true) => {
    return useQuery({
        queryKey: PROJECT_DETAILS_KEYS.detail(projectId!),
        queryFn: () => fetchProjectDetails(projectId!),
        enabled: !!projectId && enabled,
        staleTime: 5 * 60 * 1000,
    });
};

export const useAllProjectDetailsQuery = (projects: Project[]) => {
    return useQueries({
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
                if (result.data) {
                    data[result.data.id!] = result.data; // Ensure ID is mapped
                }
                if (result.isLoading) isLoading = true;
                if (result.isError) isError = true;
            });

            return {
                data,
                isLoading,
                isError,
                results // raw results if needed
            };
        },
    });
};
