import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dbAdapter } from "../../services/dbAdapter";
import { Project, ProjectDetails, DemandCategory } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { PROJECT_KEYS } from "../queries/useProjectsQuery";
import { PROJECT_DETAILS_KEYS } from "../queries/useProjectDetailsQuery";
import { OVERVIEW_TENANT_DATA_KEY } from "../queries/useOverviewTenantDataQuery";
import { getDemoData, saveDemoData } from "../../services/demoData";
import { invokeAuthedFunction } from "../../services/functionsClient";
import { ensureStructure } from "../../services/fileSystemService";
import { buildHierarchyTree, isProbablyUrl, resolveDocHubStructureV1 } from "../../utils/docHub";

// Helper for DocHub Sync
const syncDocHubCategory = async (projectId: string, action: "upsert" | "archive", categoryId: string, categoryTitle?: string) => {
    try {
        await invokeAuthedFunction("dochub-sync-category", {
            body: { projectId, categoryId, categoryTitle, action },
        });
    } catch (e) {
        console.error("DocHub sync failed", e);
    }
};

export const useAddProjectMutation = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (newProject: Project) => {
            if (user?.role === "demo") {
                const demoData = getDemoData();
                if (demoData) {
                    demoData.projects = [newProject, ...demoData.projects];
                    demoData.projectDetails[newProject.id] = {
                        id: newProject.id,
                        title: newProject.name,
                        location: newProject.location,
                        categories: []
                    } as any;
                    saveDemoData(demoData);
                }
                return newProject;
            }

            const { error } = await dbAdapter.from("projects").insert({
                id: newProject.id,
                name: newProject.name,
                location: newProject.location,
                status: newProject.status,
                owner_id: user?.id,
            });
            if (error) throw error;
            return newProject;
        },
        onMutate: async (newProject) => {
            await queryClient.cancelQueries({ queryKey: PROJECT_KEYS.list() });
            const previousProjects = queryClient.getQueryData<Project[]>(PROJECT_KEYS.list());
            queryClient.setQueryData<Project[]>(PROJECT_KEYS.list(), (old) => [newProject, ...(old || [])]);
            return { previousProjects };
        },
        onError: (_err, _newProject, context) => {
            queryClient.setQueryData(PROJECT_KEYS.list(), context?.previousProjects);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.list() });
            queryClient.invalidateQueries({ queryKey: OVERVIEW_TENANT_DATA_KEY });
        },
    });
};

export const useDeleteProjectMutation = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (id: string) => {
            if (user?.role === "demo") {
                const demoData = getDemoData();
                if (demoData) {
                    demoData.projects = demoData.projects.filter(p => p.id !== id);
                    delete demoData.projectDetails[id];
                    saveDemoData(demoData);
                }
                return id;
            }

            const { error } = await dbAdapter.from("projects").delete().eq("id", id);
            if (error) throw error;
            return id;
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: PROJECT_KEYS.list() });
            const previousProjects = queryClient.getQueryData<Project[]>(PROJECT_KEYS.list());
            queryClient.setQueryData<Project[]>(PROJECT_KEYS.list(), (old) => (old || []).filter(p => p.id !== id));
            return { previousProjects };
        },
        onError: (_err, _id, context) => {
            queryClient.setQueryData(PROJECT_KEYS.list(), context?.previousProjects);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.list() });
            queryClient.invalidateQueries({ queryKey: OVERVIEW_TENANT_DATA_KEY });
        },
    });
};

export const useArchiveProjectMutation = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async ({ id, newStatus }: { id: string; newStatus: "realization" | "archived" }) => {
            if (user?.role === "demo") {
                const demoData = getDemoData();
                if (demoData) {
                    demoData.projects = demoData.projects.map(p => p.id === id ? { ...p, status: newStatus } : p);
                    if (demoData.projectDetails[id]) demoData.projectDetails[id].status = newStatus;
                    saveDemoData(demoData);
                }
                return;
            }

            const { error } = await dbAdapter.from("projects").update({ status: newStatus }).eq("id", id);
            if (error) throw error;
        },
        onMutate: async ({ id, newStatus }) => {
            await queryClient.cancelQueries({ queryKey: PROJECT_KEYS.list() });
            const previousProjects = queryClient.getQueryData<Project[]>(PROJECT_KEYS.list());
            queryClient.setQueryData<Project[]>(PROJECT_KEYS.list(), (old) =>
                (old || []).map(p => p.id === id ? { ...p, status: newStatus } : p)
            );
            return { previousProjects };
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.list() });
            queryClient.invalidateQueries({ queryKey: OVERVIEW_TENANT_DATA_KEY });
        }
    });
};

export const useUpdateProjectDetailsMutation = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    // Helper logic for field mapping omitted for brevity, will assume partial updates work fine except complex nested ones
    // But useAppData had complex Contract/Financials mapping.
    // I should ideally preserve it.

    return useMutation({
        mutationFn: async ({ id, updates }: { id: string, updates: Partial<ProjectDetails> }) => {
            const normalizedUpdates = { ...updates };
            if (updates.priceListLink !== undefined) {
                const trimmed = updates.priceListLink.trim();
                normalizedUpdates.priceListLink = trimmed && isProbablyUrl(trimmed) ? trimmed : "";
            }

            if (user?.role === "demo") {
                const demoData = getDemoData();
                if (demoData) {
                    demoData.projectDetails[id] = { ...demoData.projectDetails[id], ...normalizedUpdates };
                    saveDemoData(demoData);
                }
                return;
            }

            // Supabase Logic
            // Update main project fields
            const projectUpdates: any = {};
            if (normalizedUpdates.investor !== undefined) projectUpdates.investor = normalizedUpdates.investor;
            if (normalizedUpdates.technicalSupervisor !== undefined) projectUpdates.technical_supervisor = normalizedUpdates.technicalSupervisor;
            if (normalizedUpdates.siteManager !== undefined) projectUpdates.site_manager = normalizedUpdates.siteManager;
            if (normalizedUpdates.constructionManager !== undefined) projectUpdates.construction_manager = normalizedUpdates.constructionManager;
            if (normalizedUpdates.constructionTechnician !== undefined) projectUpdates.construction_technician = normalizedUpdates.constructionTechnician;
            if (normalizedUpdates.location !== undefined) projectUpdates.location = normalizedUpdates.location;
            if (normalizedUpdates.finishDate !== undefined) projectUpdates.finish_date = normalizedUpdates.finishDate;
            if (normalizedUpdates.plannedCost !== undefined) projectUpdates.planned_cost = normalizedUpdates.plannedCost;
            if (normalizedUpdates.documentationLink !== undefined) projectUpdates.documentation_link = normalizedUpdates.documentationLink;
            if (normalizedUpdates.documentLinks !== undefined) projectUpdates.document_links = normalizedUpdates.documentLinks;
            if (normalizedUpdates.inquiryLetterLink !== undefined) projectUpdates.inquiry_letter_link = normalizedUpdates.inquiryLetterLink;
            if (normalizedUpdates.materialInquiryTemplateLink !== undefined) projectUpdates.material_inquiry_template_link = normalizedUpdates.materialInquiryTemplateLink;
            if (normalizedUpdates.losersEmailTemplateLink !== undefined) projectUpdates.losers_email_template_link = normalizedUpdates.losersEmailTemplateLink;
            if (normalizedUpdates.priceListLink !== undefined) projectUpdates.price_list_link = normalizedUpdates.priceListLink;
            if (normalizedUpdates.docHubEnabled !== undefined) projectUpdates.dochub_enabled = normalizedUpdates.docHubEnabled;
            if (normalizedUpdates.docHubRootLink !== undefined) projectUpdates.dochub_root_link = normalizedUpdates.docHubRootLink;
            if (normalizedUpdates.docHubProvider !== undefined) projectUpdates.dochub_provider = normalizedUpdates.docHubProvider;
            if (normalizedUpdates.docHubMode !== undefined) projectUpdates.dochub_mode = normalizedUpdates.docHubMode;
            if (normalizedUpdates.docHubRootId !== undefined) projectUpdates.dochub_root_id = normalizedUpdates.docHubRootId;
            if (normalizedUpdates.docHubRootName !== undefined) projectUpdates.dochub_root_name = normalizedUpdates.docHubRootName;
            if (normalizedUpdates.docHubDriveId !== undefined) projectUpdates.dochub_drive_id = normalizedUpdates.docHubDriveId;
            if (normalizedUpdates.docHubSiteId !== undefined) projectUpdates.dochub_site_id = normalizedUpdates.docHubSiteId;
            if (normalizedUpdates.docHubRootWebUrl !== undefined) projectUpdates.dochub_root_web_url = normalizedUpdates.docHubRootWebUrl;
            if (normalizedUpdates.docHubStatus !== undefined) projectUpdates.dochub_status = normalizedUpdates.docHubStatus;
            if (normalizedUpdates.docHubLastError !== undefined) projectUpdates.dochub_last_error = normalizedUpdates.docHubLastError;
            if (normalizedUpdates.docHubStructureV1 !== undefined) projectUpdates.dochub_structure_v1 = normalizedUpdates.docHubStructureV1;
            if (normalizedUpdates.docHubStructureVersion !== undefined) projectUpdates.dochub_structure_version = normalizedUpdates.docHubStructureVersion;
            if (normalizedUpdates.docHubAutoCreateEnabled !== undefined) projectUpdates.dochub_autocreate_enabled = normalizedUpdates.docHubAutoCreateEnabled;
            if (normalizedUpdates.docHubAutoCreateLastRunAt !== undefined) projectUpdates.dochub_autocreate_last_run_at = normalizedUpdates.docHubAutoCreateLastRunAt;
            if (normalizedUpdates.docHubAutoCreateLastError !== undefined) projectUpdates.dochub_autocreate_last_error = normalizedUpdates.docHubAutoCreateLastError;

            if (Object.keys(projectUpdates).length > 0) {
                const { error } = await dbAdapter.from("projects").update(projectUpdates).eq("id", id);

                if (error) {
                    if (
                        error.code === "PGRST204" &&
                        typeof error.message === "string"
                    ) {
                        const compatibilityFields = ["losers_email_template_link", "material_inquiry_template_link"] as const;
                        const fieldsToStrip = compatibilityFields.filter((field) => error.message.includes(field));

                        if (fieldsToStrip.length > 0) {
                            const rest = { ...projectUpdates };
                            fieldsToStrip.forEach((field) => {
                                delete rest[field];
                            });

                            if (Object.keys(rest).length > 0) {
                                const { error: retryError } = await dbAdapter.from("projects").update(rest).eq("id", id);
                                if (retryError) console.error("Error updating project (retry):", retryError);
                            }
                        } else {
                            console.error("Error updating project:", error);
                            throw error;
                        }
                    } else {
                        console.error("Error updating project:", error);
                        throw error;
                    }
                }
            }

            // Update contract
            if (updates.contract) {
                await dbAdapter.from("project_contracts").upsert({
                    project_id: id,
                    maturity_days: updates.contract.maturity,
                    warranty_months: updates.contract.warranty,
                    retention_terms: updates.contract.retention,
                    site_facilities_percent: updates.contract.siteFacilities,
                    insurance_percent: updates.contract.insurance,
                });
            }

            // Update financials
            if (updates.investorFinancials) {
                await dbAdapter.from("project_investor_financials").upsert({
                    project_id: id,
                    sod_price: updates.investorFinancials.sodPrice,
                });

                if (updates.investorFinancials.amendments) {
                    await dbAdapter.from("project_amendments").delete().eq("project_id", id);
                    if (updates.investorFinancials.amendments.length > 0) {
                        await dbAdapter.from("project_amendments").insert(
                            updates.investorFinancials.amendments.map((a) => ({
                                id: a.id,
                                project_id: id,
                                label: a.label,
                                price: a.price,
                            }))
                        );
                    }
                }
            }
        },
        onMutate: async ({ id, updates }) => {
            await queryClient.cancelQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(id) });
            const previousDetails = queryClient.getQueryData<ProjectDetails>(PROJECT_DETAILS_KEYS.detail(id));
            queryClient.setQueryData<ProjectDetails>(PROJECT_DETAILS_KEYS.detail(id), (old) => old ? { ...old, ...updates } : undefined);
            return { previousDetails };
        },
        onError: (_err, { id }, context) => {
            queryClient.setQueryData(PROJECT_DETAILS_KEYS.detail(id), context?.previousDetails);
        },
        onSettled: (_data, _error, { id }) => {
            queryClient.invalidateQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(id) });
            // Also invalidate list if name/status changed
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.list() });
            queryClient.invalidateQueries({ queryKey: OVERVIEW_TENANT_DATA_KEY });
        }
    });
};

export const useAddCategoryMutation = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async ({ projectId, category }: { projectId: string; category: DemandCategory }) => {
            if (user?.role === "demo") {
                // update demo data
                return;
            }
            const { error } = await dbAdapter.from("demand_categories").insert({
                id: category.id,
                project_id: projectId,
                title: category.title,
                budget_display: category.budget,
                sod_budget: category.sodBudget,
                plan_budget: category.planBudget,
                status: category.status,
                description: category.description,
                deadline: category.deadline || null,
                realization_start: category.realizationStart || null,
                realization_end: category.realizationEnd || null,
                work_items: category.workItems || null,
            });
            if (error) throw error;

            // Sync DocHub
            syncDocHubCategory(projectId, "upsert", category.id, category.title);

            // AUTO-CREATE: local provider (Tender Flow Desktop)
            const projectDetails = queryClient.getQueryData<ProjectDetails>(PROJECT_DETAILS_KEYS.detail(projectId));
            if (
                projectDetails &&
                projectDetails.docHubEnabled &&
                projectDetails.docHubProvider === 'onedrive' &&
                projectDetails.docHubRootLink
            ) {
                const structure = resolveDocHubStructureV1(projectDetails.docHubStructureV1 || undefined);
                const hierarchyTree = buildHierarchyTree(structure.extraHierarchy || []);
                const suppliers: Record<string, Array<{ id: string; name: string }>> = {
                    [category.id]: [],
                };

                ensureStructure({
                    rootPath: projectDetails.docHubRootLink,
                    structure,
                    categories: [{ id: category.id, title: category.title }],
                    suppliers,
                    hierarchy: hierarchyTree,
                }).catch(err => {
                    console.error("Local DocHub auto-create failed:", err);
                });
            }
        },
        onMutate: async ({ projectId, category }) => {
            await queryClient.cancelQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(projectId) });
            const previousDetails = queryClient.getQueryData<ProjectDetails>(PROJECT_DETAILS_KEYS.detail(projectId));
            queryClient.setQueryData<ProjectDetails>(PROJECT_DETAILS_KEYS.detail(projectId), (old) => {
                if (!old) return old;
                return { ...old, categories: [...old.categories, category] };
            });
            return { previousDetails };
        },
        onSettled: (_data, _err, { projectId }) => {
            queryClient.invalidateQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(projectId) });
            queryClient.invalidateQueries({ queryKey: OVERVIEW_TENANT_DATA_KEY });
        }
    });
};


export const useEditCategoryMutation = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async ({ projectId, category }: { projectId: string; category: DemandCategory }) => {
            if (user?.role === "demo") {
                const demoData = getDemoData();
                if (demoData?.projectDetails[projectId]) {
                    const cats = demoData.projectDetails[projectId].categories;
                    const idx = cats.findIndex(c => c.id === category.id);
                    if (idx !== -1) {
                        cats[idx] = { ...cats[idx], ...category };
                        saveDemoData(demoData);
                    }
                }
                return;
            }

            const { error } = await dbAdapter.from("demand_categories").update({
                title: category.title,
                budget_display: category.budget,
                sod_budget: category.sodBudget,
                plan_budget: category.planBudget,
                status: category.status,
                description: category.description,
                deadline: category.deadline || null,
                realization_start: category.realizationStart || null,
                realization_end: category.realizationEnd || null,
                work_items: category.workItems || null,
            }).eq("id", category.id).eq("project_id", projectId);

            if (error) throw error;

            // Sync DocHub
            syncDocHubCategory(projectId, "upsert", category.id, category.title);
        },
        onMutate: async ({ projectId, category }) => {
            await queryClient.cancelQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(projectId) });
            const previousDetails = queryClient.getQueryData<ProjectDetails>(PROJECT_DETAILS_KEYS.detail(projectId));
            queryClient.setQueryData<ProjectDetails>(PROJECT_DETAILS_KEYS.detail(projectId), (old) => {
                if (!old) return old;
                return {
                    ...old,
                    categories: old.categories.map(c => c.id === category.id ? category : c)
                };
            });
            return { previousDetails };
        },
        onSettled: (_data, _err, { projectId }) => {
            queryClient.invalidateQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(projectId) });
            queryClient.invalidateQueries({ queryKey: OVERVIEW_TENANT_DATA_KEY });
        }
    });
};

export const useDeleteCategoryMutation = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async ({ projectId, categoryId }: { projectId: string; categoryId: string }) => {
            if (user?.role === "demo") {
                const demoData = getDemoData();
                if (demoData?.projectDetails[projectId]) {
                    demoData.projectDetails[projectId].categories = demoData.projectDetails[projectId].categories.filter(c => c.id !== categoryId);
                    saveDemoData(demoData);
                }
                return;
            }

            const { error } = await dbAdapter.from("demand_categories").delete().eq("id", categoryId).eq("project_id", projectId);
            if (error) throw error;

            // Sync DocHub (Archive)
            syncDocHubCategory(projectId, "archive", categoryId);

        },
        onMutate: async ({ projectId, categoryId }) => {
            await queryClient.cancelQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(projectId) });
            const previousDetails = queryClient.getQueryData<ProjectDetails>(PROJECT_DETAILS_KEYS.detail(projectId));
            queryClient.setQueryData<ProjectDetails>(PROJECT_DETAILS_KEYS.detail(projectId), (old) => {
                if (!old) return old;
                return {
                    ...old,
                    categories: old.categories.filter(c => c.id !== categoryId)
                };
            });
            return { previousDetails };
        },
        onSettled: (_data, _err, { projectId }) => {
            queryClient.invalidateQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(projectId) });
            queryClient.invalidateQueries({ queryKey: OVERVIEW_TENANT_DATA_KEY });
        }
    });
};
